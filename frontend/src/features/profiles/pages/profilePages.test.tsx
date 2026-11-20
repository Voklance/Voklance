// @vitest-environment jsdom
import type {
  AuthUser,
  CatalogItem,
  ProfessionalProfile,
  ProfessionalExperience,
  Education
} from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/features/auth/cache/authCache';
import { onboardingApi } from '@/features/onboarding/api/onboardingApi';
import { onboardingKeys } from '@/features/onboarding/hooks/useOnboarding';
import ProfileSidebar from '@/components/shared/ProfileSidebar';
import SideNavigation from '@/components/navigation/SideNavigation';
import { profileApi } from '../api/profileApi';
import { communityApi } from '@/features/communities/api/communityApi';
import { connectionApi } from '@/features/connections/api/connectionApi';
import { messagingApi } from '@/features/messaging/api/messagingApi';
import { githubApi } from '@/features/github/api/githubApi';
import { portfolioApi } from '../api/portfolioApi';
import MyProfilePage from './MyProfilePage';
import EditProfilePage from './EditProfilePage';
import PublicProfilePage from './PublicProfilePage';

vi.mock('../api/profileApi', () => ({
  profileApi: {
    own: vi.fn(),
    save: vi.fn(),
    skills: vi.fn(),
    saveSkills: vi.fn(),
    interests: vi.fn(),
    experiences: vi.fn(),
    educations: vi.fn(),
    public: vi.fn()
  }
}));
vi.mock('@/features/onboarding/api/onboardingApi', () => ({
  onboardingApi: {
    skills: vi.fn(),
    createSkill: vi.fn(),
    addExperience: vi.fn(),
    editExperience: vi.fn(),
    removeExperience: vi.fn(),
    addEducation: vi.fn(),
    editEducation: vi.fn(),
    removeEducation: vi.fn()
  }
}));
vi.mock('@/features/communities/api/communityApi', () => ({ communityApi: { mine: vi.fn() } }));
vi.mock('@/features/connections/api/connectionApi', () => ({
  connectionApi: { counts: vi.fn(), statusByUsername: vi.fn(), send: vi.fn(), visible: vi.fn() }
}));
vi.mock('@/features/messaging/api/messagingApi', () => ({ messagingApi: { unreadCount: vi.fn() } }));
vi.mock('@/features/github/api/githubApi', () => ({ githubApi: { featured: vi.fn(), portfolio: vi.fn() } }));
vi.mock('../api/portfolioApi', () => ({
  portfolioApi: { certifications: vi.fn(), projects: vi.fn(), completeness: vi.fn() }
}));

const user: AuthUser = {
  id: 'a'.repeat(24),
  name: 'Ada Developer',
  email: 'ada@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};
const profile: ProfessionalProfile = {
  id: 'b'.repeat(24),
  username: 'ada-dev',
  fullName: 'Ada Developer',
  headline: 'Software Engineer',
  bio: 'I build useful software.',
  country: 'India',
  city: 'Pune',
  githubUrl: 'https://github.com/ada-dev',
  visibility: 'PUBLIC'
};
const typescript: CatalogItem = {
  id: 'c'.repeat(24),
  name: 'TypeScript',
  slug: 'typescript',
  category: 'Engineering'
};
const python: CatalogItem = { id: 'd'.repeat(24), name: 'Python', slug: 'python', category: 'Engineering' };
let experiences: ProfessionalExperience[] = [];
let education: Education[] = [];

function renderPage(path: string, includeShell = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  client.setQueryData(currentUserKey, user);
  client.setQueryData(onboardingKeys.profile, { profile });
  client.setQueryData(onboardingKeys.selectedSkills, { skills: [typescript] });
  client.setQueryData(onboardingKeys.selectedInterests, { interests: [] });
  client.setQueryData(onboardingKeys.experiences, { experiences });
  client.setQueryData(onboardingKeys.educations, { educations: education });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {includeShell && (
          <>
            <SideNavigation onSignOut={() => {}} signingOut={false} />
            <ProfileSidebar user={user} />
          </>
        )}
        <Routes>
          <Route path="/app/profile" element={<MyProfilePage />} />
          <Route path="/app/profile/edit" element={<EditProfilePage />} />
          <Route path="/app/professionals/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(communityApi.mine).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(connectionApi.counts).mockResolvedValue({ counts: { connections: 0, incoming: 0, sent: 0 } });
  vi.mocked(messagingApi.unreadCount).mockResolvedValue({ count: 0 });
  vi.mocked(githubApi.featured).mockResolvedValue({ connected: false, repositories: [] });
  vi.mocked(githubApi.portfolio).mockResolvedValue({ connected: false, repositories: [] });
  vi.mocked(portfolioApi.certifications).mockResolvedValue({ items: [] });
  vi.mocked(portfolioApi.projects).mockResolvedValue({ items: [] });
  vi.mocked(portfolioApi.completeness).mockResolvedValue({
    percentage: 40,
    completedSections: ['Basic profile'],
    suggestedSections: []
  });
  vi.mocked(connectionApi.statusByUsername).mockResolvedValue({
    status: 'none',
    requestId: null,
    connectionCount: null,
    isSelf: false
  });
  vi.mocked(connectionApi.send).mockResolvedValue({
    connection: {
      id: 'f'.repeat(24),
      status: 'pending',
      requesterId: user.id,
      recipientId: 'e'.repeat(24),
      requestedAt: new Date().toISOString(),
      respondedAt: null
    }
  });
  vi.mocked(connectionApi.visible).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  experiences = [];
  education = [];
  vi.mocked(profileApi.own).mockResolvedValue({ profile });
  vi.mocked(profileApi.skills).mockResolvedValue({ skills: [typescript] });
  vi.mocked(profileApi.interests).mockResolvedValue({ interests: [] });
  vi.mocked(profileApi.experiences).mockImplementation(async () => ({ experiences: [...experiences] }));
  vi.mocked(profileApi.educations).mockImplementation(async () => ({ educations: [...education] }));
  vi.mocked(profileApi.save).mockResolvedValue({ profile });
  vi.mocked(profileApi.saveSkills).mockResolvedValue({ skills: [typescript, python] });
  vi.mocked(profileApi.public).mockResolvedValue({
    profile,
    skills: [typescript],
    experiences: [],
    education: []
  });
  vi.mocked(onboardingApi.skills).mockResolvedValue({
    items: [typescript, python],
    page: 1,
    limit: 50,
    total: 2
  });
  vi.mocked(onboardingApi.addExperience).mockImplementation(async (input) => {
    const item: ProfessionalExperience = {
      id: 'e'.repeat(24),
      jobTitle: input.jobTitle,
      companyName: input.companyName,
      startDate: input.startDate,
      isCurrent: input.isCurrent
    };
    experiences = [item];
    return { experience: item };
  });
  vi.mocked(onboardingApi.editExperience).mockImplementation(async (_id, input) => {
    experiences = experiences.map((item) => ({ ...item, ...input }) as ProfessionalExperience);
    return { experience: experiences[0] };
  });
  vi.mocked(onboardingApi.removeExperience).mockImplementation(async () => {
    experiences = [];
    return { data: { success: true, data: {}, message: '' } } as never;
  });
  vi.mocked(onboardingApi.addEducation).mockImplementation(async (input) => {
    const item: Education = {
      id: 'f'.repeat(24),
      institution: input.institution,
      startDate: input.startDate
    };
    education = [item];
    return { education: item };
  });
  vi.mocked(onboardingApi.editEducation).mockImplementation(async (_id, input) => {
    education = education.map((item) => ({ ...item, ...input }) as Education);
    return { education: education[0] };
  });
  vi.mocked(onboardingApi.removeEducation).mockImplementation(async () => {
    education = [];
    return { data: { success: true, data: {}, message: '' } } as never;
  });
});
afterEach(cleanup);

describe('professional profile screens', () => {
  it('shows public portfolio sections and an owner share link', async () => {
    vi.mocked(portfolioApi.projects).mockResolvedValue({
      items: [
        {
          id: '1'.repeat(24),
          title: 'Accessibility toolkit',
          description: 'A toolkit for accessible interfaces.',
          role: 'Maintainer',
          technologies: ['TypeScript'],
          projectUrl: 'https://example.test/toolkit',
          repositoryUrl: null,
          startDate: null,
          endDate: null,
          isOngoing: false,
          isFeatured: true,
          displayOrder: 0
        }
      ]
    });
    vi.mocked(portfolioApi.certifications).mockResolvedValue({
      items: [
        {
          id: '2'.repeat(24),
          name: 'Cloud Engineer',
          issuingOrganization: 'Example Org',
          issueDate: '2024-05-01',
          expirationDate: null,
          credentialId: null,
          credentialUrl: 'https://example.test/cert'
        }
      ]
    });
    renderPage('/app/profile');
    expect(await screen.findByText('Accessibility toolkit')).toBeTruthy();
    expect(screen.getByText('Cloud Engineer')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View as visitor' }).getAttribute('href')).toBe('/u/ada-dev');
    expect(screen.getByRole('link', { name: 'Live project' })).toHaveProperty('rel', 'noopener noreferrer');
  });
  it('renders saved owner details and real sidebar navigation', () => {
    renderPage('/app/profile', true);
    expect(screen.getByRole('heading', { name: 'Ada Developer', level: 1 })).toBeTruthy();
    expect(screen.getByText('I build useful software.')).toBeTruthy();
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveProperty('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'View profile' })).toBeTruthy();
  });

  it('prefills the edit form and validates unsafe links', async () => {
    renderPage('/app/profile/edit');
    expect(await screen.findByDisplayValue('Software Engineer')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByText('Enter a secure HTTPS URL.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('GitHub profile URL'), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByLabelText('GitHub profile URL').getAttribute('aria-invalid')).toBe('true');
    expect(profileApi.save).not.toHaveBeenCalled();
  });

  it('saves an edited profile and returns to the profile page', async () => {
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('Software Engineer');
    fireEvent.change(screen.getByLabelText(/Professional headline/), {
      target: { value: 'Principal Engineer' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(profileApi.save).toHaveBeenCalledWith(
        expect.objectContaining({ headline: 'Principal Engineer', visibility: 'PUBLIC' }),
        expect.anything()
      )
    );
    expect(await screen.findByText('Profile saved.')).toBeTruthy();
  });

  it('shows server username conflicts without discarding the draft', async () => {
    vi.mocked(profileApi.save).mockRejectedValue({
      response: { data: { error: { code: 'USERNAME_TAKEN', message: 'Taken' } } }
    });
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('ada-dev');
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('This username is already in use.')).toBeTruthy();
    expect(screen.getByDisplayValue('ada-dev')).toBeTruthy();
  });

  it('adds a skill through the reused catalog selector', async () => {
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('ada-dev');
    fireEvent.click(await screen.findByRole('checkbox', { name: /Python/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save skills' }));
    await waitFor(() =>
      expect(profileApi.saveSkills).toHaveBeenCalledWith(
        { skillIds: [typescript.id, python.id] },
        expect.anything()
      )
    );
    expect(await screen.findByText('Skills saved.')).toBeTruthy();
  });

  it('supports experience and education creation through existing APIs', async () => {
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('ada-dev');
    const experienceSection = screen.getByRole('region', { name: 'Professional Experience' });
    const educationSection = screen.getByRole('region', { name: 'Education' });
    expect(
      experienceSection.compareDocumentPosition(educationSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Engineer' } });
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example' } });
    fireEvent.change(screen.getByLabelText('Experience start date'), { target: { value: '2024-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit experience' }));
    await waitFor(() => expect(onboardingApi.addExperience).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Add Experience' })).toBeTruthy();
    expect(screen.queryByLabelText('Job title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Experience' }));
    expect(screen.getByLabelText('Job title')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Professional Experience' })).getByRole('button', {
        name: 'Cancel'
      })
    );
    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'University' } });
    fireEvent.change(screen.getByLabelText('Education start date'), { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit education' }));
    await waitFor(() => expect(onboardingApi.addEducation).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Add Education' })).toBeTruthy();
    expect(screen.queryByLabelText('Institution')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Education' }));
    expect(screen.getByLabelText('Institution')).toBeTruthy();
  });

  it('edits experience and requires confirmation before removal', async () => {
    experiences = [
      {
        id: 'e'.repeat(24),
        jobTitle: 'Engineer',
        companyName: 'Example',
        startDate: '2024-01-01',
        isCurrent: true
      }
    ];
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('ada-dev');
    const section = screen.getByRole('region', { name: 'Professional Experience' });
    expect(within(section).getByText('Jan 2024 – Present')).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: 'Edit Engineer' }));
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Senior Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save experience' }));
    await waitFor(() => expect(onboardingApi.editExperience).toHaveBeenCalled());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Senior Engineer' }));
    expect(onboardingApi.removeExperience).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Senior Engineer' }));
    await waitFor(() => expect(onboardingApi.removeExperience).toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('edits education and requires confirmation before removal', async () => {
    education = [{ id: 'f'.repeat(24), institution: 'University', startDate: '2020-01-01' }];
    renderPage('/app/profile/edit');
    await screen.findByDisplayValue('ada-dev');
    const section = screen.getByRole('region', { name: 'Education' });
    expect(within(section).getByText('Jan 2020')).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: 'Edit University' }));
    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'New University' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save education' }));
    await waitFor(() => expect(onboardingApi.editEducation).toHaveBeenCalled());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove New University' }));
    await waitFor(() => expect(onboardingApi.removeEducation).toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('renders a public profile and handles missing profiles', async () => {
    renderPage('/app/professionals/ada-dev');
    expect(await screen.findByRole('heading', { name: 'Ada Developer' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(connectionApi.send).toHaveBeenCalledWith({ recipientUsername: 'ada-dev' }, expect.anything())
    );
    cleanup();
    vi.mocked(profileApi.public).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderPage('/app/professionals/missing-user');
    expect(await screen.findByText('This professional profile is unavailable.')).toBeTruthy();
  });
});
