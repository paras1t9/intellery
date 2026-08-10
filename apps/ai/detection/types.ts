interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FaceLandmarks {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  leftMouth: Point;
  rightMouth: Point;
}
export interface DetectedFaceResult {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks: FaceLandmarks;
}