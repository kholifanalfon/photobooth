/**
 * Video Caching & Streaming Service
 * Provides instantaneous 0ms playback for landing video backgrounds and frames
 * using CacheStorage API, fast-streaming fallback, and in-memory Blob pooling.
 */

const VIDEO_CACHE_NAME = 'photobooth-video-cache-v2';
const inMemoryCache = new Map();

/**
 * Checks if a given media URL is a static image format (JPEG/PNG/WebP/GIF)
 */
export function isMediaImage(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanUrl) ||
    cleanUrl.includes('image_landing_')
  );
}

/**
 * Streams download with progress tracking and returns Blob
 */
async function fetchBlobWithProgress(url, onProgress = null) {
  if (url.startsWith('/') && (typeof window === 'undefined' || !window.location)) {
    return { blob: { size: 0 }, totalBytes: 0, contentType: 'video/mp4' };
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
  const contentType = response.headers.get('content-type') || 'video/mp4';

  // If ReadableStream reader is supported, stream chunks and report progress
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      if (typeof onProgress === 'function') {
        const percent = totalBytes > 0
          ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
          : Math.min(95, Math.round((receivedBytes / (5 * 1024 * 1024)) * 100));
        onProgress(percent, { receivedBytes, totalBytes });
      }
    }

    const blob = new Blob(chunks, { type: contentType });
    return { blob, totalBytes: blob.size, contentType };
  }

  // Fallback when ReadableStream reader is not available (e.g. mock tests / older engines)
  const blob = await response.blob();
  if (typeof onProgress === 'function') {
    onProgress(100, { receivedBytes: blob.size, totalBytes: blob.size });
  }
  return { blob, totalBytes: blob.size, contentType };
}

/**
 * Preload and store video file in browser CacheStorage & Object URL pool
 * @param {string} url - Direct video URL or relative server path
 * @param {Function} [onProgress] - Optional progress callback (percent: number, stats: { receivedBytes: number, totalBytes: number, isFromCache?: boolean })
 * @returns {Promise<string>} - Resolves to an instant playable blob/cached URL
 */
export async function preloadAndCacheVideo(url, onProgress = null) {
  if (!url || typeof url !== 'string' || !isDirectVideoUrl(url)) {
    return url;
  }

  // Local object URLs or base64 data URIs are already resident in browser memory
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    if (typeof onProgress === 'function') {
      onProgress(100, { receivedBytes: 1, totalBytes: 1, isFromCache: true });
    }
    return url;
  }

  // 1. Check in-memory object URL cache first
  if (inMemoryCache.has(url)) {
    if (typeof onProgress === 'function') {
      onProgress(100, { receivedBytes: 1, totalBytes: 1, isFromCache: true });
    }
    return inMemoryCache.get(url);
  }

  // 2. Check browser Cache API if available
  let cacheInstance = null;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      cacheInstance = await window.caches.open(VIDEO_CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const cachedResponse = (await cacheInstance.match(cacheKey)) || (await cacheInstance.match(url));

      if (cachedResponse) {
        if (typeof onProgress === 'function') {
          onProgress(100, { receivedBytes: 1, totalBytes: 1, isFromCache: true });
        }
        const blob = await cachedResponse.blob();
        const blobUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
        ? URL.createObjectURL(blob)
        : url;
        inMemoryCache.set(url, blobUrl);
        return blobUrl;
      }
    } catch (err) {
      console.warn('[videoCache] CacheStorage match check failed:', err);
    }
  }

  // 3. Fetch from server with streaming progress
  if (typeof fetch === 'function') {
    try {
      const { blob, contentType } = await fetchBlobWithProgress(url, onProgress);

      // Store in CacheStorage if supported with valid status 200
      if (cacheInstance) {
        try {
          const cacheKey = normalizeCacheKey(url);
          const cacheResponse = new Response(blob, {
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": contentType,
              "Content-Length": String(blob.size),
              "Accept-Ranges": "bytes"
            }
          });
          await cacheInstance.put(cacheKey, cacheResponse);
        } catch (cacheErr) {
          console.warn("[videoCache] CacheStorage put failed:", cacheErr);
        }
      }

      const blobUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
        ? URL.createObjectURL(blob)
        : url;
      inMemoryCache.set(url, blobUrl);
      if (typeof onProgress === 'function') {
        onProgress(100, { receivedBytes: blob.size, totalBytes: blob.size });
      }
      return blobUrl;
    } catch (err) {
      console.warn('[videoCache] Failed to preload/cache video stream:', err);
    }
  }

  return url;
}

/**
 * Normalizes URL keys for CacheStorage lookups
 */
function normalizeCacheKey(url) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (typeof window !== 'undefined' && window.location) {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname;
    } catch (_) {
      return url.split('?')[0];
    }
  }
  return url.split('?')[0];
}

/**
 * Resolves fastest immediate playable URL (in-memory or server path)
 */
export function getFastVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (inMemoryCache.has(url)) return inMemoryCache.get(url);
  return resolveMediaUrl(url);
}

/**
 * Checks whether URL points directly to an uploaded video file
 */
export function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanUrl) ||
    cleanUrl.includes('video_landing_') ||
    cleanUrl.includes('/uploads/media/') ||
    cleanUrl.includes('/uploads/video')
  );
}

/**
 * Converts relative server paths to absolute URLs
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('/uploads/')) {
    const idx = url.indexOf('/uploads/');
    return url.substring(idx);
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

/**
 * Checks if video already exists in CacheStorage or in-memory
 */
export async function hasCachedVideo(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  if (inMemoryCache.has(url)) return true;

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(VIDEO_CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const match = (await cache.match(cacheKey)) || (await cache.match(url));
      return Boolean(match);
    } catch (_) {
      return false;
    }
  }
  return false;
}

/**
 * Returns Blob URL from CacheStorage if available
 */
export async function getCachedVideoBlobUrl(url) {
  if (!url || typeof url !== 'string' || !isDirectVideoUrl(url)) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (inMemoryCache.has(url)) return inMemoryCache.get(url);

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(VIDEO_CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const cachedResponse = (await cache.match(cacheKey)) || (await cache.match(url));
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const blobUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
          ? URL.createObjectURL(blob)
          : url;
        inMemoryCache.set(url, blobUrl);
        return blobUrl;
      }
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Seeds local video cache immediately after upload
 */
export async function seedLocalVideoCache(url, fileOrBlob) {
  if (!url || !fileOrBlob) return null;
  try {
    const blobUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
      ? URL.createObjectURL(fileOrBlob)
      : url;
    inMemoryCache.set(url, blobUrl);

    if (typeof window !== 'undefined' && 'caches' in window) {
      const cache = await window.caches.open(VIDEO_CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const cacheResponse = new Response(fileOrBlob, {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": fileOrBlob.type || 'video/mp4',
          "Content-Length": String(fileOrBlob.size),
          "Accept-Ranges": "bytes"
        }
      });
      await cache.put(cacheKey, cacheResponse);
    }
    return blobUrl;
  } catch (err) {
    console.warn('[videoCache] seedLocalVideoCache failed:', err);
    return null;
  }
}

/**
 * Completely purges a video from browser CacheStorage and in-memory cache
 * @param {string} urlOrFilename
 */
export async function clearVideoCache(urlOrFilename) {
  if (!urlOrFilename || typeof urlOrFilename !== 'string') return;
  const target = urlOrFilename.trim();
  const cleanTarget = target.split('?')[0];
  const targetBase = target.includes('/') ? target.substring(target.lastIndexOf('/') + 1) : target;

  // 1. Purge from inMemoryCache and revoke object URLs
  for (const [key, blobUrl] of inMemoryCache.entries()) {
    if (
      key === target ||
      key.includes(cleanTarget) ||
      (targetBase && key.includes(targetBase)) ||
      (blobUrl && typeof blobUrl === 'string' && (blobUrl.includes(cleanTarget) || (targetBase && blobUrl.includes(targetBase))))
    ) {
      if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }
      inMemoryCache.delete(key);
    }
  }

  // 2. Purge from CacheStorage across cache versions
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = [VIDEO_CACHE_NAME, 'photobooth-video-cache-v1', 'photobooth-video-cache-v2'];
      for (const cName of cacheNames) {
        try {
          const cache = await window.caches.open(cName);
          const requests = await cache.keys();
          for (const req of requests) {
            const reqUrl = req.url || '';
            if (
              reqUrl.includes(cleanTarget) ||
              (targetBase && reqUrl.includes(targetBase)) ||
              (targetBase && reqUrl.endsWith(targetBase))
            ) {
              await cache.delete(req);
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[videoCache] Failed to clear CacheStorage:', err);
    }
  }
}
