import { openDB } from 'idb';

const DB_NAME = 'photobooth_chunks_db';
const DB_VERSION = 1;
export const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512 KB safe for Nginx/reverse proxy 1MB limit

/**
 * Initialize IndexedDB using idb library
 */
export async function getChunkDatabase() {
  if (typeof indexedDB === 'undefined') return null;
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks');
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    }
  });
}

/**
 * Step 1: Slice video file into chunks and store session metadata
 * @param {File} file - Original video file
 * @param {number} [chunkSize=DEFAULT_CHUNK_SIZE]
 * @returns {Promise<{ uploadId: string, totalChunks: number, chunkSize: number }>}
 */
export async function sliceAndStoreInIndexedDB(file, chunkSize = DEFAULT_CHUNK_SIZE) {
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  try {
    const db = await getChunkDatabase();
    if (!db) return { uploadId, totalChunks, chunkSize };
    const tx = db.transaction(['metadata'], 'readwrite');
    const metaStore = tx.objectStore('metadata');

    // Save upload session metadata
    await metaStore.put(
      {
        uploadId,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        chunkSize,
        createdAt: Date.now()
      },
      uploadId
    );
    await tx.done;
  } catch (err) {
    console.warn('[chunkUploader] Non-critical metadata save failed:', err);
  }

  return { uploadId, totalChunks, chunkSize };
}

/**
 * Cleanup chunks and metadata once upload completes or fails
 */
export async function cleanupIndexedDB(uploadId, totalChunks = 0, options = {}) {
  try {
    const db = await getChunkDatabase();
    if (db) {
      const tx = db.transaction(['chunks', 'metadata'], 'readwrite');
      const chunksStore = tx.objectStore('chunks');
      const metaStore = tx.objectStore('metadata');

      for (let i = 0; i < totalChunks; i++) {
        await chunksStore.delete(`${uploadId}_${i}`);
      }
      await metaStore.delete(uploadId);
      await tx.done;
    }
  } catch (err) {
    console.warn('[chunkUploader] Failed to cleanup IndexedDB:', err);
  }

  // Also clean up server temp chunk files from storage
  if (uploadId && options.cleanupServer) {
    try {
      const apiBase = options.apiBase || '';
      const cleanUrl = `${apiBase ? apiBase.replace(/\/+$/, '') : ''}/api/photos/chunks/${encodeURIComponent(uploadId)}`;
      if (typeof fetch === 'function') {
        fetch(cleanUrl, { method: 'DELETE' }).catch(() => {});
      }
    } catch (_) {}
  }
}

/**
 * Helper to upload a single chunk with explicit timeout and socket release
 */
async function uploadSingleChunk(url, formData, timeoutMs = 25000) {
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = timeoutMs;

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (_) {
            resolve({ success: true });
          }
        } else {
          let errorMsg = `HTTP ${xhr.status}`;
          if (xhr.status === 413) {
            errorMsg = 'Ukuran chunk terlalu besar untuk server proxy (413 Payload Too Large)';
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              if (errJson.error) errorMsg = errJson.error;
            } catch (_) {}
          }
          reject(new Error(errorMsg));
        }
      };

      xhr.ontimeout = () => {
        reject(new Error(`Koneksi upload chunk timeout (${Math.round(timeoutMs / 1000)} detik)`));
      };

      xhr.onerror = () => {
        reject(new Error('Koneksi jaringan terputus saat mengunggah chunk'));
      };

      xhr.send(formData);
    });
  }

  // Fallback for non-browser environments (e.g. Node tests)
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller?.signal
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      if (res.status === 413) {
        errorMsg = 'Ukuran chunk terlalu besar untuk server proxy (413 Payload Too Large)';
      } else {
        try {
          const errJson = await res.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch (_) {}
      }
      throw new Error(errorMsg);
    }

    const data = await res.json().catch(() => ({ success: true }));
    return data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Direct single-request upload for small media files (images or small videos <= 4MB)
 * Ultra-fast with zero chunking and zero IndexedDB overhead.
 * Supports category parameter for functional folder grouping ('frames' | 'media' | 'photos')
 */
export async function uploadDirectMedia(file, options = {}) {
  const { onProgress, apiBase = '', category = '' } = options;
  const resolveUrl = (path) => {
    if (!apiBase) return path;
    const cleanBase = apiBase.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  };

  const endpointUrl = category
    ? `/api/photos/upload-video?category=${encodeURIComponent(category)}`
    : '/api/photos/upload-video';
  const uploadEndpoint = resolveUrl(endpointUrl);
  const formData = new FormData();
  formData.append('video', file);
  if (category) {
    formData.append('category', category);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadEndpoint, true);
    xhr.timeout = 60000;

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          onProgress(percent, 1, 1);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res && !res.url) {
            res.url = res.relativeUrl || res.videoUrl || (res.filename ? `/uploads/${res.filename}` : '');
          }
          if (typeof onProgress === 'function') onProgress(100, 1, 1);
          resolve(res);
        } catch (_) {
          reject(new Error('Format respons server tidak valid'));
        }
      } else {
        let msg = `Gagal mengunggah media (HTTP ${xhr.status})`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson.error) msg = errJson.error;
        } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload media timeout (60 detik)'));
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi jaringan terputus saat mengunggah'));
    };

    xhr.send(formData);
  });
}

/**
 * Step 2: Upload chunks sequentially/in-parallel with explicit socket release and retry resilience
 * @param {string} uploadId
 * @param {File} file
 * @param {number} totalChunks
 * @param {Object} options
 * @param {Function} [options.onProgress] - (percent: number, currentChunk: number, totalChunks: number) => void
 * @param {string} [options.apiBase] - API base URL
 * @param {number} [options.concurrency=2] - Parallel connection limit (default 2 to prevent proxy socket pool stall)
 * @param {string} [options.category='media'] - functional category ('media' | 'frames' | 'photos')
 * @returns {Promise<{ videoUrl: string, relativeUrl: string, filename: string }>}
 */
export async function uploadChunksWithProgress(uploadId, file, totalChunks, options = {}) {
  const { onProgress, apiBase = '', concurrency = 2, category = 'media' } = options;

  const resolveUrl = (path) => {
    if (!apiBase) return path;
    const cleanBase = apiBase.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  };

  const chunkEndpoint = resolveUrl('/api/photos/upload-chunk');
  const mergeEndpoint = resolveUrl('/api/photos/merge-chunks');

  try {
    let completedChunks = 0;
    let nextChunkIndex = 0;

    // Worker task to upload individual chunk with retry
    const uploadWorker = async () => {
      while (nextChunkIndex < totalChunks) {
        const i = nextChunkIndex++;

        // Fast path: slice directly from File
        const start = i * DEFAULT_CHUNK_SIZE;
        const end = Math.min(file.size, start + DEFAULT_CHUNK_SIZE);
        const chunkBlob = file.slice(start, end, 'application/octet-stream');

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));
        formData.append('filename', file.name);
        formData.append('chunk', chunkBlob, `chunk_${i}.part`);

        let attempt = 0;
        let success = false;
        let lastErr = null;

        while (attempt < 3 && !success) {
          attempt++;
          try {
            await uploadSingleChunk(chunkEndpoint, formData, 25000);
            success = true;
          } catch (fetchErr) {
            lastErr = fetchErr;
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 300 * attempt));
            }
          }
        }

        if (!success) {
          throw lastErr || new Error(`Gagal mengunggah chunk ke-${i + 1} dari ${totalChunks}`);
        }

        completedChunks++;
        const percent = Math.min(98, Math.round((completedChunks / totalChunks) * 100));
        if (typeof onProgress === 'function') {
          onProgress(percent, completedChunks, totalChunks);
        }
      }
    };

    // Safe multi-stream upload pipeline (concurrency 1-2 prevents dev server socket pool deadlocks)
    const poolSize = Math.max(1, Math.min(concurrency || 2, totalChunks));
    const workers = Array.from({ length: poolSize }, () => uploadWorker());
    await Promise.all(workers);

    // Step 3: Trigger server-side merge of all chunks with category
    const mergeRes = await fetch(mergeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        originalName: file.name,
        category
      })
    });

    if (!mergeRes.ok) {
      const errJson = await mergeRes.json().catch(() => ({}));
      throw new Error(errJson.error || `Gagal menggabungkan file video (HTTP ${mergeRes.status})`);
    }

    const mergeData = await mergeRes.json();

    if (typeof onProgress === 'function') {
      onProgress(100, totalChunks, totalChunks);
    }

    await cleanupIndexedDB(uploadId, totalChunks);
    return mergeData;
  } catch (err) {
    await cleanupIndexedDB(uploadId, totalChunks);
    throw err;
  }
}
