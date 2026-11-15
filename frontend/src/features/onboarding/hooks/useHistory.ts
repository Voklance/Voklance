import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '../api/onboardingApi';
import { onboardingKeys } from './useOnboarding';

export function useHistory() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: onboardingKeys.experiences }),
      client.invalidateQueries({ queryKey: onboardingKeys.educations }),
      client.invalidateQueries({ queryKey: onboardingKeys.progress })
    ]);
  };
  return {
    addExperience: useMutation({ mutationFn: onboardingApi.addExperience, onSuccess: refresh }),
    editExperience: useMutation({
      mutationFn: ({
        id,
        input
      }: {
        id: string;
        input: Parameters<typeof onboardingApi.editExperience>[1];
      }) => onboardingApi.editExperience(id, input),
      onSuccess: refresh
    }),
    removeExperience: useMutation({ mutationFn: onboardingApi.removeExperience, onSuccess: refresh }),
    addEducation: useMutation({ mutationFn: onboardingApi.addEducation, onSuccess: refresh }),
    editEducation: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Parameters<typeof onboardingApi.editEducation>[1] }) =>
        onboardingApi.editEducation(id, input),
      onSuccess: refresh
    }),
    removeEducation: useMutation({ mutationFn: onboardingApi.removeEducation, onSuccess: refresh })
  };
}
