// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem, OnboardingSnapshot, ProfessionalProfile } from '@voklance/shared';
import { authApi } from '@/features/auth/api/authApi';
import { onboardingApi } from '../api/onboardingApi';
import OnboardingPage from './OnboardingPage';

vi.mock('../api/onboardingApi', () => ({
  onboardingApi: Object.fromEntries(
    [
      'progress',
      'saveProgress',
      'complete',
      'profile',
      'saveProfile',
      'saveIdentity',
      'skills',
      'createSkill',
      'selectedSkills',
      'saveSkills',
      'interests',
      'selectedInterests',
      'saveInterests',
      'experiences',
      'addExperience',
      'editExperience',
      'removeExperience',
      'educations',
      'addEducation',
      'editEducation',
      'removeEducation'
    ].map((name) => [name, vi.fn()])
  )
}));
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { currentUser: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }
}));

const skill: CatalogItem = {
  id: 'a'.repeat(24),
  name: 'TypeScript',
  slug: 'typescript',
  category: 'Technology'
};
const interest: CatalogItem = {
  id: 'b'.repeat(24),
  name: 'Career opportunities',
  slug: 'career',
  category: 'Career'
};
const profile: ProfessionalProfile = {
  id: 'c'.repeat(24),
  fullName: 'Sam Engineer',
  firstName: 'Sam',
  lastName: 'Engineer',
  username: 'sam.engineer',
  headline: 'Software engineer',
  country: 'India',
  professionalStatus: 'WORKING_PROFESSIONAL'
};
let snapshot: OnboardingSnapshot;

function setupSnapshot(step: OnboardingSnapshot['currentStep'] = 1) {
  snapshot = {
    status: 'IN_PROGRESS',
    currentStep: step,
    completedSteps:
      step > 1 ? ([1, 2, 3, 4, 5].filter((n) => n < step) as OnboardingSnapshot['completedSteps']) : [],
    profile: step > 1 ? profile : null,
    skills: step > 3 ? [skill] : [],
    interests: step > 5 ? [interest] : [],
    experiences: [],
    education: []
  };
  if (step === 3) snapshot.skills = [];
  if (step === 5) snapshot.interests = [];
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app" element={<h1>Application home</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSnapshot();
  vi.mocked(authApi.currentUser).mockImplementation(async () => ({
    id: 'e'.repeat(24),
    name: 'Sam Engineer',
    email: 'sam@example.test',
    accountStatus: 'ACTIVE',
    onboardingStatus: snapshot.status,
    emailVerifiedAt: new Date().toISOString(),
    emailVerificationRequired: true
  }));
  vi.mocked(onboardingApi.progress).mockImplementation(async () => ({
    onboarding: structuredClone(snapshot)
  }));
  vi.mocked(onboardingApi.profile).mockImplementation(async () => ({ profile: snapshot.profile }));
  vi.mocked(onboardingApi.selectedSkills).mockImplementation(async () => ({ skills: snapshot.skills }));
  vi.mocked(onboardingApi.selectedInterests).mockImplementation(async () => ({
    interests: snapshot.interests
  }));
  vi.mocked(onboardingApi.experiences).mockResolvedValue({ experiences: [] });
  vi.mocked(onboardingApi.educations).mockResolvedValue({ educations: [] });
  vi.mocked(onboardingApi.skills).mockResolvedValue({ items: [skill], page: 1, limit: 50, total: 1 });
  vi.mocked(onboardingApi.createSkill).mockImplementation(async (name) => ({
    skill: { id: 'f'.repeat(24), name, slug: 'community-skill', category: 'Community' }
  }));
  vi.mocked(onboardingApi.interests).mockResolvedValue({ items: [interest], page: 1, limit: 50, total: 1 });
  vi.mocked(onboardingApi.saveIdentity).mockImplementation(async (input) => {
    snapshot.profile = {
      ...profile,
      ...snapshot.profile,
      ...input,
      headline: input.headline || '',
      fullName: `${input.firstName} ${input.lastName}`
    };
    return { profile: snapshot.profile };
  });
  vi.mocked(onboardingApi.saveProfile).mockImplementation(async (input) => {
    snapshot.profile = { ...profile, ...snapshot.profile, ...input };
    return { profile: snapshot.profile };
  });
  vi.mocked(onboardingApi.saveSkills).mockImplementation(async ({ skillIds }) => {
    snapshot.skills = skillIds.length ? [skill] : [];
    return { skills: snapshot.skills };
  });
  vi.mocked(onboardingApi.saveInterests).mockImplementation(async ({ interestIds }) => {
    snapshot.interests = interestIds.length ? [interest] : [];
    return { interests: snapshot.interests };
  });
  vi.mocked(onboardingApi.saveProgress).mockImplementation(async ({ currentStep }) => {
    snapshot.currentStep = currentStep;
    return { onboarding: structuredClone(snapshot) };
  });
  vi.mocked(onboardingApi.complete).mockImplementation(async () => {
    snapshot.status = 'COMPLETED';
    return { onboarding: structuredClone(snapshot) };
  });
});
afterEach(cleanup);

describe('onboarding wizard', () => {
  it('shows only the requested fields and marks valid names complete', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your profile' });
    const name = screen.getByLabelText('First name');
    fireEvent.blur(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter your first name.')).toBeTruthy();

    fireEvent.change(name, { target: { value: 'Sam' } });
    expect(name.getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByRole('img', { name: 'First name complete' })).toBeTruthy();
    expect(screen.getByLabelText('Last name')).toBeTruthy();
    expect(screen.getByLabelText('Professional headline').hasAttribute('required')).toBe(false);
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.queryByLabelText('Country')).toBeNull();
  });

  it('fills only the current progress segment as required fields are completed', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your profile' });
    const steps = screen.getByRole('navigation', { name: 'Onboarding steps' });
    const segmentWidth = (name: string) =>
      within(steps).getByRole('button', { name }).querySelector<HTMLElement>('.onboarding-progress-fill')
        ?.style.width;

    expect(segmentWidth('1. Your profile')).toBe('0%');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Sam' } });
    expect(segmentWidth('1. Your profile')).toBe('50%');
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Engineer' } });
    expect(segmentWidth('1. Your profile')).toBe('100%');
    expect(segmentWidth('2. Professional status')).toBe('0%');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Professional status' });
    expect(segmentWidth('1. Your profile')).toBe('100%');
    expect(segmentWidth('2. Professional status')).toBe('0%');
    fireEvent.click(screen.getByLabelText('Student'));
    expect(segmentWidth('2. Professional status')).toBe('100%');
    expect(segmentWidth('3. Skills')).toBe('0%');
  });

  it('does not fill an empty optional section when the user moves past it', async () => {
    setupSnapshot(4);
    renderPage();
    await screen.findByRole('heading', { name: 'Experience & education' });
    const steps = screen.getByRole('navigation', { name: 'Onboarding steps' });
    const historyBar = within(steps)
      .getByRole('button', { name: '4. Experience & education' })
      .querySelector<HTMLElement>('.onboarding-progress-fill');
    expect(historyBar?.style.width).toBe('0%');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Interests' });
    expect(historyBar?.style.width).toBe('0%');
  });

  it('renders progress and validates the basic profile before saving', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your profile' });
    expect(screen.getByRole('navigation', { name: 'Onboarding steps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1. Your profile' }).getAttribute('aria-current')).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter your first name.')).toBeTruthy();
    expect(onboardingApi.saveIdentity).not.toHaveBeenCalled();
  });

  it('requires a last name but allows an empty headline', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your profile' });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter your last name.')).toBeTruthy();
    expect(onboardingApi.saveIdentity).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Professional status' });
    expect(onboardingApi.saveIdentity).toHaveBeenCalledWith(
      { firstName: 'Sam', lastName: 'Engineer', headline: '' },
      expect.anything()
    );
  });

  it('saves profile and status, then moves forward and backward', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your profile' });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Engineer' } });
    fireEvent.change(screen.getByLabelText('Professional headline'), { target: { value: 'Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Professional status' });
    fireEvent.click(screen.getByLabelText('Student'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Skills' });
    await waitFor(() =>
      expect(onboardingApi.saveProfile).toHaveBeenCalledWith(
        { professionalStatus: 'STUDENT' },
        expect.anything()
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByRole('heading', { name: 'Professional status' });
  });

  it('loads searchable skills, saves a selection, and keeps it on failed save', async () => {
    setupSnapshot(3);
    renderPage();
    await screen.findByRole('heading', { name: 'Skills' });
    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'Type' } });
    await waitFor(() => expect(onboardingApi.skills).toHaveBeenCalledWith('Type'));
    fireEvent.click(await screen.findByRole('checkbox', { name: /TypeScript/ }));
    vi.mocked(onboardingApi.saveSkills).mockRejectedValueOnce(new Error('Save failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove TypeScript' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Experience & education' });
    expect(onboardingApi.saveSkills).toHaveBeenCalledTimes(2);
  });

  it('shows a short skills list until a backend search returns matches', async () => {
    setupSnapshot(3);
    const suggested = Array.from({ length: 8 }, (_, index) => ({
      id: String(index + 1).repeat(24),
      name: `Suggested skill ${index + 1}`,
      slug: `suggested-skill-${index + 1}`,
      category: 'Programming'
    }));
    vi.mocked(onboardingApi.skills).mockImplementation(async (search) => ({
      items: search ? [skill] : suggested,
      page: 1,
      limit: search ? 50 : 8,
      total: search ? 1 : 170
    }));
    renderPage();
    await screen.findByRole('heading', { name: 'Skills' });
    const available = await screen.findByRole('group', { name: 'Available skills' });
    await within(available).findByRole('checkbox', { name: /Suggested skill 1/ });
    expect(within(available).getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByText('Showing 8 suggested skills. Search to find more.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'Type' } });
    expect(screen.queryByRole('group', { name: 'Available skills' })).toBeNull();
    await within(await screen.findByRole('group', { name: 'Available skills' })).findByRole('checkbox', {
      name: /TypeScript/
    });
    expect(onboardingApi.skills).toHaveBeenCalledWith('Type');
    expect(
      within(screen.getByRole('group', { name: 'Available skills' })).getAllByRole('checkbox')
    ).toHaveLength(1);
  });

  it('lets a user add a missing skill and save it during onboarding', async () => {
    setupSnapshot(3);
    vi.mocked(onboardingApi.skills).mockImplementation(async (search) => ({
      items: search ? [] : [skill],
      page: 1,
      limit: 50,
      total: search ? 0 : 1
    }));
    renderPage();
    await screen.findByRole('heading', { name: 'Skills' });
    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'Quantum Robotics' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Add “Quantum Robotics” as a skill' }));
    expect(await screen.findByRole('button', { name: 'Remove Quantum Robotics' })).toBeTruthy();
    expect(onboardingApi.createSkill).toHaveBeenCalledWith('Quantum Robotics', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Experience & education' });
    expect(onboardingApi.saveSkills).toHaveBeenCalledWith({ skillIds: ['f'.repeat(24)] }, expect.anything());
  });

  it('validates experience and education dates and blocks navigation with an unsaved draft', async () => {
    setupSnapshot(4);
    renderPage();
    await screen.findByRole('heading', { name: 'Experience & education' });
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Engineer' } });
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example Co' } });
    fireEvent.change(screen.getByLabelText('Experience start date'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/Experience end date/), { target: { value: '2024-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit experience' }));
    expect(await screen.findByText('End date must follow start date.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Save or cancel the open experience or education form before continuing.')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear form' }));
    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'Example University' } });
    fireEvent.change(screen.getByLabelText('Education start date'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/Education end date/), { target: { value: '2024-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit education' }));
    expect(screen.getAllByText('End date must follow start date.').length).toBeGreaterThan(0);
  });

  it('creates, edits, and removes history records through the API', async () => {
    setupSnapshot(4);
    let rows: OnboardingSnapshot['experiences'] = [];
    vi.mocked(onboardingApi.experiences).mockImplementation(async () => ({ experiences: [...rows] }));
    vi.mocked(onboardingApi.addExperience).mockImplementation(async (input) => {
      const record = {
        id: 'd'.repeat(24),
        jobTitle: input.jobTitle,
        companyName: input.companyName,
        startDate: input.startDate,
        isCurrent: input.isCurrent
      };
      rows = [record];
      return { experience: record };
    });
    vi.mocked(onboardingApi.editExperience).mockImplementation(async (_id, input) => {
      rows = [{ ...rows[0], ...input, endDate: undefined } as OnboardingSnapshot['experiences'][number]];
      return { experience: rows[0] };
    });
    vi.mocked(onboardingApi.removeExperience).mockImplementation(async () => {
      rows = [];
      return { data: { success: true, data: {}, message: 'Removed' } } as Awaited<
        ReturnType<typeof onboardingApi.removeExperience>
      >;
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Experience & education' });
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Engineer' } });
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example Co' } });
    fireEvent.change(screen.getByLabelText('Experience start date'), { target: { value: '2025-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit experience' }));
    await waitFor(() => expect(onboardingApi.addExperience).toHaveBeenCalledTimes(1));
    await screen.findByText('Engineer');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Engineer' }));
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Senior engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save experience' }));
    await waitFor(() => expect(onboardingApi.editExperience).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Senior engineer' }));
    await waitFor(() =>
      expect(onboardingApi.removeExperience).toHaveBeenCalledWith('d'.repeat(24), expect.anything())
    );
  });

  it('restores the interests step, saves a selection, and shows review', async () => {
    setupSnapshot(5);
    renderPage();
    await screen.findByRole('heading', { name: 'Interests' });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Career opportunities/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Review' });
    expect(screen.getByText('Your personal information')).toBeTruthy();
    expect(screen.getByText('Your current work status')).toBeTruthy();
    const review = screen.getByRole('heading', { name: 'Interests', level: 2 }).closest('section');
    expect(review && within(review).getByText('Career opportunities')).toBeTruthy();
    expect(onboardingApi.saveInterests).toHaveBeenCalledWith(
      { interestIds: [interest.id] },
      expect.anything()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    await screen.findByRole('heading', { name: 'Interests', level: 1 });
  });

  it('shows a short interests list and searches the backend catalog for more', async () => {
    setupSnapshot(5);
    const initial = Array.from({ length: 8 }, (_, index) => ({
      id: String(index + 1).repeat(24),
      name: `Interest ${index + 1}`,
      slug: `interest-${index + 1}`,
      category: 'Technology'
    }));
    const mentorship: CatalogItem = {
      id: '9'.repeat(24),
      name: 'Mentorship',
      slug: 'mentorship',
      category: 'Career'
    };
    vi.mocked(onboardingApi.interests).mockImplementation(async (search) => ({
      items: search ? [mentorship] : initial,
      page: 1,
      limit: search ? 50 : 8,
      total: search ? 1 : 120
    }));
    renderPage();
    await screen.findByRole('heading', { name: 'Interests' });
    const available = await screen.findByRole('group', { name: 'Available interests' });
    await within(available).findByRole('checkbox', { name: /Interest 1/ });
    expect(within(available).getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByText('Showing 8 interests. Search to find more.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search interests'), { target: { value: 'Mentor' } });
    expect(screen.queryByRole('group', { name: 'Available interests' })).toBeNull();
    await within(await screen.findByRole('group', { name: 'Available interests' })).findByRole('checkbox', {
      name: /Mentorship/
    });
    expect(onboardingApi.interests).toHaveBeenCalledWith('Mentor');
    expect(
      within(screen.getByRole('group', { name: 'Available interests' })).getAllByRole('checkbox')
    ).toHaveLength(1);
  });

  it('only redirects after confirmed completion and prevents duplicate requests', async () => {
    setupSnapshot(6);
    renderPage();
    await screen.findByRole('heading', { name: 'Review' });
    const button = screen.getByRole('button', { name: 'Complete onboarding' });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Application home' });
    expect(onboardingApi.complete).toHaveBeenCalledTimes(1);
  });

  it('keeps the review visible when completion fails', async () => {
    setupSnapshot(6);
    vi.mocked(onboardingApi.complete).mockRejectedValueOnce(new Error('Completion failed'));
    renderPage();
    await screen.findByRole('heading', { name: 'Review' });
    fireEvent.click(screen.getByRole('button', { name: 'Complete onboarding' }));
    expect(await screen.findByText('Completion failed')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Application home' })).toBeNull();
  });

  it('waits for current-user confirmation after backend completion', async () => {
    setupSnapshot(6);
    vi.mocked(authApi.currentUser).mockResolvedValueOnce({
      id: 'e'.repeat(24),
      name: 'Sam Engineer',
      email: 'sam@example.test',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'IN_PROGRESS',
      emailVerifiedAt: new Date().toISOString(),
      emailVerificationRequired: true
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Review' });
    fireEvent.click(screen.getByRole('button', { name: 'Complete onboarding' }));
    expect(
      await screen.findByText('Your completed account could not be confirmed. Please try again.')
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Application home' })).toBeNull();
  });

  it('shows a sign-in message when the onboarding session has expired', async () => {
    vi.mocked(onboardingApi.progress).mockRejectedValueOnce(
      Object.assign(new Error('Expired'), {
        isAxiosError: true,
        response: { status: 401 }
      })
    );
    renderPage();
    expect(await screen.findByText('Your session has expired. Sign in again to continue.')).toBeTruthy();
  });
});
