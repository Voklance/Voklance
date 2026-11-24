import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingKeys } from '@/features/onboarding/hooks/useOnboarding';
import { profileApi } from '../api/profileApi';

export const profileKeys = {
  public: (username: string) => ['profiles', 'public', username] as const,
  ownRating: ['profiles', 'me', 'rating'] as const,
  rating: (username: string) => ['profiles', 'rating', username] as const
};

export function useMyRating() {
  return useQuery({ queryKey: profileKeys.ownRating, queryFn: profileApi.ownRating });
}

export function usePublicRating(username: string) {
  return useQuery({
    queryKey: profileKeys.rating(username),
    queryFn: () => profileApi.rating(username),
    enabled: !!username
  });
}

export function useSavePublicRating(username: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (stars: number) => profileApi.saveRating(username, stars),
    onSuccess: (data) => {
      client.setQueryData(profileKeys.rating(username), data);
      void client.invalidateQueries({ queryKey: profileKeys.public(username) });
    }
  });
}

export function useMyProfile() {
  return useQuery({ queryKey: onboardingKeys.profile, queryFn: profileApi.own });
}
export function useMySkills() {
  return useQuery({ queryKey: onboardingKeys.selectedSkills, queryFn: profileApi.skills });
}
export function useMyInterests() {
  return useQuery({ queryKey: onboardingKeys.selectedInterests, queryFn: profileApi.interests });
}
export function useMyExperiences() {
  return useQuery({ queryKey: onboardingKeys.experiences, queryFn: profileApi.experiences });
}
export function useMyEducations() {
  return useQuery({ queryKey: onboardingKeys.educations, queryFn: profileApi.educations });
}
export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.public(username),
    queryFn: () => profileApi.public(username),
    enabled: !!username
  });
}
