import type { PostAuthor } from './index.js';

export type EventType = 'event' | 'meetup';
export type EventStatus = 'scheduled' | 'cancelled' | 'completed';
export type EventLocationType = 'online' | 'in_person' | 'hybrid';
export type RegistrationStatus = 'registered' | 'cancelled';
export type RSVPResponse = 'going' | 'interested' | 'not_going';

export interface ProfessionalEventDTO {
  id: string;
  activityId: string;
  community: { id: string; name: string; slug: string };
  organizer: PostAuthor;
  type: EventType;
  title: string;
  description: string;
  category: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  locationType: EventLocationType;
  venueName: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  confirmedCount: number;
  interestedCount: number;
  status: EventStatus;
  registrationOpen: boolean;
  myRegistration: RegistrationStatus | null;
  myRSVP: RSVPResponse | null;
  canManage: boolean;
  canParticipate: boolean;
  canViewAttendees: boolean;
}
export interface EventPage {
  items: ProfessionalEventDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface EventAttendeeDTO {
  userId: string;
  profile: PostAuthor;
  response: 'registered' | 'going' | 'interested';
}
export interface EventAttendeePage {
  items: EventAttendeeDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}
