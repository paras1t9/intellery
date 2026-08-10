import { Tensor } from "onnxruntime-node";
export interface ImageProcessorConfig {
  width: number;
  height: number;
  mean: readonly [number, number, number];
  std: readonly [number, number, number];
}

export interface ProcessedImage {
  tensor: Tensor;
  scale: number;
  originalWidth: number;
  originalHeight: number;
}