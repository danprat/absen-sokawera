const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FACE_ASSETS_BASE_URL =
  import.meta.env.VITE_FACE_ASSETS_BASE_URL ||
  import.meta.env.VITE_FACE_SERVICE_PUBLIC_URL ||
  'https://face-rec.monika.id';

export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const path = url.startsWith('/') ? url : `/${url}`;
  const baseUrl = path.startsWith('/uploads/face/')
    ? FACE_ASSETS_BASE_URL
    : API_BASE_URL;

  if (!baseUrl) return path;

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return `${normalizedBaseUrl}${path}`;
}
