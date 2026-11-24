import type {
  ApiSuccess,
  CatalogItem,
  CatalogPage,
  EducationCreateRequest,
  EducationPatchRequest,
  EducationResponseData,
  EducationsResponseData,
  ExperienceCreateRequest,
  ExperiencePatchRequest,
  ExperienceResponseData,
  ExperiencesResponseData,
  InterestSelectionRequest,
  InterestsResponseData,
  OnboardingIdentityRequest,
  OnboardingProgressRequest,
  OnboardingResponseData,
  ProfilePatchRequest,
  ProfileResponseData,
  SkillSelectionRequest,
  SkillsResponseData,
  UsernameAvailabilityData
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}

export const onboardingApi = {
  progress: () => data<OnboardingResponseData>(apiClient.get('/onboarding')),
  saveProgress: (input: OnboardingProgressRequest) =>
    data<OnboardingResponseData>(apiClient.patch('/onboarding', input)),
  complete: () => data<OnboardingResponseData>(apiClient.post('/onboarding/complete', {})),
  saveIdentity: (input: OnboardingIdentityRequest) =>
    data<ProfileResponseData>(apiClient.patch('/onboarding/profile', input)),
  profile: () => data<ProfileResponseData>(apiClient.get('/profiles/me')),
  saveProfile: (input: ProfilePatchRequest) =>
    data<ProfileResponseData>(apiClient.patch('/profiles/me', input)),
  username: (username: string, signal?: AbortSignal) =>
    data<UsernameAvailabilityData>(
      apiClient.get('/profiles/check-username', { params: { username }, signal })
    ),
  skills: (search = '') => {
    const term = search.trim();
    return data<CatalogPage>(apiClient.get('/skills', { params: { search: term, limit: term ? 50 : 8 } }));
  },
  createSkill: (name: string) => data<{ skill: CatalogItem }>(apiClient.post('/skills', { name })),
  selectedSkills: () => data<SkillsResponseData>(apiClient.get('/users/me/skills')),
  saveSkills: (input: SkillSelectionRequest) =>
    data<SkillsResponseData>(apiClient.put('/users/me/skills', input)),
  interests: (search = '') => {
    const term = search.trim();
    return data<CatalogPage>(apiClient.get('/interests', { params: { search: term, limit: term ? 50 : 8 } }));
  },
  selectedInterests: () => data<InterestsResponseData>(apiClient.get('/users/me/interests')),
  saveInterests: (input: InterestSelectionRequest) =>
    data<InterestsResponseData>(apiClient.put('/users/me/interests', input)),
  experiences: () => data<ExperiencesResponseData>(apiClient.get('/users/me/experiences')),
  addExperience: (input: ExperienceCreateRequest) =>
    data<ExperienceResponseData>(apiClient.post('/users/me/experiences', input)),
  editExperience: (id: string, input: ExperiencePatchRequest) =>
    data<ExperienceResponseData>(apiClient.patch(`/users/me/experiences/${id}`, input)),
  removeExperience: (id: string) => apiClient.delete(`/users/me/experiences/${id}`),
  educations: () => data<EducationsResponseData>(apiClient.get('/users/me/educations')),
  addEducation: (input: EducationCreateRequest) =>
    data<EducationResponseData>(apiClient.post('/users/me/educations', input)),
  editEducation: (id: string, input: EducationPatchRequest) =>
    data<EducationResponseData>(apiClient.patch(`/users/me/educations/${id}`, input)),
  removeEducation: (id: string) => apiClient.delete(`/users/me/educations/${id}`)
};
