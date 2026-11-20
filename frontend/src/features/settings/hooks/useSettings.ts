import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settingsApi';
import { currentUserKey } from '@/features/auth/cache/authCache';
export const settingsKeys = {
  account: ['settings', 'account'] as const,
  sessions: ['settings', 'sessions'] as const,
  privacy: ['settings', 'privacy'] as const,
  blocked: ['settings', 'blocked'] as const
};
export const useAccountInfo = () =>
  useQuery({ queryKey: settingsKeys.account, queryFn: settingsApi.account });
export const useSessions = () => useQuery({ queryKey: settingsKeys.sessions, queryFn: settingsApi.sessions });
export const usePrivacySettings = () =>
  useQuery({ queryKey: settingsKeys.privacy, queryFn: settingsApi.privacy });
export const useBlockedUsers = () =>
  useQuery({ queryKey: settingsKeys.blocked, queryFn: settingsApi.blocked });
export function useSettingsActions() {
  const client = useQueryClient();
  return {
    updateAccount: useMutation({
      mutationFn: settingsApi.updateAccount,
      onSuccess: () =>
        Promise.all([
          client.invalidateQueries({ queryKey: settingsKeys.account }),
          client.invalidateQueries({ queryKey: currentUserKey })
        ])
    }),
    updatePrivacy: useMutation({
      mutationFn: settingsApi.updatePrivacy,
      onSuccess: () =>
        Promise.all([
          client.invalidateQueries({ queryKey: settingsKeys.privacy }),
          client.invalidateQueries({ queryKey: ['onboarding', 'profile'] }),
          client.invalidateQueries({ queryKey: ['profiles', 'public'] }),
          client.invalidateQueries({ queryKey: ['search'] }),
          client.invalidateQueries({ queryKey: ['network'] })
        ])
    }),
    revokeSession: useMutation({
      mutationFn: settingsApi.revokeSession,
      onSuccess: () => void client.invalidateQueries({ queryKey: settingsKeys.sessions })
    }),
    unblock: useMutation({
      mutationFn: settingsApi.unblock,
      onSuccess: () => void client.invalidateQueries({ queryKey: settingsKeys.blocked })
    })
  };
}
