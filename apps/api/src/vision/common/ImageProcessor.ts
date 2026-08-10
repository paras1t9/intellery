import sharp from "sharp";
import { Tensor } from "onnxruntime-node";

import { ImageProcessorConfig } from "./types.js";

export class ImageProcessor {
  async toTensor(
    image: Buffer,
    config: ImageProcessorConfig
  ): Promise<Tensor> {
    const sharpImage = sharp(image);
    const pixels = await sharpImage
      .resize(config.width, config.height)
      .removeAlpha()
      .raw()
      .toBuffer();
    const channelSize = config.width * config.height;
    const chw = new Float32Array(channelSize * 3);
    for(let i= 0; i < channelSize; i++){
      const r = pixels[3*i];
      const g = pixels[3*i + 1];
      const b = pixels[3*i + 2];

      const normalizedR = (r-config.mean[0])/config.std[0];
      const normalizedG = (g-config.mean[1])/config.std[1];
      const normalizedB = (b-config.mean[2])/config.std[2];

      chw[i] = normalizedR;
      chw[channelSize + i] = normalizedG;
      chw[2 * channelSize + i] = normalizedB
    }
    return new Tensor("float32", chw, [1,3,config.height,config.width]);
  }
}