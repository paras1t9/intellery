export class AppError extends Error {
  statusCode: number;
  expose: boolean;

  constructor(
    statusCode: number,
    message: string,
    expose: boolean = true
  ) {
    super(message);

    this.statusCode = statusCode;
    this.expose = expose;
    this.name = "AppError";
  }
}