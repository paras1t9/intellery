import { EventRole } from "../../../generated/prisma/enums.js";

export interface CreateEventResponse {
  eventId: string;
  name: string;
  eventCode: string;
  iconURL: string | null;
}
export interface JoinEventResponse {
  eventId: string;
  name: string;
  eventCode: string;
  iconURL: string | null;
  role: EventRole;
}
export interface UserEventResponse {
  eventId : string;
  name : string;
  iconURL: string | null;
  role: string;
}

export interface EventDetailsResponse {
  eventId: string;
  name: string;
  iconURL: string | null;
  eventCode: string;
  role: EventRole;
  memberCount: number;
  photoCount: number;
}

export interface EventMemberResponse {
  userId: string;
  displayName: string;
  role: EventRole;
}

export interface UpdateMemberRoleDto {
  role: EventRole;
}