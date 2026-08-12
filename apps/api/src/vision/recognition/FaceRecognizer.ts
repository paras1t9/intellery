import { InferenceSession, Tensor } from "onnxruntime-node";
import sharp from "sharp";

export class FaceRecognizer {
  private readonly inputName: string;
  private readonly outputName: string;

  constructor(
    private readonly session: InferenceSession,
  ) {
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];

    if (!inputName) {
      throw new Error(
        "FaceRecognizer: model has no input tensor.",
      );
    }

    if (!outputName) {
      throw new Error(
        "FaceRecognizer: model has no output tensor.",
      );
    }

    this.inputName = inputName;
    this.outputName = outputName;
  }

  async recognize(
    alignedFace: Buffer,
  ): Promise<Float32Array> {
    const { data, info } = await sharp(
      alignedFace,
    )
      .resize(112, 112)
      .removeAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

    if (
      info.width !== 112 ||
      info.height !== 112 ||
      info.channels !== 3
    ) {
      throw new Error(
        "FaceRecognizer: expected a 112x112 RGB image.",
      );
    }

    const pixelCount =
      info.width * info.height;

    const chw = new Float32Array(
      pixelCount * 3,
    );

    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];

      chw[i] =
        (r - 127.5) / 127.5;

      chw[pixelCount + i] =
        (g - 127.5) / 127.5;

      chw[2 * pixelCount + i] =
        (b - 127.5) / 127.5;
    }

    const tensor = new Tensor(
      "float32",
      chw,
      [1, 3, 112, 112],
    );

    const outputs =
      await this.session.run({
        [this.inputName]: tensor,
      });

    const output =
      outputs[this.outputName];

    if (!output) {
      throw new Error(
        `FaceRecognizer: output "${this.outputName}" is missing.`,
      );
    }

    const rawEmbedding =
      output.data as Float32Array;

    if (rawEmbedding.length !== 512) {
      throw new Error(
        `FaceRecognizer: expected 512-dimensional embedding, got ${rawEmbedding.length}.`,
      );
    }

    return this.normalize(
      rawEmbedding,
    );
  }

  private normalize(
    embedding: Float32Array,
  ): Float32Array {
    let squaredSum = 0;

    for (const value of embedding) {
      squaredSum += value * value;
    }

    const norm = Math.sqrt(
      squaredSum,
    );

    if (norm === 0) {
      throw new Error(
        "FaceRecognizer: cannot normalize a zero vector.",
      );
    }

    const normalized =
      new Float32Array(
        embedding.length,
      );

    for (
      let i = 0;
      i < embedding.length;
      i++
    ) {
      normalized[i] =
        embedding[i] / norm;
    }

    return normalized;
  }
}