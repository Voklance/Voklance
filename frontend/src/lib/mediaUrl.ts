export function mediaUrl(url: string) {
  if (!url.startsWith('/api/v1/media/')) return url;
  const configuredApi = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configuredApi) return url;
  return new URL(url, new URL(configuredApi, window.location.origin).origin).toString();
}
