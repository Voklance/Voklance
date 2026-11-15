import type { QueryClient } from '@tanstack/react-query';

export const currentUserKey = ['auth', 'currentUser'] as const;
let sessionGeneration = 0;

export function getSessionGeneration() {
  return sessionGeneration;
}

function discardPrivateQueries(client: QueryClient) {
  return client.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'auth' }).then(() => {
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  });
}

export async function clearAuthenticatedCache(client: QueryClient) {
  sessionGeneration += 1;
  client.setQueryData(currentUserKey, null);
  await discardPrivateQueries(client);
}

export async function prepareAuthenticatedCache(client: QueryClient) {
  sessionGeneration += 1;
  client.setQueryData(currentUserKey, null);
  await discardPrivateQueries(client);
}
