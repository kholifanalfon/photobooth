/**
 * Resolves the target API URL based on configuration or environment.
 * Supports standalone (e.g. http://localhost:5000) or proxied setups (e.g. relative /api).
 * Safely guards against undefined, null, non-strings, or already-resolved URLs.
 */
export function resolveApiUrl(path, customBaseUrl) {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // If already absolute or blob/data URI, return as-is
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  let base = customBaseUrl;
  if (base === undefined) {
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE_URL !== undefined
    ) {
      base = import.meta.env.VITE_API_BASE_URL;
    } else {
      // In browser Vite dev or production SPA, empty base allows relative path through Vite proxy / Express router
      base = typeof window !== 'undefined' ? '' : 'http://localhost:5000';
    }
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }

  const cleanBase = String(base).replace(/\/+$/, '');
  return `${cleanBase}${normalizedPath}`;
}
