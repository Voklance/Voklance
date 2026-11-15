// @vitest-environment jsdom
import type { AuthUser, CommunityDetail, CommunityMember, CommunitySummary } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSidebar from '@/components/shared/ProfileSidebar';
import { profileApi } from '@/features/profiles/api/profileApi';
import { communityApi } from '../api/communityApi';
import { commandApi } from '@/features/community-commands/api/commandApi';
import { referralApi } from '@/features/referrals/api/referralApi';
import CommunityDiscoveryPage from './CommunityDiscoveryPage';
import CreateCommunityPage from './CreateCommunityPage';
import CommunityDetailPage from './CommunityDetailPage';
import CommunityMembersPage from './CommunityMembersPage';
import CommunityRequestsPage from './CommunityRequestsPage';
import CommunitySettingsPage from './CommunitySettingsPage';

vi.mock('../api/communityApi', () => ({
  communityApi: {
    discover: vi.fn(),
    mine: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    members: vi.fn(),
    requests: vi.fn(),
    decide: vi.fn(),
    update: vi.fn(),
    role: vi.fn(),
    remove: vi.fn(),
    transfer: vi.fn(),
    archive: vi.fn()
  }
}));
vi.mock('@/features/profiles/api/profileApi', () => ({ profileApi: { own: vi.fn() } }));
vi.mock('@/features/community-commands/api/commandApi', () => ({
  commandApi: { commands: vi.fn(), activities: vi.fn(), submit: vi.fn(), remove: vi.fn() }
}));
vi.mock('@/features/referrals/api/referralApi', () => ({
  referralApi: { communityOpportunities: vi.fn(), communityNeeds: vi.fn() }
}));

const id = 'a'.repeat(24);
const user: AuthUser = {
  id,
  name: 'Ada Developer',
  email: 'ada@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};
const summary: CommunitySummary = {
  id,
  slug: 'react-professionals',
  name: 'React Professionals',
  description: 'A professional React community.',
  category: 'software-development',
  tags: ['react'],
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  memberCount: 2,
  membershipStatus: null,
  myRole: null,
  createdAt: '2026-11-15T00:00:00.000Z'
};
const permissions = {
  viewMembers: false,
  reviewRequests: false,
  editDetails: false,
  manageRoles: false,
  removeMembers: false,
  transferOwnership: false,
  archive: false
};
let detail: CommunityDetail;
const member: CommunityMember = {
  userId: 'b'.repeat(24),
  name: 'Sam Member',
  username: 'sam-member',
  headline: 'Engineer',
  role: 'MEMBER',
  joinedAt: '2026-11-15T00:00:00.000Z'
};
const page = <T,>(items: T[]) => ({ items, nextCursor: null, hasMore: false });
function renderRoute(path: string, sidebar = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {sidebar ? (
          <ProfileSidebar user={user} />
        ) : (
          <Routes>
            <Route path="/app/communities" element={<CommunityDiscoveryPage />} />
            <Route path="/app/communities/create" element={<CreateCommunityPage />} />
            <Route path="/app/communities/:slug" element={<CommunityDetailPage />} />
            <Route path="/app/communities/:slug/members" element={<CommunityMembersPage />} />
            <Route path="/app/communities/:slug/requests" element={<CommunityRequestsPage />} />
            <Route path="/app/communities/:slug/settings" element={<CommunitySettingsPage />} />
          </Routes>
        )}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(commandApi.commands).mockResolvedValue({ commands: [] });
  vi.mocked(commandApi.activities).mockResolvedValue(page([]));
  vi.mocked(referralApi.communityOpportunities).mockResolvedValue(page([]));
  vi.mocked(referralApi.communityNeeds).mockResolvedValue(page([]));
  detail = {
    ...summary,
    rules: 'Stay on topic.',
    owner: { name: 'Ada Developer', username: 'ada-dev', headline: 'Engineer' },
    permissions
  };
  vi.mocked(communityApi.discover).mockResolvedValue(page([summary]));
  vi.mocked(communityApi.mine).mockResolvedValue(page([]));
  vi.mocked(communityApi.detail).mockImplementation(async () => ({ community: detail }));
  vi.mocked(communityApi.members).mockResolvedValue(page([member]));
  vi.mocked(communityApi.requests).mockResolvedValue(
    page([{ id: 'c'.repeat(24), member, createdAt: member.joinedAt }])
  );
  vi.mocked(communityApi.create).mockResolvedValue({ community: detail });
  vi.mocked(communityApi.join).mockResolvedValue({ membershipStatus: 'ACTIVE' });
  vi.mocked(communityApi.leave).mockResolvedValue({ membershipStatus: 'REMOVED' });
  vi.mocked(communityApi.decide).mockResolvedValue({ membershipStatus: 'ACTIVE' });
  vi.mocked(communityApi.update).mockResolvedValue({ community: detail });
  vi.mocked(communityApi.role).mockResolvedValue({ role: 'MODERATOR' });
  vi.mocked(communityApi.remove).mockResolvedValue({ membershipStatus: 'REMOVED' });
  vi.mocked(communityApi.transfer).mockResolvedValue({ community: detail });
  vi.mocked(communityApi.archive).mockResolvedValue({ community: detail });
  vi.mocked(profileApi.own).mockResolvedValue({ profile: null });
});
afterEach(cleanup);

describe('community screens', () => {
  it('shows loading, real discovery cards, search and category filters', async () => {
    renderRoute('/app/communities');
    expect(screen.getByText('Loading communities…')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'React Professionals' })).toHaveProperty(
      'href',
      'http://localhost:3000/app/communities/react-professionals'
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search communities' }), {
      target: { value: 'React' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(communityApi.discover).toHaveBeenCalledWith(expect.objectContaining({ search: 'React' }), '')
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'software-development' }
    });
    await waitFor(() =>
      expect(communityApi.discover).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'software-development' }),
        ''
      )
    );
  });
  it('handles discovery empty and error states', async () => {
    vi.mocked(communityApi.discover).mockResolvedValueOnce(page([]));
    renderRoute('/app/communities');
    expect(await screen.findByText('No communities match these filters.')).toBeTruthy();
    cleanup();
    vi.mocked(communityApi.discover).mockRejectedValueOnce(new Error('offline'));
    renderRoute('/app/communities');
    expect(await screen.findByText('Communities could not be loaded.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'React Professionals' })).toBeTruthy();
  });
  it('loads a second discovery page without duplicating cards', async () => {
    const another = { ...summary, id: 'd'.repeat(24), slug: 'typescript-guild', name: 'TypeScript Guild' };
    vi.mocked(communityApi.discover)
      .mockResolvedValueOnce({ items: [summary], nextCursor: 'next-page', hasMore: true })
      .mockResolvedValueOnce(page([another]));
    renderRoute('/app/communities');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more communities' }));
    expect(await screen.findByRole('link', { name: 'TypeScript Guild' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'React Professionals' })).toHaveLength(1);
  });
  it('validates and creates a community, then opens its detail', async () => {
    renderRoute('/app/communities/create');
    fireEvent.change(screen.getByRole('textbox', { name: 'Community name' }), {
      target: { value: 'React Guild' }
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'A useful React community for professionals.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create community' }));
    await waitFor(() =>
      expect(communityApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'React Guild', category: 'software-development' }),
        expect.anything()
      )
    );
    expect(await screen.findByRole('heading', { name: 'React Professionals' })).toBeTruthy();
  });
  it('keeps invalid community forms on screen without publishing', () => {
    renderRoute('/app/communities/create');
    fireEvent.change(screen.getByRole('textbox', { name: 'Community name' }), { target: { value: 'No' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create community' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('at least');
    expect(communityApi.create).not.toHaveBeenCalled();
  });
  it('joins public communities and shows private pending state', async () => {
    renderRoute('/app/communities/react-professionals');
    fireEvent.click(await screen.findByRole('button', { name: 'Join community' }));
    await waitFor(() => expect(communityApi.join).toHaveBeenCalledWith(id, expect.anything()));
    cleanup();
    detail = {
      ...detail,
      visibility: 'PRIVATE',
      description: null,
      tags: [],
      rules: null,
      owner: null,
      membershipStatus: 'PENDING'
    };
    renderRoute('/app/communities/react-professionals');
    expect(await screen.findByText('Request pending')).toBeTruthy();
    expect(screen.queryByText('Stay on topic.')).toBeNull();
  });
  it('lets active members leave and keeps unauthorized settings closed', async () => {
    detail = {
      ...detail,
      membershipStatus: 'ACTIVE',
      myRole: 'MEMBER',
      permissions: { ...permissions, viewMembers: true }
    };
    renderRoute('/app/communities/react-professionals');
    fireEvent.click(await screen.findByRole('button', { name: 'Leave community' }));
    await waitFor(() => expect(communityApi.leave).toHaveBeenCalledWith(id, expect.anything()));
    cleanup();
    renderRoute('/app/communities/react-professionals/settings');
    expect(await screen.findByText('You cannot edit this community.')).toBeTruthy();
  });
  it('shows directory and permits manager role changes', async () => {
    detail = {
      ...detail,
      membershipStatus: 'ACTIVE',
      myRole: 'OWNER',
      permissions: { ...permissions, viewMembers: true, manageRoles: true, removeMembers: true }
    };
    renderRoute('/app/communities/react-professionals/members');
    expect(await screen.findByRole('link', { name: 'Sam Member' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Role for Sam Member' }), {
      target: { value: 'MODERATOR' }
    });
    await waitFor(() => expect(communityApi.role).toHaveBeenCalledWith(id, member.userId, 'MODERATOR'));
  });
  it('reviews pending membership requests', async () => {
    detail = {
      ...detail,
      membershipStatus: 'ACTIVE',
      myRole: 'MODERATOR',
      permissions: { ...permissions, viewMembers: true, reviewRequests: true }
    };
    renderRoute('/app/communities/react-professionals/requests');
    expect(await screen.findByRole('link', { name: 'Sam Member' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(communityApi.decide).toHaveBeenCalledWith(id, 'c'.repeat(24), true));
  });
  it('saves settings and exposes ownership controls only to owner', async () => {
    detail = {
      ...detail,
      membershipStatus: 'ACTIVE',
      myRole: 'OWNER',
      permissions: {
        ...permissions,
        viewMembers: true,
        editDetails: true,
        transferOwnership: true,
        archive: true
      }
    };
    renderRoute('/app/communities/react-professionals/settings');
    expect(await screen.findByRole('heading', { name: 'Community settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Transfer ownership' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'A revised professional community.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(communityApi.update).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ description: 'A revised professional community.' })
      )
    );
  });
  it('shows joined communities from API in the existing sidebar', async () => {
    vi.mocked(communityApi.mine).mockResolvedValue(
      page([{ ...summary, membershipStatus: 'ACTIVE', myRole: 'MEMBER' }])
    );
    renderRoute('/app', true);
    const sidebar = screen.getByRole('complementary', { name: 'Your account and communities' });
    expect(await within(sidebar).findByRole('link', { name: 'React Professionals' })).toBeTruthy();
  });
});
