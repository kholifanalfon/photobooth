// Client-side Video Cache Manager using Browser CacheStorage API & Object URLs
// Provides instant zero-lag playback from browser disk/memory cache.

const CACHE_NAME = 'photobooth-video-cache-v1';
const inMemoryCache = new Map();

/**
 * Checks if a given URL is a direct video file (MP4, WebM, server /uploads/, or blob)
 */
export function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.startsWith('blob:') ||
    cleanUrl.startsWith('data:video/') ||
    cleanUrl.includes('/uploads/') ||
    /\.(mp4|webm|mov|ogg|m4v)$/i.test(cleanUrl)
  );
}

/**
 * Preload and store video file in browser CacheStorage & Object URL pool
 * @param {string} url - Direct video URL or relative server path
 * @param {Function} [onProgress] - Optional progress callback (percent: number)
 * @returns {Promise<string>} - Resolves to an instant playable blob/cached URL
 */
export async function preloadAndCacheVideo(url, onProgress = null) {
  if (!url || typeof url !== 'string' || !isDirectVideoUrl(url)) {
    return url;
  }

  // 1. Check in-memory object URL cache first
  if (inMemoryCache.has(url)) {
    return inMemoryCache.get(url);
  }

  // 2. Check browser Cache API if available
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const blobUrl = URL.createObjectURL(blob);
        inMemoryCache.set(url, blobUrl);
        if (typeof onProgress === 'function') onProgress(100);
        return blobUrl;
      }

      // If not yet cached, fetch and stream into cache
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      // Clone response to put into Cache API
      await cache.put(url, response.clone());

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      inMemoryCache.set(url, blobUrl);
      if (typeof onProgress === 'function') onProgress(100);
      return blobUrl;
    } catch (err) {
      console.warn('[videoCache] CacheStorage operation failed, falling back to direct URL:', err);
    }
  }

  // Fallback: fetch blob directly if caches not supported
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        inMemoryCache.set(url, blobUrl);
        return blobUrl;
      }
    } catch (err) {
      console.warn('[videoCache] Direct fetch blob failed, using raw url:', err);
    }
  }

  return url;
}

/**
 * Synchronous or fast check for already cached video URL
 * Returns cached Object URL if available, else returns the original url and triggers background cache
 */
export function getFastVideoUrl(url) {
  if (!url || !isDirectVideoUrl(url)) return url;
  if (inMemoryCache.has(url)) {
    return inMemoryCache.get(url);
  }
  // Trigger background caching for next render/reload
  preloadAndCacheVideo(url).catch(() => {});
  return url;
}
