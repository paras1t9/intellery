import { InferenceSession, Tensor } from "onnxruntime-node";

import { FaceDetector } from "./FaceDetector.js";
import { DetectionResult } from "./types.js";

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

  async detect(tensor: Tensor): Promise<DetectionResult[]> {
    const outputs = await this.session.run({
      [this.inputName]: tensor,
    });

    const scoreOutput = outputs["448"];
    const boxOutput = outputs["451"];

    if (!scoreOutput || !boxOutput) {
      throw new Error("SCRFD stride-8 outputs are missing.");
    }

    const boxes = boxOutput.data as Float32Array;

    const stride = 8;
    const featureMapWidth = 640 / stride;
    const anchorsPerLocation = 2;

    const scores = scoreOutput.data as Float32Array;

    let bestIndex = 0;
    let bestScore = scores[0];

    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIndex = i;
      }
    }

    console.log("Best candidate:", {
      index: bestIndex,
      score: bestScore,
    });
    // for (let i = 0; i < 10; i++) {
    //   const row = Math.floor(i / (featureMapWidth * anchorsPerLocation));

    //   const positionInRow = i % (featureMapWidth * anchorsPerLocation);

    //   const gridX = Math.floor(positionInRow / anchorsPerLocation);

    //   const anchor = positionInRow % anchorsPerLocation;

    //   const referenceX = gridX * stride;
    //   const referenceY = row * stride;

    //   const boxOffset = i * 4;

    //   const box = boxes.slice(boxOffset, boxOffset + 4);

    //   const decoded = this.decodeBox(
    //     referenceX,
    //     referenceY,
    //     box,
    //     stride
    //   );

    //   console.log({
    //     i,
    //     row,
    //     gridX,
    //     anchor,
    //     referenceX,
    //     referenceY,
    //     decoded,
    //   });
    // }
    const i = bestIndex;

    const row = Math.floor(
      i / (featureMapWidth * anchorsPerLocation)
    );

    const positionInRow =
      i % (featureMapWidth * anchorsPerLocation);

    const gridX = Math.floor(
      positionInRow / anchorsPerLocation
    );

    const anchor =
      positionInRow % anchorsPerLocation;

    const referenceX = gridX * stride;
    const referenceY = row * stride;

    const boxOffset = i * 4;
    const box = boxes.slice(boxOffset, boxOffset + 4);

    const decoded = this.decodeBox(
      referenceX,
      referenceY,
      box,
      stride
    );

    console.log({
      i,
      score: bestScore,
      row,
      gridX,
      anchor,
      referenceX,
      referenceY,
      box: Array.from(box),
      decoded,
    });
    return [];
  }

  private decodeBox(
    referenceX: number,
    referenceY: number,
    box: Float32Array | number[],
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
}