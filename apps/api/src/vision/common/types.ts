export interface ImageProcessorConfig {
  width: number;
  height: number;
  mean: readonly [number, number, number];
  std: readonly [number, number, number];
}