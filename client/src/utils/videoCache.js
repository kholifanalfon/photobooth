// Client-side Video Cache Manager using Browser CacheStorage API & Object URLs
// Provides instant zero-lag playback from browser disk/memory cache with streaming progress.

const CACHE_NAME = 'photobooth-video-cache-v1';
const inMemoryCache = new Map();

/**
 * Normalizes media URLs for cross-browser, cross-tab, and cross-origin compatibility.
 * Prevents mixed-content blocking (HTTP on HTTPS) and dead blob: URLs from other browsing contexts.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();

  // If it contains /uploads/, strip the host prefix so it always resolves relatively
  // to the current browser origin (works seamlessly on localhost, IP LAN, and HTTPS domain)
  if (trimmed.includes("/uploads/")) {
    const uploadIndex = trimmed.indexOf("/uploads/");
    return trimmed.substring(uploadIndex);
  }

  return trimmed;
}

function normalizeCacheKey(url) {
  if (!url || typeof url !== "string") return "";
  try {
    if (typeof window !== "undefined" && window.location) {
      return new URL(url, window.location.href).href;
    }
  } catch (_) {}
  return url;
}

export function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.startsWith('blob:') ||
    cleanUrl.startsWith('data:video/') ||
    cleanUrl.startsWith('data:image/') ||
    cleanUrl.includes('/uploads/') ||
    /\.(mp4|webm|mov|ogg|m4v|mkv|jpg|jpeg|png|webp|gif)$/i.test(cleanUrl)
  );
}

/**
 * Checks if a given media URL is an image format rather than video
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
      cacheInstance = await window.caches.open(CACHE_NAME);
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
      console.warn('[videoCache] Stream fetch & caching failed, falling back to direct URL:', err);
    }
  }

  return url;
}

/**
 * Asynchronously checks if video is already available in CacheStorage or inMemoryCache.
 * Returns the Blob Object URL if available, or null if not yet cached.
 */
export async function getCachedVideoBlobUrl(url) {
  if (!url || typeof url !== 'string' || !isDirectVideoUrl(url) || isMediaImage(url)) {
    return null;
  }

  // 1. Check in-memory object URL cache first
  if (inMemoryCache.has(url)) {
    return inMemoryCache.get(url);
  }

  // 2. Check browser Cache API if available
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheInstance = await window.caches.open(CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const cachedResponse = (await cacheInstance.match(cacheKey)) || (await cacheInstance.match(url));

      if (cachedResponse) {
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

  return null;
}

/**
 * Checks whether the given video URL exists in memory or CacheStorage.
 */
export async function hasCachedVideo(url) {
  if (!url || typeof url !== 'string' || !isDirectVideoUrl(url) || isMediaImage(url)) {
    return false;
  }
  if (inMemoryCache.has(url)) {
    return true;
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheInstance = await window.caches.open(CACHE_NAME);
      const cacheKey = normalizeCacheKey(url);
      const cachedResponse = (await cacheInstance.match(cacheKey)) || (await cacheInstance.match(url));
      return Boolean(cachedResponse);
    } catch (_) {}
  }
  return false;
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

/**
 * Instantly seeds the local browser cache with a file that was just uploaded or selected,
 * avoiding an unnecessary re-download of the same file from the server.
 * @param {string} url - The final server media URL (e.g. /uploads/video_xxx.mp4)
 * @param {File|Blob} fileOrBlob - The local file or blob already in memory
 * @returns {Promise<string>} - Resolves to an instant playable blob/cached URL
 */
export async function seedLocalVideoCache(url, fileOrBlob) {
  if (!url || !fileOrBlob) return url;
  try {
    const blobUrl = (typeof URL !== "undefined" && typeof URL.createObjectURL === "function")
      ? URL.createObjectURL(fileOrBlob)
      : url;
    inMemoryCache.set(url, blobUrl);

    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const cacheInstance = await window.caches.open(CACHE_NAME);
        const cacheResponse = new Response(fileOrBlob, {
          headers: {
            "Content-Type": fileOrBlob.type || "video/mp4",
            "Content-Length": String(fileOrBlob.size),
            "Accept-Ranges": "bytes"
          }
        });
        const cacheKey = normalizeCacheKey(url);
        await cacheInstance.put(cacheKey, cacheResponse.clone());
        await cacheInstance.put(url, cacheResponse);
      } catch (cacheErr) {
        console.warn("[videoCache] CacheStorage seeding failed:", cacheErr);
      }
    }
    return blobUrl;
  } catch (err) {
    console.warn("[videoCache] seedLocalVideoCache error:", err);
    return url;
  }
}
