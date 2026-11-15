// @vitest-environment jsdom
import type { CommandMetadata, CommunityActivity, CommunityDetail } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandApi } from '../api/commandApi';
import CommunityActivityBoard from './CommunityActivityBoard';

vi.mock('../api/commandApi', () => ({
  commandApi: { commands: vi.fn(), activities: vi.fn(), submit: vi.fn(), remove: vi.fn() }
}));
const id = 'a'.repeat(24);
const commands: CommandMetadata[] = [
  {
    id: 'referral',
    command: '/referral',
    label: 'Referral opportunity',
    description: 'Share an opportunity.',
    iconId: 'briefcase',
    category: 'career',
    enabled: true,
    payloadVersion: 1,
    displayType: 'referral'
  },
  {
    id: 'needreferral',
    command: '/needreferral',
    label: 'Referral request',
    description: 'Ask for a referral.',
    iconId: 'request',
    category: 'career',
    enabled: true,
    payloadVersion: 1,
    displayType: 'needreferral'
  },
  {
    id: 'event',
    command: '/event',
    label: 'Professional event',
    description: 'Announce an event.',
    iconId: 'calendar',
    category: 'events',
    enabled: true,
    payloadVersion: 1,
    displayType: 'event'
  },
  {
    id: 'meetup',
    command: '/meetup',
    label: 'Professional meetup',
    description: 'Announce a meetup.',
    iconId: 'people',
    category: 'events',
    enabled: true,
    payloadVersion: 1,
    displayType: 'meetup'
  }
];
const community: CommunityDetail = {
  id,
  slug: 'command-guild',
  name: 'Command Guild',
  description: 'A professional community.',
  category: 'software-development',
  tags: [],
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  memberCount: 2,
  membershipStatus: 'ACTIVE',
  myRole: 'MEMBER',
  createdAt: '2026-11-15T00:00:00.000Z',
  rules: '',
  owner: null,
  permissions: {
    viewMembers: true,
    reviewRequests: false,
    editDetails: false,
    manageRoles: false,
    removeMembers: false,
    transferOwnership: false,
    archive: false
  }
};
const activity: CommunityActivity = {
  id: 'b'.repeat(24),
  communityId: id,
  command: 'needreferral',
  commandLabel: 'Referral request',
  payloadVersion: 1,
  payload: {
    jobTitle: 'Frontend Engineer',
    company: 'Example Co',
    experienceLevel: 'mid',
    message: 'I would appreciate a referral for this role.'
  },
  author: { name: 'Ada Engineer', username: 'ada', headline: 'Engineer' },
  createdAt: '2026-11-15T10:00:00.000Z',
  ownedByMe: true,
  canDelete: true
};
const eventActivity: CommunityActivity = {
  ...activity,
  id: 'c'.repeat(24),
  command: 'event',
  commandLabel: 'Professional event',
  payload: { title: 'Engineering forum', description: 'A professional engineering discussion.', startAt: '2027-01-10T10:00:00.000Z', locationType: 'online', locationOrUrl: 'https://example.com/event' }
};
const page = <T,>(items: T[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
  hasMore: !!nextCursor
});
function mount(value: CommunityDetail = community) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommunityActivityBoard community={value} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(commandApi.commands).mockResolvedValue({ commands });
  vi.mocked(commandApi.activities).mockResolvedValue(page([]));
  vi.mocked(commandApi.submit).mockResolvedValue({ activity });
  vi.mocked(commandApi.remove).mockResolvedValue({});
});
afterEach(cleanup);

describe('community command UI', () => {
  it('opens slash suggestions, filters them, supports arrows, Enter, and Escape', async () => {
    mount();
    const input = await screen.findByRole('combobox', { name: 'Choose a structured action' });
    fireEvent.change(input, { target: { value: '/' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'Referral request' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const again = screen.getByRole('combobox', { name: 'Choose a structured action' });
    fireEvent.change(again, { target: { value: '/need' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it.each([
    ['/referral', 'Referral opportunity', 'Job title'],
    ['/needreferral', 'Referral request', 'Experience level'],
    ['/event', 'Professional event', 'Event title'],
    ['/meetup', 'Professional meetup', 'Meetup title']
  ])('opens the structured %s form by mouse', async (slash, title, field) => {
    mount();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Choose a structured action' }), {
      target: { value: slash }
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(slash) }));
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(field))).toBeTruthy();
  });
  it('blocks arbitrary text and unsupported slash commands without a chat submit path', async () => {
    mount();
    const input = await screen.findByRole('combobox', { name: 'Choose a structured action' });
    fireEvent.change(input, { target: { value: 'Hello everyone' } });
    expect(screen.getByRole('alert').textContent).toContain('no open chat');
    expect(screen.queryByRole('button', { name: /send message/i })).toBeNull();
    fireEvent.change(input, { target: { value: '/unknown' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
    expect(commandApi.submit).not.toHaveBeenCalled();
  });
  it('validates fields, submits a structured request, and refreshes activity', async () => {
    vi.mocked(commandApi.activities)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValue(page([activity]));
    mount();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Choose a structured action' }), {
      target: { value: '/need' }
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Choose a structured action' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Publish activity' }));
    expect(screen.getAllByText(/Too small|at least|expected string/i).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('textbox', { name: /Job title/ }), {
      target: { value: 'Frontend Engineer' }
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Company/ }), { target: { value: 'Example Co' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Experience level/ }), {
      target: { value: 'mid' }
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Referral request/ }), {
      target: { value: 'I would appreciate a referral for this role.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish activity' }));
    await waitFor(() =>
      expect(commandApi.submit).toHaveBeenCalledWith(
        id,
        expect.objectContaining({
          command: 'needreferral',
          payloadVersion: 1,
          payload: expect.objectContaining({ jobTitle: 'Frontend Engineer' })
        })
      )
    );
    expect(await screen.findByRole('heading', { name: 'Frontend Engineer' })).toBeTruthy();
  });
  it('filters and paginates activity and allows deletion only when provided by the API', async () => {
    vi.mocked(commandApi.activities)
      .mockResolvedValueOnce(page([activity], 'next'))
      .mockResolvedValue(page([eventActivity]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    expect(await screen.findByRole('heading', { name: 'Frontend Engineer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more activity' }));
    await waitFor(() => expect(commandApi.activities).toHaveBeenCalledWith(id, undefined, 'next'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Show activity' }), { target: { value: 'event' } });
    await waitFor(() => expect(commandApi.activities).toHaveBeenCalledWith(id, 'event', ''));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete activity' })[0]);
    await waitFor(() => expect(commandApi.remove).toHaveBeenCalled());
    vi.mocked(window.confirm).mockRestore();
  });
  it('handles command and feed loading, empty and error states', async () => {
    vi.mocked(commandApi.commands).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(commandApi.activities).mockResolvedValueOnce(page([]));
    mount();
    expect(await screen.findByText('No activity matches this filter yet.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('offline');
  });
  it('does not expose a composer to nonmembers or archived communities', async () => {
    mount({ ...community, membershipStatus: null, myRole: null });
    expect(await screen.findByText('No activity matches this filter yet.')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Choose a structured action' })).toBeNull();
    cleanup();
    mount({ ...community, status: 'ARCHIVED' });
    expect(await screen.findByText('No activity matches this filter yet.')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Choose a structured action' })).toBeNull();
  });
});
