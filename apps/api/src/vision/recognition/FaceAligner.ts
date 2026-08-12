import type { Point, DetectionResult } from "../detection/types.js";
import sharp from "sharp";

interface SimilarityTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const ARC_FACE_TEMPLATE: Point[] = [
  { x: 38.2946, y: 51.6963 },
  { x: 73.5318, y: 51.5014 },
  { x: 56.0252, y: 71.7366 },
  { x: 41.5493, y: 92.3655 },
  { x: 70.7299, y: 92.2041 },
];

export class FaceAligner {
  private calculateSimilarityTransform(
    source: Point[],
    target: Point[],
    ): SimilarityTransform {
    if (source.length !== 5 || target.length !== 5) {
      throw new Error(
        "FaceAligner requires exactly 5 source and target landmarks."
      );
    }
    let sourceCenterX = 0;
    let sourceCenterY = 0;

    let targetCenterX = 0;
    let targetCenterY = 0;

    for (let i = 0; i < 5; i++) {
      sourceCenterX += source[i].x;
      sourceCenterY += source[i].y;

      targetCenterX += target[i].x;
      targetCenterY += target[i].y;
    }

    sourceCenterX /= 5;
    sourceCenterY /= 5;

    targetCenterX /= 5;
    targetCenterY /= 5;

    let sumXX = 0;
    let sumXY = 0;
    let sumYX = 0;
    let sumYY = 0;

    let sourceVariance = 0;

    for (let i = 0; i < 5; i++) {
      const sx = source[i].x - sourceCenterX;
      const sy = source[i].y - sourceCenterY;

      const tx = target[i].x - targetCenterX;
      const ty = target[i].y - targetCenterY;

      sumXX += sx * tx;
      sumXY += sx * ty;
      sumYX += sy * tx;
      sumYY += sy * ty;

      sourceVariance +=
        sx * sx + sy * sy;
    }

    const rotationNumerator =
      sumXX + sumYY;

    const rotationDenominator =
      sumXY - sumYX;

    const theta = Math.atan2(
      rotationDenominator,
      rotationNumerator,
    );

    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    let rotatedCorrelation = 0;

    for (let i = 0; i < 5; i++) {
      const sx = source[i].x - sourceCenterX;
      const sy = source[i].y - sourceCenterY;

      const tx = target[i].x - targetCenterX;
      const ty = target[i].y - targetCenterY;

      const rotatedX =
        cosTheta * sx -
        sinTheta * sy;

      const rotatedY =
        sinTheta * sx +
        cosTheta * sy;

      rotatedCorrelation +=
        tx * rotatedX +
        ty * rotatedY;
    }

    const scale =
    rotatedCorrelation / sourceVariance;

    const a = scale * cosTheta;
    const b = -scale * sinTheta;
    const d = scale * sinTheta;
    const e = scale * cosTheta;

    const c =
      targetCenterX -
      (a * sourceCenterX +
        b * sourceCenterY);

    const f =
      targetCenterY -
      (d * sourceCenterX +
      e * sourceCenterY);

    return {
      a,
      b,
      c,
      d,
      e,
      f,
    };
  }

  public testTransform(
    detection: DetectionResult,
  ) {
    const source = [
      detection.leftEye,
      detection.rightEye,
      detection.nose,
      detection.leftMouth,
      detection.rightMouth,
    ];

    const transform =
      this.calculateSimilarityTransform(
        source,
        ARC_FACE_TEMPLATE,
      );

    console.log("Similarity transform:");
    console.log(transform);

    console.log("Transformed landmarks:");

    for (let i = 0; i < source.length; i++) {
      const transformed =
        this.applyTransform(
          source[i],
          transform,
        );

      console.log({
        source: source[i],
        transformed,
        target: ARC_FACE_TEMPLATE[i],
      });
    }

    return transform;
  }

  private applyTransform(
    point: Point,
    transform: SimilarityTransform,
  ): Point {
    return {
      x:
        transform.a * point.x +
        transform.b * point.y +
        transform.c,

      y:
        transform.d * point.x +
        transform.e * point.y +
        transform.f,
    };
  }

  async align(
    image: Buffer,
    detection: DetectionResult,
  ): Promise<Buffer> {
    const source = [
      detection.leftEye,
      detection.rightEye,
      detection.nose,
      detection.leftMouth,
      detection.rightMouth,
    ];

    const transform =
      this.calculateSimilarityTransform(
        source,
        ARC_FACE_TEMPLATE,
      );

    /*
    * Our transform is:
    *
    * x' = a*x + b*y + c
    * y' = d*x + e*y + f
    *
    * where:
    *
    * (x, y)      = original image coordinates
    * (x', y')    = aligned 112x112 coordinates
    *
    * For every output pixel we need the inverse:
    *
    * original = inverse(transform) * aligned
    */

    const determinant =
      transform.a * transform.e -
      transform.b * transform.d;

    if (Math.abs(determinant) < 1e-8) {
      throw new Error(
        "FaceAligner: transformation matrix is not invertible."
      );
    }

    const inverseA =
      transform.e / determinant;

    const inverseB =
      -transform.b / determinant;

    const inverseD =
      -transform.d / determinant;

    const inverseE =
      transform.a / determinant;

    const inverseC =
      -(
        inverseA * transform.c +
        inverseB * transform.f
      );

    const inverseF =
      -(
        inverseD * transform.c +
        inverseE * transform.f
      );

    // Decode the original image into raw RGB pixels.
    const { data, info } = await sharp(image)
      .removeAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

    const outputWidth = 112;
    const outputHeight = 112;
    const channels = info.channels;

    if (channels !== 3) {
      throw new Error(
        `FaceAligner: expected 3 RGB channels, got ${channels}.`
      );
    }

    const output = Buffer.alloc(
      outputWidth *
        outputHeight *
        3
    );

    /*
    * Bilinear interpolation.
    *
    * For every output pixel:
    *
    * 1. Convert target coordinate → source coordinate.
    * 2. Find the four neighbouring source pixels.
    * 3. Interpolate their RGB values.
    */

    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const sourceX =
          inverseA * x +
          inverseB * y +
          inverseC;

        const sourceY =
          inverseD * x +
          inverseE * y +
          inverseF;

        const outputOffset =
          (y * outputWidth + x) * 3;

        /*
        * If the transformed coordinate lies outside
        * the original image, use black.
        */
        if (
          sourceX < 0 ||
          sourceY < 0 ||
          sourceX >= info.width - 1 ||
          sourceY >= info.height - 1
        ) {
          output[outputOffset] = 0;
          output[outputOffset + 1] = 0;
          output[outputOffset + 2] = 0;
          continue;
        }

        const x0 = Math.floor(sourceX);
        const y0 = Math.floor(sourceY);

        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const dx = sourceX - x0;
        const dy = sourceY - y0;

        const topLeft =
          (y0 * info.width + x0) * 3;

        const topRight =
          (y0 * info.width + x1) * 3;

        const bottomLeft =
          (y1 * info.width + x0) * 3;

        const bottomRight =
          (y1 * info.width + x1) * 3;

        for (let channel = 0; channel < 3; channel++) {
          const top =
            data[topLeft + channel] *
              (1 - dx) +
            data[topRight + channel] *
              dx;

          const bottom =
            data[bottomLeft + channel] *
              (1 - dx) +
            data[bottomRight + channel] *
              dx;

          const value =
            top * (1 - dy) +
            bottom * dy;

          output[
            outputOffset + channel
          ] = Math.round(value);
        }
      }
    }

    return sharp(output, {
      raw: {
        width: outputWidth,
        height: outputHeight,
        channels: 3,
      },
    })
      .jpeg()
      .toBuffer();
  }

}