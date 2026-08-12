import { Tensor } from "onnxruntime-node";
import { DetectionResult } from "./types.js";

export interface FaceDetector {
  detect(tensor: Tensor, scale: number): Promise<DetectionResult[]>;
}