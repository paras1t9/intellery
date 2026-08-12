export class FaceMatcher {
  cosineSimilarity(
    a: Float32Array,
    b: Float32Array,
  ): number {
    if (a.length !== b.length) {
      throw new Error(
        "FaceMatcher: embeddings must have the same dimension.",
      );
    }

    let dotProduct = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    return dotProduct;
  }
}