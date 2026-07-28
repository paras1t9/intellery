import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import eventService from "../services/event.service.js";
import { CreateEventDto, JoinEventDto, DeleteEventDto, EventDetailsDto, UpdateEventDetailsDto} from "../schemas/event.schema.js";
import { UpdateMemberRoleDto } from "../dto/event/event.dto.js";
import { ta } from "zod/v4/locales";

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

export async function getUserEvents(req: Request, res: Response){
  const userId = req.user.id;
  const events = await eventService.getUserEvents(userId);
  return res.status(StatusCodes.OK).json({
    success : true,
    data: events
  });
}

export async function deleteEvent(req: Request, res: Response) {
  const userId = req.user.id;
  const dto = req.params as DeleteEventDto
  const eventId = dto.eventId;
  await eventService.deleteEvent(eventId, userId);
  return res.status(StatusCodes.NO_CONTENT).end();
}

export async function getEventDetails(req: Request, res: Response){
  const userId = req.user.id;
  const dto = req.params as EventDetailsDto;
  const eventId = dto.eventId;
  const eventDetails = await eventService.getEventDetails(userId, eventId);
  return res.status(StatusCodes.OK).json({
    success: true,
    data: eventDetails
  })
}

export async function updateEvent(req: Request, res: Response) {
  const userId = req.user.id;
  const eventId = req.params.eventId as string;
  const dto = req.body as UpdateEventDetailsDto;

  const updatedEvent = await eventService.updateEvent(
    userId,
    eventId,
    dto
  );

  return res.status(200).json(updatedEvent);
}

export async function getEventMembers(req: Request, res: Response){
  const userId = req.user.id;
  const eventId = req.params.eventId as string;

  const members = await eventService.getEventMembers(
    userId,
    eventId
  );

  return res.status(200).json(members);
}

export async function updateMemberRole(req: Request, res: Response){
const actorUserId = req.user.id;
const eventId = req.params.eventId as string;
const targetUserId = req.params.userId as string;
const dto = req.body as UpdateMemberRoleDto;

const updatedMember = await eventService.updateMemberRole(
  actorUserId,
  eventId,
  targetUserId,
  dto
);

  return res.status(200).json(updatedMember);
}