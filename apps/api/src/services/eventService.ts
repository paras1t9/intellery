import { randomBytes } from "node:crypto";

import { EventRole } from "../../generated/prisma/enums.js";
import { Prisma } from "../../generated/prisma/client.js";

import prisma from "../infrastructure/prisma.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../errors/index.js";
import { CreateEventDto, JoinEventDto, UpdateEventDetailsDto } from "../schemas/eventSchema.js";
import { CreateEventResponse, JoinEventResponse, UserEventResponse, EventDetailsResponse, EventMemberResponse, UpdateMemberRoleDto } from "../dto/event/eventDto.js";

const ALPHABET                          = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET_LENGTH                   = ALPHABET.length;
const EVENT_CODE_LENGTH                 = 6;
const MAX_ACCEPTABLE_BYTE               = Math.floor(256 / ALPHABET_LENGTH) * ALPHABET_LENGTH;
const MAX_EVENT_CODE_GENERATION_ATTEMPTS = 5;
const MAX_CREATE_EVENT_RETRIES          = 5;

export class EventService {

  private async generateUniqueEventCode(length = EVENT_CODE_LENGTH): Promise<string> {
    for (let attempt = 0; attempt < MAX_EVENT_CODE_GENERATION_ATTEMPTS; attempt++) {
      let code = "";

      while (code.length < length) {
        const bytes = randomBytes(length);
        for (const byte of bytes) {
          if (byte >= MAX_ACCEPTABLE_BYTE) continue;
          code += ALPHABET[byte % ALPHABET_LENGTH];
          if (code.length === length) return code;
        }
      }

      const existingEvent = await prisma.event.findUnique({
        where:  { eventCode: code },
        select: { eventId: true },
      });

      if (!existingEvent) return code;
    }

    throw new Error("Failed to generate a unique event code after maximum attempts.");
  }

  async createEvent(userId: string, dto: CreateEventDto): Promise<CreateEventResponse> {
    for (let attempt = 0; attempt < MAX_CREATE_EVENT_RETRIES; attempt++) {
      const eventCode = await this.generateUniqueEventCode();

      try {
        const event = await prisma.$transaction(async (tx) => {
          const newEvent = await tx.event.create({
            data: { name: dto.name, iconURL: dto.iconURL, eventCode },
          });
          await tx.eventMember.create({
            data: { userId, eventId: newEvent.eventId, role: EventRole.ADMIN },
          });
          return newEvent;
        });

        return {
          eventId:   event.eventId,
          name:      event.name,
          eventCode: event.eventCode,
          iconURL:   event.iconURL,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes("eventCode")
        ) {
          continue; // collision — regenerate code
        }
        throw error;
      }
    }

    throw new Error("Failed to create event after maximum retry attempts.");
  }

  async joinEvent(userId: string, dto: JoinEventDto): Promise<JoinEventResponse> {
    const event = await prisma.event.findUnique({
      where:  { eventCode: dto.eventCode },
      select: { eventId: true, name: true, eventCode: true, iconURL: true },
    });

    if (!event) {
      throw new NotFoundError("No event found with that code.", "EVENT_NOT_FOUND");
    }

    try {
      await prisma.eventMember.create({
        data: { userId, eventId: event.eventId, role: EventRole.VIEWER },
      });

      return {
        eventId:   event.eventId,
        name:      event.name,
        eventCode: event.eventCode,
        iconURL:   event.iconURL,
        role:      EventRole.VIEWER,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("You are already a member of this event.", "ALREADY_MEMBER");
      }
      throw error;
    }
  }

  async getUserEvents(userId: string): Promise<UserEventResponse[]> {
    const rawEvents = await prisma.eventMember.findMany({
      where:   { userId },
      select: {
        role:  true,
        event: { select: { eventId: true, name: true, iconURL: true } },
      },
      orderBy: { event: { createdAt: "desc" } },
    });

    return rawEvents.map((m) => ({
      eventId: m.event.eventId,
      name:    m.event.name,
      iconURL: m.event.iconURL,
      role:    m.role,
    }));
  }

  async deleteEvent(eventId: string, userId: string): Promise<void> {
    const event = await prisma.event.findUnique({
      where:  { eventId },
      select: { eventId: true },
    });

    if (!event) throw new NotFoundError("Event not found.", "EVENT_NOT_FOUND");

    const adminMembership = await prisma.eventMember.findFirst({
      where: { userId, eventId, role: EventRole.ADMIN },
    });

    if (!adminMembership) {
      throw new ForbiddenError("Only event admins can delete an event.", "ADMIN_REQUIRED");
    }

    await prisma.event.delete({ where: { eventId } });
  }

  async getEventDetails(userId: string, eventId: string): Promise<EventDetailsResponse> {
    const rawEventDetails = await prisma.eventMember.findFirst({
      where: { userId, eventId },
      select: {
        role:  true,
        event: {
          select: {
            eventId:   true,
            name:      true,
            iconURL:   true,
            eventCode: true,
            _count:    { select: { members: true, photos: true } },
          },
        },
      },
    });

    if (!rawEventDetails) {
      throw new NotFoundError("Event not found or you are not a member.", "EVENT_NOT_FOUND");
    }

    return {
      eventId:     rawEventDetails.event.eventId,
      name:        rawEventDetails.event.name,
      iconURL:     rawEventDetails.event.iconURL,
      eventCode:   rawEventDetails.event.eventCode,
      role:        rawEventDetails.role,
      memberCount: rawEventDetails.event._count.members,
      photoCount:  rawEventDetails.event._count.photos,
    };
  }

  async updateEvent(
    userId:     string,
    eventId:    string,
    updateData: UpdateEventDetailsDto,
  ): Promise<EventDetailsResponse> {
    const event = await prisma.event.findUnique({ where: { eventId } });
    if (!event) throw new NotFoundError("Event not found.", "EVENT_NOT_FOUND");

    const adminMembership = await prisma.eventMember.findFirst({
      where: { userId, eventId, role: EventRole.ADMIN },
    });

    if (!adminMembership) {
      throw new ForbiddenError("Only event admins can update event details.", "ADMIN_REQUIRED");
    }

    const data: Prisma.EventUpdateInput = {};
    if (updateData.name    !== undefined) data.name    = updateData.name;
    if (updateData.iconUrl !== undefined) data.iconURL = updateData.iconUrl;

    await prisma.event.update({ where: { eventId }, data });
    return this.getEventDetails(userId, eventId);
  }

  async getEventMembers(userId: string, eventId: string): Promise<EventMemberResponse[]> {
    const isMember = await prisma.eventMember.findUnique({
      where:  { userId_eventId: { userId, eventId } },
      select: { userId: true },
    });

    if (!isMember) {
      throw new NotFoundError("Event not found or you are not a member.", "EVENT_NOT_FOUND");
    }

    const members = await prisma.eventMember.findMany({
      where:   { eventId },
      select: {
        userId: true,
        role:   true,
        user:   { select: { displayName: true } },
      },
      orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }],
    });

    return members.map((m) => ({
      userId:      m.userId,
      displayName: m.user.displayName,
      role:        m.role,
    }));
  }

  async updateMemberRole(
    actorUserId:  string,
    eventId:      string,
    targetUserId: string,
    dto:          UpdateMemberRoleDto,
  ): Promise<EventMemberResponse> {
    const targetRole = dto.role;

    const actorMembership = await prisma.eventMember.findUnique({
      where:  { userId_eventId: { userId: actorUserId, eventId } },
      select: { role: true },
    });

    if (!actorMembership) {
      throw new NotFoundError("Event not found.", "EVENT_NOT_FOUND");
    }

    if (actorMembership.role !== EventRole.ADMIN) {
      throw new ForbiddenError("Only admins can change member roles.", "ADMIN_REQUIRED");
    }

    const targetMembership = await prisma.eventMember.findUnique({
      where:  { userId_eventId: { userId: targetUserId, eventId } },
      select: { userId: true, role: true, user: { select: { displayName: true } } },
    });

    if (!targetMembership) {
      throw new NotFoundError("Member not found.", "MEMBER_NOT_FOUND");
    }

    // No-op if already the target role
    if (targetMembership.role === targetRole) {
      return {
        userId:      targetMembership.userId,
        displayName: targetMembership.user.displayName,
        role:        targetMembership.role,
      };
    }

    // Prevent removing the last admin
    if (targetMembership.role === EventRole.ADMIN) {
      const adminCount = await prisma.eventMember.count({
        where: { eventId, role: EventRole.ADMIN },
      });
      if (adminCount === 1) {
        throw new ConflictError(
          "Cannot demote the last admin. Promote another member first.",
          "LAST_ADMIN",
        );
      }
    }

    const updated = await prisma.eventMember.update({
      where:  { userId_eventId: { userId: targetUserId, eventId } },
      data:   { role: targetRole },
      select: { userId: true, role: true, user: { select: { displayName: true } } },
    });

    return {
      userId:      updated.userId,
      displayName: updated.user.displayName,
      role:        updated.role,
    };
  }
}

export default new EventService();