// @vitest-environment jsdom
import type { ProfessionalEventDTO } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventApi } from '../api/eventApi';
import { zonedDateTime } from '../utils/zonedDateTime';
import EventsPage from './EventsPage';
import EventDetailPage from './EventDetailPage';

vi.mock('../api/eventApi', () => ({
  eventApi: {
    list: vi.fn(),
    community: vi.fn(),
    detail: vi.fn(),
    edit: vi.fn(),
    cancel: vi.fn(),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
    rsvp: vi.fn(),
    attendees: vi.fn()
  }
}));
const id = 'a'.repeat(24);
const event: ProfessionalEventDTO = {
  id,
  activityId: 'b'.repeat(24),
  community: { id: 'c'.repeat(24), name: 'Engineering Guild', slug: 'engineering-guild' },
  organizer: { name: 'Ada Host', username: 'ada', headline: 'Engineer' },
  type: 'event',
  title: 'Architecture workshop',
  description: 'A practical architecture workshop for engineers.',
  category: 'Workshop',
  startAt: '2027-01-10T10:00:00.000Z',
  endAt: '2027-01-10T12:00:00.000Z',
  timezone: 'UTC',
  locationType: 'online',
  venueName: null,
  onlineUrl: null,
  capacity: 2,
  confirmedCount: 1,
  interestedCount: 0,
  status: 'scheduled',
  registrationOpen: true,
  myRegistration: null,
  myRSVP: null,
  canManage: false,
  canParticipate: true,
  canViewAttendees: false
};
const page = { items: [event], hasMore: false, nextCursor: null };
function mount(path: string, element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path={path.includes('/events/') ? '/app/events/:eventId' : '/app/events'}
            element={element}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(eventApi.list).mockResolvedValue(page);
  vi.mocked(eventApi.detail).mockResolvedValue({ event });
  vi.mocked(eventApi.register).mockResolvedValue({
    event: { ...event, myRegistration: 'registered', confirmedCount: 2 }
  });
  vi.mocked(eventApi.cancelRegistration).mockResolvedValue({
    event: { ...event, myRegistration: 'cancelled', confirmedCount: 0 }
  });
  vi.mocked(eventApi.rsvp).mockResolvedValue({ event: { ...event, type: 'meetup', myRSVP: 'going' } });
  vi.mocked(eventApi.attendees).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
});
afterEach(cleanup);
describe('event pages', () => {
  it('shows discovery and switches dashboard filters', async () => {
    mount('/app/events', <EventsPage />);
    expect(await screen.findByRole('link', { name: 'Architecture workshop' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Past events' }));
    await waitFor(() =>
      expect(eventApi.list).toHaveBeenCalledWith(expect.objectContaining({ upcoming: false }))
    );
  });
  it('shows eligible registration and hides organizer controls', async () => {
    mount(`/app/events/${id}`, <EventDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Architecture workshop' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Organizer controls' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(eventApi.register).toHaveBeenCalledWith(id));
  });
  it('shows organizer controls and lazily loads attendees', async () => {
    vi.mocked(eventApi.detail).mockResolvedValue({
      event: { ...event, canManage: true, canViewAttendees: true }
    });
    mount(`/app/events/${id}`, <EventDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Organizer controls' })).toBeTruthy();
    expect(eventApi.attendees).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendees' }));
    await waitFor(() => expect(eventApi.attendees).toHaveBeenCalledWith(id, undefined));
  });
  it('rejects daylight saving gaps and ambiguous wall times', () => {
    expect(() => zonedDateTime('2027-03-14T02:30', 'America/New_York')).toThrow(/does not exist/);
    expect(() => zonedDateTime('2027-11-07T01:30', 'America/New_York')).toThrow(/occurs twice/);
    expect(zonedDateTime('2027-01-10T15:30', 'Asia/Kolkata')).toBe('2027-01-10T15:30:00+05:30');
  });
});
