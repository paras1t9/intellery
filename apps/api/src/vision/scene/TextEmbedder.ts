import { InferenceSession, Tensor } from "onnxruntime-node";
import { ClipTokenizer } from "./ClipTokenizer.js";

const CONTEXT_LENGTH = 77;

export class TextEmbedder {
  private readonly inputIdsName: string;
  private readonly outputName:   string;

  private constructor(
    private readonly session:   InferenceSession,
    private readonly tokenizer: ClipTokenizer,
  ) {
    /*
     * Xenova's clip-vit-base-patch32 text_model.onnx has exactly:
     *   input:  input_ids   (int64, [1, 77])
     *   output: text_embeds (float32, [1, 512])
     *
     * The attention_mask is fused into the model — no separate tensor.
     */
    const inputIdsName = session.inputNames[0];
    const outputName   = session.outputNames[0];

    if (!inputIdsName || !outputName) {
      throw new Error(
        "TextEmbedder: CLIP text model must have at least 1 input and 1 output tensor. " +
        `Got inputs=[${session.inputNames}] outputs=[${session.outputNames}]`,
      );
    }

    this.inputIdsName = inputIdsName;
    this.outputName   = outputName;
  }

  /**
   * Factory — loads the tokenizer files at startup, not per-request.
   */
  static async create(
    session:    InferenceSession,
    vocabPath:  string,
    mergesPath: string,
  ): Promise<TextEmbedder> {
    const tokenizer = await ClipTokenizer.create(vocabPath, mergesPath);
    return new TextEmbedder(session, tokenizer);
  }

  /**
   * Embeds a natural-language query string into a 512-D CLIP text feature
   * vector that lives in the same embedding space as the scene (image) vectors.
   *
   * Cosine similarity between this output and a PhotoAnnotation.vector
   * gives a semantic relevance score.
   */
  async embed(text: string): Promise<Float32Array> {
    const { inputIds } = this.tokenizer.encode(text);

    const inputIdsTensor = new Tensor(
      "int64",
      inputIds,
      [1, CONTEXT_LENGTH],
    );

    const outputs = await this.session.run({
      [this.inputIdsName]: inputIdsTensor,
    });

    const output = outputs[this.outputName];

    if (!output) {
      throw new Error(
        `TextEmbedder: output tensor "${this.outputName}" is missing.`,
      );
    }

    const embedding = output.data as Float32Array;

    if (embedding.length !== 512) {
      throw new Error(
        `TextEmbedder: expected 512-D output, got ${embedding.length}.`,
      );
    }

    /*
     * The Xenova export outputs text_embeds which is already projected
     * into the shared CLIP embedding space — same dimension as image_embeds.
     * Direct cosine comparison is valid.
     */
    return embedding;
  }
}
