import { DetectedFaceResult } from "./types";

export interface FaceDetectionService{
  detect(imagePath:string): Promise<DetectedFaceResult>
}