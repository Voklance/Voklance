import { useQuery } from '@tanstack/react-query';
import { onboardingKeys } from '@/features/onboarding/hooks/useOnboarding';
import { profileApi } from '../api/profileApi';

export const profileKeys = { public: (username: string) => ['profiles', 'public', username] as const };

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
