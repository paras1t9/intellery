import sharp from "sharp";
import { Tensor } from "onnxruntime-node";

import {
  ImageProcessorConfig,
  ProcessedImage,
} from "./types.js";

export class ImageProcessor {
  async toTensor(
    image: Buffer,
    config: ImageProcessorConfig
  ): Promise<ProcessedImage> {
    const source = sharp(image).rotate();
    const metadata = await source.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to determine image dimensions.");
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    const scale = Math.min(
      config.width / originalWidth,
      config.height / originalHeight
    );

    const resizedWidth = Math.round(originalWidth * scale);
    const resizedHeight = Math.round(originalHeight * scale);

    const pixels = await source
    .resize(resizedWidth, resizedHeight)
    .extend({
      top: 0,
      bottom: config.height - resizedHeight,
      left: 0,
      right: config.width - resizedWidth,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 1,
      },
    })
    .removeAlpha()
    .raw()
    .toBuffer();

    const channelSize = config.width * config.height;
    const chw = new Float32Array(channelSize * 3);

    for (let i = 0; i < channelSize; i++) {
      const b = pixels[3 * i];
      const g = pixels[3 * i + 1];
      const r = pixels[3 * i + 2];

      const normalizedR =
        (r - config.mean[0]) / config.std[0];

      const normalizedG =
        (g - config.mean[1]) / config.std[1];

      const normalizedB =
        (b - config.mean[2]) / config.std[2];

      chw[i] = normalizedR;
      chw[channelSize + i] = normalizedG;
      chw[2 * channelSize + i] = normalizedB;
    }

    const tensor = new Tensor(
      "float32",
      chw,
      [1, 3, config.height, config.width]
    );

    return {
      tensor,
      scale,
      originalWidth,
      originalHeight,
    };
  }
}