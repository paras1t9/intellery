import { InferenceSession } from "onnxruntime-node";

export class ModelLoader {
  async load(modelPath: string): Promise<InferenceSession> {
    return InferenceSession.create(modelPath);
  }
}