import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { clearAuthenticatedCache } from '../cache/authCache';

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    async onSuccess() {
      await clearAuthenticatedCache(client);
    }
  });
}
