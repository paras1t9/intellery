import { randomBytes } from "node:crypto";
import { StatusCodes } from "http-status-codes";

import { EventRole } from "../../generated/prisma/enums.js";
import { Prisma } from "../../generated/prisma/client.js";

import prisma from "../lib/prisma.js";
import { AppError } from "../errors/AppError.js";
import { CreateEventDto, JoinEventDto } from "../schemas/event.schema.js";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET_LENGTH = ALPHABET.length;
const EVENT_CODE_LENGTH = 6;
const MAX_ACCEPTABLE_BYTE =
  Math.floor(256 / ALPHABET_LENGTH) * ALPHABET_LENGTH;
const MAX_EVENT_CODE_GENERATION_ATTEMPTS = 5;
const MAX_CREATE_EVENT_RETRIES = 5;

interface CreateEventResponse {
  eventId: string;
  name: string;
  eventCode: string;
  iconURL: string | null;
}
interface JoinEventResponse {
  eventId: string;
  name: string;
  eventCode: string;
  iconURL: string | null;
  role: EventRole;
}

export class EventService {
  private async generateUniqueEventCode(length = EVENT_CODE_LENGTH): Promise<string> {
    for (
      let attempt = 0;
      attempt < MAX_EVENT_CODE_GENERATION_ATTEMPTS;
      attempt++
    ) {
      let code = "";

    while (code.length < length) {
      const bytes = randomBytes(length);

      for (const byte of bytes) {
        if (byte >= MAX_ACCEPTABLE_BYTE) continue;

        code += ALPHABET[byte % ALPHABET_LENGTH];

        if (code.length === length) {
          return code;
        }
      }
    }

      const existingEvent = await prisma.event.findUnique({
        where: {
          eventCode: code,
        },
        select: {
          eventId: true,
        },
      });

      if (!existingEvent) {
        return code;
      }
    }

    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to generate a unique event code.",
      false
    );
  }

  async createEvent(
    userId: string,
    dto: CreateEventDto
  ): Promise<CreateEventResponse> {
    for (let attempt = 0; attempt < MAX_CREATE_EVENT_RETRIES; attempt++) {
      const eventCode = await this.generateUniqueEventCode();

      try {
        const event = await prisma.$transaction(async (tx) => {
          const newEvent = await tx.event.create({
            data: {
              name: dto.name,
              iconURL: dto.iconUrl,
              eventCode,
            },
          });

          await tx.eventMember.create({
            data: {
              userId,
              eventId: newEvent.eventId,
              role: EventRole.ADMIN,
            },
          });

          return newEvent;
        });

        return {
          eventId: event.eventId,
          name: event.name,
          eventCode: event.eventCode,
          iconURL: event.iconURL,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes("eventCode")
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to create event after multiple attempts.",
      false
    );
  }

  async joinEvent(userId: string, dto: JoinEventDto): Promise<JoinEventResponse>{
    const event = await prisma.event.findUnique({
      where: {
        eventCode: dto.eventCode,
      },
      select: {
        eventId: true,
        name: true,
        eventCode: true,
        iconURL: true,
      },
    });
    if(!event){
      throw new AppError(StatusCodes.NOT_FOUND, "Event doesn't exist");
    }
    try{
      await prisma.eventMember.create({
      data:{
        userId,
        eventId: event.eventId,
        role: EventRole.VIEWER
      }
      })
        return {
        eventId: event.eventId,
        name: event.name,
        eventCode: event.eventCode,
        iconURL: event.iconURL,
        role: EventRole.VIEWER,
        }; 
      }catch(error){
        if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
      ) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "You are already a member of this event.",
        false
        );
      }

      throw error;
    }
  }
}

export default new EventService();