import { InferenceSession } from "onnxruntime-node";

export interface ModelDefinition {
  readonly name: string;
  readonly path: string;
}

export interface LoadedModel {
  readonly definition: ModelDefinition;
  readonly session: InferenceSession;
}