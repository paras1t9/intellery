import { AppError } from "../errors/AppError.js";
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction){
  if (err instanceof AppError){
    res.status(err.statusCode);
    if(err.expose){
      res.json({
        message: err.message
      });
    }else{
      res.json({
        message: "Internal Server Error"
      })
    }
  }else{
    console.error(err);
    res.status(500).json({
      message: "Internal Server Error"
    })
  }
}