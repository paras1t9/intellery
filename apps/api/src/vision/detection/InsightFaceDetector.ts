import { InferenceSession, Tensor } from "onnxruntime-node";

import { FaceDetector } from "./FaceDetector.js";
import type {
  BoundingBox,
  DetectionResult,
  Point,
} from "./types.js";

interface ScrfdOutputGroup {
  stride: number;
  scoreName: string;
  boxName: string;
  landmarkName: string;
}

const SCRFD_OUTPUT_GROUPS: ScrfdOutputGroup[] = [
  {
    stride: 8,
    scoreName: "448",
    boxName: "451",
    landmarkName: "454",
  },
  {
    stride: 16,
    scoreName: "471",
    boxName: "474",
    landmarkName: "477",
  },
  {
    stride: 32,
    scoreName: "494",
    boxName: "497",
    landmarkName: "500",
  },
];

const SCORE_THRESHOLD = 0.5;

export class InsightFaceDetector implements FaceDetector {
  private readonly inputName: string;

  constructor(
    private readonly session: InferenceSession
  ) {
    const inputName = session.inputNames[0];

    if (!inputName) {
      throw new Error(
        "InsightFaceDetector: model has no input tensor."
      );
    }

    this.inputName = inputName;
  }

  private getCandidatePosition(
    index: number,
    stride: number,
    inputWidth: number,
  ) {
    const featureMapWidth = inputWidth / stride;
    const anchorsPerLocation = 2;

    const predictionsPerRow =
      featureMapWidth * anchorsPerLocation;

    const row = Math.floor(
      index / predictionsPerRow
    );

    const positionInRow =
      index % predictionsPerRow;

    const gridX = Math.floor(
      positionInRow / anchorsPerLocation
    );

    const anchor =
      positionInRow % anchorsPerLocation;

    return {
      row,
      gridX,
      anchor,
      referenceX: gridX * stride,
      referenceY: row * stride,
    };
  }

  private decodeBox(
    referenceX: number,
    referenceY: number,
    box: Float32Array,
    stride: number
  ) {
    const left = box[0] * stride;
    const top = box[1] * stride;
    const right = box[2] * stride;
    const bottom = box[3] * stride;

    return {
      x1: referenceX - left,
      y1: referenceY - top,
      x2: referenceX + right,
      y2: referenceY + bottom,
    };
  }

  private decodeLandmarks(
    referenceX: number,
    referenceY: number,
    landmarks: Float32Array,
    stride: number,
  ) {
    return {
      leftEye: {
        x: referenceX + landmarks[0] * stride,
        y: referenceY + landmarks[1] * stride,
      },

      rightEye: {
        x: referenceX + landmarks[2] * stride,
        y: referenceY + landmarks[3] * stride,
      },

      nose: {
        x: referenceX + landmarks[4] * stride,
        y: referenceY + landmarks[5] * stride,
      },

      leftMouth: {
        x: referenceX + landmarks[6] * stride,
        y: referenceY + landmarks[7] * stride,
      },

      rightMouth: {
        x: referenceX + landmarks[8] * stride,
        y: referenceY + landmarks[9] * stride,
      },
    };
  }

  private calculateIoU(
    a: BoundingBox,
    b: BoundingBox,
  ): number {
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;

    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;

    const intersectionX1 = Math.max(
      a.x,
      b.x,
    );

    const intersectionY1 = Math.max(
      a.y,
      b.y,
    );

    const intersectionX2 = Math.min(
      ax2,
      bx2,
    );

    const intersectionY2 = Math.min(
      ay2,
      by2,
    );

    const intersectionWidth =
      Math.max(
        0,
        intersectionX2 - intersectionX1,
      );

    const intersectionHeight =
      Math.max(
        0,
        intersectionY2 - intersectionY1,
      );

    const intersectionArea =
      intersectionWidth * intersectionHeight;

    const areaA =
      a.width * a.height;

    const areaB =
      b.width * b.height;

    const unionArea =
      areaA + areaB - intersectionArea;

    if (unionArea === 0) {
      return 0;
    }

    return intersectionArea / unionArea;
  }

  private applyNms(
    detections: DetectionResult[],
    iouThreshold: number,
  ): DetectionResult[] {
    const sorted = [...detections].sort(
      (a, b) => b.confidence - a.confidence
    );

    const kept: DetectionResult[] = [];

    while (sorted.length > 0) {
      const best = sorted.shift()!;

      kept.push(best);

      const remaining = sorted.filter(
        (candidate) => {
          const iou = this.calculateIoU(
            best.boundingBox,
            candidate.boundingBox,
          );

          return iou <= iouThreshold;
        }
      );

      sorted.splice(
        0,
        sorted.length,
        ...remaining
      );
    }

    return kept;
  }

  async detect(
    tensor: Tensor,
    scale: number,
  ): Promise<DetectionResult[]> {
    const outputs = await this.session.run({
      [this.inputName]: tensor,
    });

    const detections: DetectionResult[] = [];

    const inputWidth = tensor.dims[3] as number;

    for (const group of SCRFD_OUTPUT_GROUPS) {
      const scoreOutput = outputs[group.scoreName];
      const boxOutput = outputs[group.boxName];
      const landmarkOutput = outputs[group.landmarkName];

      if (!scoreOutput || !boxOutput || !landmarkOutput) {
        throw new Error(
          `Missing SCRFD outputs for stride ${group.stride}.`
        );
      }

      const scores =
        scoreOutput.data as Float32Array;

      const boxes =
        boxOutput.data as Float32Array;

      const landmarks =
        landmarkOutput.data as Float32Array;

      for (let i = 0; i < scores.length; i++) {
        const score = scores[i];

        if (score < SCORE_THRESHOLD) {
          continue;
        }

        const position =
          this.getCandidatePosition(
            i,
            group.stride,
            inputWidth,
          );
        const boxOffset = i * 4;

        const box = boxes.slice(
          boxOffset,
          boxOffset + 4,
        );

        const decodedBox = this.decodeBox(
          position.referenceX,
          position.referenceY,
          box,
          group.stride,
        );

        const boundingBox: BoundingBox = {
          x: decodedBox.x1 / scale,
          y: decodedBox.y1 / scale,
          width:
            (decodedBox.x2 - decodedBox.x1) / scale,
          height:
            (decodedBox.y2 - decodedBox.y1) / scale,
        };

        // -----------------------------
        // Decode landmarks
        // -----------------------------

        const landmarkOffset = i * 10;

        const landmarkValues = landmarks.slice(
          landmarkOffset,
          landmarkOffset + 10,
        );

        const decodedLandmarks =
          this.decodeLandmarks(
            position.referenceX,
            position.referenceY,
            landmarkValues,
            group.stride,
          );

        const originalLandmarks = {
          leftEye: {
            x: decodedLandmarks.leftEye.x / scale,
            y: decodedLandmarks.leftEye.y / scale,
          },

          rightEye: {
            x: decodedLandmarks.rightEye.x / scale,
            y: decodedLandmarks.rightEye.y / scale,
          },

          nose: {
            x: decodedLandmarks.nose.x / scale,
            y: decodedLandmarks.nose.y / scale,
          },

          leftMouth: {
            x: decodedLandmarks.leftMouth.x / scale,
            y: decodedLandmarks.leftMouth.y / scale,
          },

          rightMouth: {
            x: decodedLandmarks.rightMouth.x / scale,
            y: decodedLandmarks.rightMouth.y / scale,
          },
        };

        // -----------------------------
        // Create detection
        // -----------------------------

        detections.push({
          confidence: score,
          boundingBox,
          ...originalLandmarks,
        });
      }
    }

    const finalDetections = this.applyNms(
      detections,
      0.4,
    );

    return finalDetections;
  }
}