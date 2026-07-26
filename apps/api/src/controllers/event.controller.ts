import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import eventService from "../services/event.service.js";
import { CreateEventDto, JoinEventDto } from "../schemas/event.schema.js";

export async function createEvent(req: Request, res: Response) {
  const userId = req.user.id;
  const dto = req.body as CreateEventDto;

  const event = await eventService.createEvent(userId, dto);

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: event,
  });
}

export async function joinEvent(req: Request, res: Response){
  const userId = req.user.id;
  const dto = req.body as JoinEventDto;

  const joinedEvent = await eventService.joinEvent(userId, dto);
  return res.status(StatusCodes.OK).json({
    success: true,
    data: joinedEvent
  });
}