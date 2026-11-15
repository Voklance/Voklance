import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '../api/onboardingApi';

export const onboardingKeys = {
  progress: ['onboarding', 'progress'] as const,
  profile: ['onboarding', 'profile'] as const,
  skills: (search: string) => ['onboarding', 'skills', search] as const,
  selectedSkills: ['onboarding', 'selectedSkills'] as const,
  interests: (search: string) => ['onboarding', 'interests', search] as const,
  selectedInterests: ['onboarding', 'selectedInterests'] as const,
  experiences: ['onboarding', 'experiences'] as const,
  educations: ['onboarding', 'educations'] as const
};

export function useOnboarding() {
  const client = useQueryClient();
  const refresh = async (keys: readonly (readonly string[])[]) => {
    await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
  };
  const progress = useQuery({ queryKey: onboardingKeys.progress, queryFn: onboardingApi.progress });
  const profile = useQuery({ queryKey: onboardingKeys.profile, queryFn: onboardingApi.profile });
  const selectedSkills = useQuery({
    queryKey: onboardingKeys.selectedSkills,
    queryFn: onboardingApi.selectedSkills
  });
  const selectedInterests = useQuery({
    queryKey: onboardingKeys.selectedInterests,
    queryFn: onboardingApi.selectedInterests
  });
  const experiences = useQuery({
    queryKey: onboardingKeys.experiences,
    queryFn: onboardingApi.experiences
  });
  const educations = useQuery({ queryKey: onboardingKeys.educations, queryFn: onboardingApi.educations });
  const saveProfile = useMutation({
    mutationFn: onboardingApi.saveProfile,
    onSuccess: () => refresh([onboardingKeys.profile, onboardingKeys.progress])
  });
  const saveSkills = useMutation({
    mutationFn: onboardingApi.saveSkills,
    onSuccess: () => refresh([onboardingKeys.selectedSkills, onboardingKeys.progress])
  });
  const saveInterests = useMutation({
    mutationFn: onboardingApi.saveInterests,
    onSuccess: () => refresh([onboardingKeys.selectedInterests, onboardingKeys.progress])
  });
  const saveProgress = useMutation({ mutationFn: onboardingApi.saveProgress });
  const complete = useMutation({ mutationFn: onboardingApi.complete });
  const historyChanged = () =>
    refresh([onboardingKeys.experiences, onboardingKeys.educations, onboardingKeys.progress]);
  return {
    progress,
    profile,
    selectedSkills,
    selectedInterests,
    experiences,
    educations,
    saveProfile,
    saveSkills,
    saveInterests,
    saveProgress,
    complete,
    historyChanged,
    client
  };
}

export function useSkillsCatalog(search: string, enabled: boolean) {
  return useQuery({
    queryKey: onboardingKeys.skills(search),
    queryFn: () => onboardingApi.skills(search),
    enabled
  });
}

export function useInterestsCatalog(search: string, enabled: boolean) {
  return useQuery({
    queryKey: onboardingKeys.interests(search),
    queryFn: () => onboardingApi.interests(search),
    enabled
  });
}
