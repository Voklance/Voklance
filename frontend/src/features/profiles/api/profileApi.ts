import type { ApiSuccess, PublicProfileResponseData } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
import { onboardingApi } from '@/features/onboarding/api/onboardingApi';

export const profileApi = {
  own: onboardingApi.profile,
  save: onboardingApi.saveProfile,
  skills: onboardingApi.selectedSkills,
  saveSkills: onboardingApi.saveSkills,
  interests: onboardingApi.selectedInterests,
  experiences: onboardingApi.experiences,
  educations: onboardingApi.educations,
  async public(username: string) {
    const response = await apiClient.get<ApiSuccess<PublicProfileResponseData>>(
      `/profiles/public/${encodeURIComponent(username)}`
    );
    return response.data.data;
  }
};
