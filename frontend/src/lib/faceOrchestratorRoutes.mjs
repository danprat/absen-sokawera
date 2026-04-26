export function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export function createFaceOperationUrl(baseUrl, path) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}
