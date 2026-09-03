import { InferenceSession, Tensor } from "onnxruntime-node";
import sharp from "sharp";

/*
 * CLIP ViT-B/32 normalization constants.
 *
 * Original values are in [0, 1] range:
 *   mean: [0.48145466, 0.4578275,  0.40821073]
 *   std:  [0.26862954, 0.26130258, 0.27577711]
 *
 * sharp gives us raw pixels in [0, 255] range, so we scale:
 *   mean_255 = mean * 255
 *   std_255  = std  * 255
 *
 * This keeps the formula (pixel - mean) / std mathematically identical
 * to (pixel/255 - mean_01) / std_01.
 */
const CLIP_MEAN: [number, number, number] = [122.771, 116.746, 104.094];
const CLIP_STD: [number, number, number]  = [68.500,  66.630,  70.321];

const CLIP_SIZE = 224;

export class SceneEmbedder {
  private readonly inputName: string;
  private readonly outputName: string;

  constructor(private readonly session: InferenceSession) {
    const inputName  = session.inputNames[0];
    const outputName = session.outputNames[0];

    if (!inputName) {
      throw new Error("SceneEmbedder: CLIP vision model has no input tensor.");
    }
    if (!outputName) {
      throw new Error("SceneEmbedder: CLIP vision model has no output tensor.");
    }

    this.inputName  = inputName;
    this.outputName = outputName;
  }

  /**
   * Embeds an image into a 512-D CLIP visual feature vector.
   *
   * Preprocessing matches the reference CLIP implementation:
   *   1. Resize so the shorter side is 224 px.
   *   2. Center-crop to 224×224 (sharp's 'cover' + 'centre').
   *   3. Normalize with CLIP-specific mean/std.
   *   4. Layout as CHW float32 tensor [1, 3, 224, 224].
   */
  async embed(imageBuffer: Buffer): Promise<Float32Array> {
    /*
     * 'cover' + 'centre': resize to fill 224×224, crop from the center.
     * This is the CLIP preprocessing used in the original paper.
     */
    const raw = await sharp(imageBuffer)
      .resize(CLIP_SIZE, CLIP_SIZE, { fit: "cover", position: "centre" })
      .removeAlpha()
      .raw()
      .toBuffer();

    const pixelCount = CLIP_SIZE * CLIP_SIZE;
    const chw = new Float32Array(pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
      const r = raw[i * 3];
      const g = raw[i * 3 + 1];
      const b = raw[i * 3 + 2];

      chw[i]                   = (r - CLIP_MEAN[0]) / CLIP_STD[0]; // R channel
      chw[pixelCount + i]      = (g - CLIP_MEAN[1]) / CLIP_STD[1]; // G channel
      chw[2 * pixelCount + i]  = (b - CLIP_MEAN[2]) / CLIP_STD[2]; // B channel
    }

    const tensor = new Tensor(
      "float32",
      chw,
      [1, 3, CLIP_SIZE, CLIP_SIZE],
    );

    const outputs = await this.session.run({ [this.inputName]: tensor });
    const output  = outputs[this.outputName];

    if (!output) {
      throw new Error(
        `SceneEmbedder: output tensor "${this.outputName}" is missing.`,
      );
    }

    const embedding = output.data as Float32Array;

    /*
     * The Xenova ONNX export already projects + L2-normalizes the output
     * into the shared CLIP embedding space (512-D). No extra normalization needed.
     */
    if (embedding.length !== 512) {
      throw new Error(
        `SceneEmbedder: expected 512-D output, got ${embedding.length}.`,
      );
    }

    return embedding;
  }
}
