import { InferenceSession, Tensor } from "onnxruntime-node";

class InsightFaceDetector{
  constructor(
    private readonly session: InferenceSession
  ){}

  async detect(tensor: Tensor){
    const outputs = await this.session.run({
      "input.1" : tensor
    });

    
  }
}