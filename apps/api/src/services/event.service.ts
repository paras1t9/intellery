import { randomBytes } from "node:crypto";
import { StatusCodes } from "http-status-codes";

import { EventRole } from "../../generated/prisma/enums.js";
import { Prisma } from "../../generated/prisma/client.js";

import prisma from "../infrastructure/prisma.js";
import { AppError } from "../errors/AppError.js";
import { CreateEventDto, JoinEventDto, UpdateEventDetailsDto, } from "../schemas/event.schema.js";
import { CreateEventResponse, JoinEventResponse, UserEventResponse, EventDetailsResponse, EventMemberResponse, UpdateMemberRoleDto } from "../dto/event/event.dto.js";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET_LENGTH = ALPHABET.length;
const EVENT_CODE_LENGTH = 6;
const MAX_ACCEPTABLE_BYTE =
  Math.floor(256 / ALPHABET_LENGTH) * ALPHABET_LENGTH;
const MAX_EVENT_CODE_GENERATION_ATTEMPTS = 5;
const MAX_CREATE_EVENT_RETRIES = 5;
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
              iconURL: dto.iconURL,
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

  async joinEvent(userId: string, dto: JoinEventDto): Promise<JoinEventResponse> {
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
    if (!event) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event doesn't exist");
    }
    try {
      await prisma.eventMember.create({
        data: {
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
    } catch (error) {
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

  async getUserEvents(userId: string): Promise<UserEventResponse[]> {
    const rawEvents = await prisma.eventMember.findMany({
      where: {
        userId
      },
      select: {
        role: true,
        event: {
          select: {
            eventId: true,
            name: true,
            iconURL: true
          }
        }
      },
      orderBy: {
        event: {
          createdAt: "desc"
        }
      }
    })
    const events = rawEvents.map((rawEvent) => ({
      eventId: rawEvent.event.eventId,
      name: rawEvent.event.name,
      iconURL: rawEvent.event.iconURL,
      role: rawEvent.role
    }))
    return events;
  }

  async deleteEvent(eventId: string, userId: string): Promise<void> {
    const event = await prisma.event.findUnique({
      where: {
        eventId
      },
      select: {
        eventId: true
      }
    })
    if (!event) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event Does not exist")
    }
    const adminMembership = await prisma.eventMember.findFirst({
      where: {
        userId,
        eventId,
        role: EventRole.ADMIN,
      },
    });
    if (!adminMembership) {
      throw new AppError(StatusCodes.FORBIDDEN, "Not authorized to perform the function");
    }
    try {
      await prisma.event.delete({
        where: {
          eventId
        }
      });
    }
    catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError(StatusCodes.NOT_FOUND, "Event not found");
      }
      throw error;
    }
    return
  }

  async getEventDetails(
    userId: string,
    eventId: string
  ): Promise<EventDetailsResponse> {
    const rawEventDetails = await prisma.eventMember.findFirst({
      where: {
        userId,
        eventId,
      },
      select: {
        role: true,
        event: {
          select: {
            eventId: true,
            name: true,
            iconURL: true,
            eventCode: true,
            _count: {
              select: {
                members: true,
                photos: true,
              },
            },
          },
        },
      },
    });

    if (!rawEventDetails) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event not found");
    }

    return {
      eventId: rawEventDetails.event.eventId,
      name: rawEventDetails.event.name,
      iconURL: rawEventDetails.event.iconURL,
      eventCode: rawEventDetails.event.eventCode,
      role: rawEventDetails.role,
      memberCount: rawEventDetails.event._count.members,
      photoCount: rawEventDetails.event._count.photos,
    };
  }

  async updateEvent(userId: string, eventId: string, updateData: UpdateEventDetailsDto): Promise<EventDetailsResponse> {
    const event = await prisma.event.findUnique({
      where: {
        eventId,
      },
    });
    if (!event) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event not found");
    }
    const adminMembership = await prisma.eventMember.findFirst({
      where: {
        userId,
        eventId,
        role: EventRole.ADMIN,
      },
    });
    if (!adminMembership) {
      throw new AppError(StatusCodes.UNAUTHORIZED,
        "You are not authorized to update this event."
      );
    }
    const data: Prisma.EventUpdateInput = {};
    if (updateData.name !== undefined) {
      data.name = updateData.name;
    }
    if (updateData.iconUrl !== undefined) {
      data.iconURL = updateData.iconUrl;
    }
    await prisma.event.update({
      where: {
        eventId,
      },
      data,
    });
    return this.getEventDetails(userId, eventId);
  }

  async getEventMembers(userId: string, eventId: string): Promise<EventMemberResponse[]> {
    const isMember = await prisma.eventMember.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      },
      select: {
        userId: true
      }
    });
    if (!isMember) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event not found");
    }
    const members = await prisma.eventMember.findMany({
      where: {
        eventId
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            displayName: true
          }
        }
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          user: {
            displayName: "asc"
          }
        }
      ]
    })
    return members.map((member) => ({
      userId: member.userId,
      displayName: member.user.displayName,
      role: member.role,
    }))
  }

  async updateMemberRole(actorUserId: string, eventId: string, targetUserId: string, dto: UpdateMemberRoleDto): Promise<EventMemberResponse> {
    const targetRole = dto.role;
    const actorMembership = await prisma.eventMember.findUnique({
      where: {
        userId_eventId: {
          userId: actorUserId,
          eventId
        }
      }, select: {
        role: true
      }
    })
    if (!actorMembership) {
      throw new AppError(StatusCodes.NOT_FOUND, "Event Not found");
    }
    if (actorMembership.role !== EventRole.ADMIN) {
      throw new AppError(StatusCodes.FORBIDDEN, "Action not allowed");
    }

    const targetMembership = await prisma.eventMember.findUnique({
      where: {
        userId_eventId: {
          userId: targetUserId, eventId
        }
      }, select: {
        userId: true,
        role: true,
        user: {
          select: {
            displayName: true
          }
        }
      }
    })
    if (!targetMembership) {
      throw new AppError(StatusCodes.NOT_FOUND, "Member Not found");
    }
    if (targetMembership.role === targetRole) {
      return {
        userId: targetMembership.userId,
        displayName: targetMembership.user.displayName,
        role: targetMembership.role
      }
    }
    if (targetMembership.role === EventRole.ADMIN) {
      const adminCount = await prisma.eventMember.count({
        where: {
          eventId,
          role: EventRole.ADMIN
        }
      })
      if (adminCount === 1) {
        throw new AppError(StatusCodes.CONFLICT, "Event should have atleast one admin")
      }
    }
    const updatedMembership = await prisma.eventMember.update({
      where: {
        userId_eventId: {
          userId: targetUserId,
          eventId,
        },
      },
      data: {
        role: targetRole,
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });

    return {
      userId: updatedMembership.userId,
      displayName: updatedMembership.user.displayName,
      role: updatedMembership.role,
    };
  }

}

export default new EventService();