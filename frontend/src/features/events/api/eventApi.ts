import type {
  ApiSuccess,
  EventAttendeePage,
  EventPage,
  ProfessionalEventDTO,
  RSVPResponse
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

type Filters = {
  communityId?: string;
  type?: 'event' | 'meetup';
  upcoming?: boolean;
  mine?: 'organized' | 'participating';
  cursor?: string;
  limit?: number;
};
const data = async <T>(promise: Promise<{ data: ApiSuccess<T> }>) => (await promise).data.data;
export const eventApi = {
  community: (communityId: string, filters: Omit<Filters, 'communityId'> = {}) =>
    data<EventPage>(apiClient.get(`/communities/${communityId}/events`, { params: filters })),
  detail: (eventId: string) => data<{ event: ProfessionalEventDTO }>(apiClient.get(`/events/${eventId}`)),
  edit: (eventId: string, body: Record<string, unknown>) =>
    data<{ event: ProfessionalEventDTO }>(apiClient.patch(`/events/${eventId}`, body)),
  cancel: (eventId: string) =>
    data<{ event: ProfessionalEventDTO }>(apiClient.post(`/events/${eventId}/cancel`)),
  register: (eventId: string) =>
    data<{ event: ProfessionalEventDTO }>(apiClient.post(`/events/${eventId}/register`)),
  cancelRegistration: (eventId: string) =>
    data<{ event: ProfessionalEventDTO }>(apiClient.delete(`/events/${eventId}/registration`)),
  rsvp: (eventId: string, response: RSVPResponse) =>
    data<{ event: ProfessionalEventDTO }>(apiClient.put(`/events/${eventId}/rsvp`, { response })),
  attendees: (eventId: string, cursor?: string) =>
    data<EventAttendeePage>(apiClient.get(`/events/${eventId}/attendees`, { params: { cursor } }))
};
