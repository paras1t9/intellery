import { Request, Response } from "express";

export function register(_req: Request, res: Response){
  res.status(200).json({
    message: "Register endpoint"
  })
}