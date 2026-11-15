// @vitest-environment jsdom
import type { CommunityDetail, ReferralOpportunity, ReferralNeed, ReferralApplication, ReferralOffer } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityApi } from '@/features/communities/api/communityApi';
import { referralApi } from '../api/referralApi';
import CommunityReferralBoard from '../components/CommunityReferralBoard';
import MyReferralsPage from './MyReferralsPage';
import ReferralOpportunityPage from './ReferralOpportunityPage';
import ReferralNeedPage from './ReferralNeedPage';

vi.mock('@/features/communities/api/communityApi', () => ({ communityApi: { detail: vi.fn() } }));
vi.mock('../api/referralApi', () => ({ referralApi: {
  communityOpportunities: vi.fn(), communityNeeds: vi.fn(), opportunity: vi.fn(), need: vi.fn(),
  applications: vi.fn(), offers: vi.fn(), apply: vi.fn(), offer: vi.fn(), applicationStatus: vi.fn(), offerStatus: vi.fn(),
  updateOpportunity: vi.fn(), updateNeed: vi.fn(), closeOpportunity: vi.fn(), closeNeed: vi.fn(), fulfillNeed: vi.fn(),
  myOpportunities: vi.fn(), myNeeds: vi.fn(), myApplications: vi.fn(), myOffers: vi.fn()
} }));
const id = 'a'.repeat(24);
const opportunityId = 'b'.repeat(24);
const needId = 'c'.repeat(24);
const author = { name: 'Ada Referrer', username: 'ada', headline: 'Engineer' };
const communityRef = { id, slug: 'referral-guild', name: 'Referral Guild' };
const community: CommunityDetail = { id, slug: communityRef.slug, name: communityRef.name, description: 'A professional community.', category: 'software-development', tags: [], visibility: 'PUBLIC', status: 'ACTIVE', memberCount: 3, membershipStatus: 'ACTIVE', myRole: 'MEMBER', createdAt: '2026-11-15T00:00:00.000Z', rules: '', owner: null, permissions: { viewMembers: true, reviewRequests: false, editDetails: false, manageRoles: false, removeMembers: false, transferOwnership: false, archive: false } };
const opportunity: ReferralOpportunity = { id: opportunityId, community: communityRef, author, details: { jobTitle: 'Frontend Engineer', company: 'Example Co', location: 'Pune', workMode: 'hybrid', jobUrl: 'https://example.com/jobs/1', description: 'A frontend engineering opportunity.', experienceMin: 2, experienceMax: 4, requiredSkills: ['React'] }, status: 'OPEN', createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z', ownedByMe: false, myApplication: null };
const need: ReferralNeed = { id: needId, community: communityRef, author, details: { jobTitle: 'Backend Engineer', company: 'Example Co', experienceLevel: 'mid', message: 'I would appreciate a referral for this role.', skills: ['Node.js'] }, status: 'OPEN', createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z', ownedByMe: false, myOffer: null };
const application: ReferralApplication = { id: 'd'.repeat(24), opportunityId, applicant: { name: 'Sam Applicant', username: 'sam', headline: 'Frontend developer' }, introduction: 'I have relevant frontend engineering experience.', relevantSkills: ['React'], portfolioUrl: 'https://example.com/portfolio', status: 'REQUESTED', createdAt: '2026-11-15T11:00:00.000Z', updatedAt: '2026-11-15T11:00:00.000Z' };
const offer: ReferralOffer = { id: 'e'.repeat(24), needId, helper: { name: 'Lee Helper', username: 'lee', headline: 'Engineer' }, introduction: 'I can help with this professional referral.', offerDetails: 'I can submit a referral through our employee portal.', employerRelationship: 'I work at Example Co', status: 'OFFERED', createdAt: '2026-11-15T11:00:00.000Z', updatedAt: '2026-11-15T11:00:00.000Z' };
const page = <T,>(items: T[], nextCursor: string | null = null) => ({ items, nextCursor, hasMore: !!nextCursor });
function mount(path: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={path.includes('/opportunities/') ? '/app/referrals/opportunities/:opportunityId' : '/app/referrals/needs/:needId'} element={element} /></Routes></MemoryRouter></QueryClientProvider>);
}
function mountStandalone(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(communityApi.detail).mockResolvedValue({ community });
  vi.mocked(referralApi.opportunity).mockResolvedValue({ opportunity });
  vi.mocked(referralApi.need).mockResolvedValue({ need });
  vi.mocked(referralApi.applications).mockResolvedValue(page([]));
  vi.mocked(referralApi.offers).mockResolvedValue(page([]));
  vi.mocked(referralApi.apply).mockResolvedValue({ application });
  vi.mocked(referralApi.offer).mockResolvedValue({ offer });
  vi.mocked(referralApi.applicationStatus).mockResolvedValue({ application: { ...application, status: 'ACCEPTED' } });
  vi.mocked(referralApi.offerStatus).mockResolvedValue({ offer: { ...offer, status: 'ACCEPTED' } });
  vi.mocked(referralApi.communityOpportunities).mockResolvedValue(page([]));
  vi.mocked(referralApi.communityNeeds).mockResolvedValue(page([]));
  vi.mocked(referralApi.myOpportunities).mockResolvedValue(page([]));
  vi.mocked(referralApi.myNeeds).mockResolvedValue(page([]));
  vi.mocked(referralApi.myApplications).mockResolvedValue(page([]));
  vi.mocked(referralApi.myOffers).mockResolvedValue(page([]));
});
afterEach(cleanup);

describe('referral UI', () => {
  it('renders opportunity details, validates a private request, and submits the structured application', async () => {
    vi.mocked(referralApi.opportunity).mockResolvedValueOnce({ opportunity }).mockResolvedValue({ opportunity: { ...opportunity, myApplication: application } });
    mount(`/app/referrals/opportunities/${opportunityId}`, <ReferralOpportunityPage />);
    expect(await screen.findByRole('heading', { name: 'Frontend Engineer' })).toBeTruthy();
    expect(screen.getByText('2–4 years')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Request referral' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText(/at least|Too small/i)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Professional introduction/ }), { target: { value: application.introduction } });
    fireEvent.change(screen.getByRole('textbox', { name: /Relevant skills/ }), { target: { value: 'React' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Portfolio or GitHub/ }), { target: { value: application.portfolioUrl } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(referralApi.apply).toHaveBeenCalledWith(opportunityId, expect.objectContaining({ relevantSkills: ['React'] })));
    expect(await screen.findByRole('heading', { name: 'Your request' })).toBeTruthy();
  });
  it('shows owner review controls while hiding private applicants from unrelated viewers', async () => {
    vi.mocked(referralApi.opportunity).mockResolvedValue({ opportunity: { ...opportunity, ownedByMe: true } });
    vi.mocked(referralApi.applications).mockResolvedValue(page([application]));
    mount(`/app/referrals/opportunities/${opportunityId}`, <ReferralOpportunityPage />);
    expect(await screen.findByText('Sam Applicant')).toBeTruthy();
    expect(screen.getByText(application.introduction)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'accepted' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'accepted' }));
    await waitFor(() => expect(referralApi.applicationStatus).toHaveBeenCalledWith(application.id, 'ACCEPTED'));
    expect(screen.queryByRole('button', { name: 'Request referral' })).toBeNull();
  });
  it('renders need details and submits a structured offer', async () => {
    vi.mocked(referralApi.need).mockResolvedValueOnce({ need }).mockResolvedValue({ need: { ...need, myOffer: offer } });
    mount(`/app/referrals/needs/${needId}`, <ReferralNeedPage />);
    expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Offer referral' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Professional introduction/ }), { target: { value: offer.introduction } });
    fireEvent.change(screen.getByRole('textbox', { name: /Offer details/ }), { target: { value: offer.offerDetails } });
    fireEvent.click(screen.getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(referralApi.offer).toHaveBeenCalledWith(needId, expect.objectContaining({ offerDetails: offer.offerDetails })));
    expect(await screen.findByRole('heading', { name: 'Your offer' })).toBeTruthy();
  });
  it('hides response actions from nonmembers and shows existing participant status', async () => {
    vi.mocked(communityApi.detail).mockResolvedValue({ community: { ...community, membershipStatus: null } });
    mount(`/app/referrals/opportunities/${opportunityId}`, <ReferralOpportunityPage />);
    expect(await screen.findByText('Join this community to request a referral.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Request referral' })).toBeNull();
    cleanup();
    vi.mocked(referralApi.opportunity).mockResolvedValue({ opportunity: { ...opportunity, myApplication: { ...application, status: 'ACCEPTED' } } });
    mount(`/app/referrals/opportunities/${opportunityId}`, <ReferralOpportunityPage />);
    expect(await screen.findByRole('heading', { name: 'Your request' })).toBeTruthy();
    expect(screen.getByText(/Accepted means/)).toBeTruthy();
  });
  it('renders dashboard sections, real statuses, community links, and pagination', async () => {
    vi.mocked(referralApi.myOpportunities).mockResolvedValueOnce(page([opportunity], 'next')).mockResolvedValue(page([{ ...opportunity, id: 'f'.repeat(24) }]));
    vi.mocked(referralApi.myNeeds).mockResolvedValue(page([need]));
    vi.mocked(referralApi.myApplications).mockResolvedValue(page([{ response: application, target: opportunity }]));
    vi.mocked(referralApi.myOffers).mockResolvedValue(page([{ response: offer, target: need }]));
    mountStandalone(<MyReferralsPage />);
    expect(await screen.findByRole('heading', { name: 'My opportunities' })).toBeTruthy();
    expect(await screen.findByText('Referral Guild')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Offers I made' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(referralApi.myOpportunities).toHaveBeenCalledWith('next'));
  });
  it('filters community referrals and loads another page', async () => {
    vi.mocked(referralApi.communityOpportunities).mockResolvedValueOnce(page([opportunity], 'next')).mockResolvedValue(page([{ ...opportunity, id: 'f'.repeat(24) }]));
    vi.mocked(referralApi.communityNeeds).mockResolvedValue(page([need]));
    mountStandalone(<CommunityReferralBoard communityId={id} />);
    expect(await screen.findByRole('heading', { name: 'Frontend Engineer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more opportunities' }));
    await waitFor(() => expect(referralApi.communityOpportunities).toHaveBeenCalledWith(id, 'next', undefined));
    fireEvent.change(screen.getByRole('combobox', { name: 'Show opportunities' }), { target: { value: 'CLOSED' } });
    await waitFor(() => expect(referralApi.communityOpportunities).toHaveBeenCalledWith(id, '', 'CLOSED'));
  });
  it('shows empty and error states for referral lists', async () => {
    vi.mocked(referralApi.myOffers).mockRejectedValueOnce(new Error('offline'));
    mountStandalone(<MyReferralsPage />);
    expect(await screen.findByText('No my opportunities yet.')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
