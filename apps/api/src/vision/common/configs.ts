import { ImageProcessorConfig } from "./types.js";
export const SCRFD_CONFIG: ImageProcessorConfig = {
  width: 640,
  height: 640,
  mean: [127.5, 127.5, 127.5],
  std: [128, 128, 128],
};

export const ARCFACE_CONFIG: ImageProcessorConfig = {
  width: 112,
  height: 112,
  mean: [127.5, 127.5, 127.5],
  std: [128, 128, 128],
};