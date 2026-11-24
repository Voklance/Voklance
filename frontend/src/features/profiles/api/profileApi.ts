import type {
  ApiSuccess,
  ProfileRatingData,
  ProfileRatingSummary,
  PublicProfileResponseData
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
import { onboardingApi } from '@/features/onboarding/api/onboardingApi';

export const profileApi = {
  own: onboardingApi.profile,
  save: onboardingApi.saveProfile,
  async uploadAvatar(file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post<ApiSuccess<{ avatarUrl: string }>>('/profiles/me/avatar', form, {
      timeout: 60_000
    });
    return response.data.data;
  },
  async removeAvatar() {
    const response = await apiClient.delete<ApiSuccess<{ avatarUrl: null }>>('/profiles/me/avatar');
    return response.data.data;
  },
  async uploadCover(file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post<ApiSuccess<{ coverUrl: string }>>('/profiles/me/cover', form, {
      timeout: 60_000
    });
    return response.data.data;
  },
  async removeCover() {
    const response = await apiClient.delete<ApiSuccess<{ coverUrl: null }>>('/profiles/me/cover');
    return response.data.data;
  },
  skills: onboardingApi.selectedSkills,
  saveSkills: onboardingApi.saveSkills,
  interests: onboardingApi.selectedInterests,
  experiences: onboardingApi.experiences,
  educations: onboardingApi.educations,
  async ownRating() {
    const response = await apiClient.get<ApiSuccess<ProfileRatingSummary>>('/profiles/me/rating');
    return response.data.data;
  },
  async rating(username: string) {
    const response = await apiClient.get<ApiSuccess<ProfileRatingData>>(
      `/profiles/public/${encodeURIComponent(username)}/rating`
    );
    return response.data.data;
  },
  async saveRating(username: string, stars: number) {
    const response = await apiClient.put<ApiSuccess<ProfileRatingData>>(
      `/profiles/public/${encodeURIComponent(username)}/rating`,
      { stars }
    );
    return response.data.data;
  },
  async public(username: string) {
    const response = await apiClient.get<ApiSuccess<PublicProfileResponseData>>(
      `/profiles/public/${encodeURIComponent(username)}`
    );
    return response.data.data;
  }
};
