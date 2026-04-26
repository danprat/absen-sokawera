const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
}
