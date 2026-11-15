import { useQuery } from '@tanstack/react-query';
import { currentUserKey } from '../cache/authCache';
import { authApi } from '../api/authApi';

export { currentUserKey } from '../cache/authCache';

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserKey, queryFn: authApi.currentUser });
}
