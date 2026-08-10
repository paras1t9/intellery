import { ModelLoader } from "./src/infrastructure/ai/ModelLoader.js";

async function main() {
  const loader = new ModelLoader();

  const session = await loader.load(
    "./models/insightface/detection/scrfd_10g_bnkps.onnx"
  );

  console.log("=== INPUT METADATA ===");
  console.log(session.inputMetadata);

  console.log();

  console.log("=== OUTPUT METADATA ===");
  console.log(session.outputMetadata);
}

main().catch(console.error);