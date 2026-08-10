import fs from "node:fs/promises";

import { ModelLoader } from "./src/infrastructure/ai/ModelLoader.js";
import { ImageProcessor } from "./src/vision/common/ImageProcessor.js";
import { InsightFaceDetector } from "./src/vision/detection/InsightFaceDetector.js";
import type { ImageProcessorConfig } from "./src/vision/common/types.js";

const SCRFD_CONFIG: ImageProcessorConfig = {
  width: 640,
  height: 640,
  mean: [127.5, 127.5, 127.5],
  std: [128, 128, 128],
};

async function main() {
  // 1. Load the SCRFD model
  const modelLoader = new ModelLoader();

  const session = await modelLoader.load(
    "./models/insightface/detection/scrfd_10g_bnkps.onnx"
  );

  console.log("Model loaded.");

  // 2. Create our image processor
  const imageProcessor = new ImageProcessor();

  // 3. Create the face detector
  const detector = new InsightFaceDetector(session);

  // 4. Read an actual image
  const image = await fs.readFile(
    "./uploads/1785479141646-WIN_20251016_14_50_31_Pro.jpg"
  );

  console.log("Image loaded.");

  // 5. Convert image → ONNX tensor
  const tensor = await imageProcessor.toTensor(
    image,
    SCRFD_CONFIG
  );

  console.log("Tensor created.");
  console.log("Tensor shape:", tensor.dims);

  // 6. Run face detection
  const detections = await detector.detect(tensor);

  //console.log("Detections:", detections);
  console.log("Input names:", session.inputNames);
  console.log("Output names:", session.outputNames);
  console.log("Input metadata:", session.inputMetadata);
  console.log("Output metadata:", session.outputMetadata);
}

main().catch((error) => {
  console.error("Detection test failed:");
  console.error(error);
  process.exit(1);
});