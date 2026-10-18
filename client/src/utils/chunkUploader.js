import { openDB } from 'idb';

const DB_NAME = 'photobooth_chunks_db';
const DB_VERSION = 1;
export const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512 KB safe for Nginx/reverse proxy 1MB limit

/**
 * Initialize IndexedDB using idb library
 */
export async function getChunkDatabase() {
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
 * Step 1: Slice video file into chunks and store them in IndexedDB
 * @param {File} file - Original video file
 * @param {number} [chunkSize=DEFAULT_CHUNK_SIZE]
 * @returns {Promise<{ uploadId: string, totalChunks: number, chunkSize: number }>}
 */
export async function sliceAndStoreInIndexedDB(file, chunkSize = DEFAULT_CHUNK_SIZE) {
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  const db = await getChunkDatabase();
  const tx = db.transaction(['chunks', 'metadata'], 'readwrite');
  const chunksStore = tx.objectStore('chunks');
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

  // Store each sliced chunk into IndexedDB
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBlob = file.slice(start, end, file.type || 'video/mp4');
    await chunksStore.put(chunkBlob, `${uploadId}_${i}`);
  }

  await tx.done;

  return { uploadId, totalChunks, chunkSize };
}

/**
 * Cleanup chunks from IndexedDB once upload completes or fails
 */
export async function cleanupIndexedDB(uploadId, totalChunks) {
  try {
    const db = await getChunkDatabase();
    const tx = db.transaction(['chunks', 'metadata'], 'readwrite');
    const chunksStore = tx.objectStore('chunks');
    const metaStore = tx.objectStore('metadata');

    for (let i = 0; i < totalChunks; i++) {
      await chunksStore.delete(`${uploadId}_${i}`);
    }
    await metaStore.delete(uploadId);
    await tx.done;
  } catch (err) {
    console.warn('[chunkUploader] Failed to cleanup IndexedDB:', err);
  }
}

/**
 * Step 2: Upload chunks sequentially from IndexedDB to server with fine-grained progress
 * @param {string} uploadId
 * @param {File} file
 * @param {number} totalChunks
 * @param {Object} options
 * @param {Function} [options.onProgress] - (percent: number, currentChunk: number, totalChunks: number) => void
 * @param {string} [options.apiBase] - API base URL
 * @returns {Promise<{ videoUrl: string, relativeUrl: string, filename: string }>}
 */
/**
 * Direct single-request upload for small media files (images or small videos <= 4MB)
 * Ultra-fast with zero chunking and zero IndexedDB overhead.
 */
export async function uploadDirectMedia(file, options = {}) {
  const { onProgress, apiBase = '' } = options;
  const resolveUrl = (path) => {
    if (!apiBase) return path;
    const cleanBase = apiBase.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  };

  const uploadEndpoint = resolveUrl('/api/photos/upload-video');
  const formData = new FormData();
  formData.append('video', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadEndpoint, true);

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

    xhr.onerror = () => {
      reject(new Error('Koneksi jaringan terputus saat mengunggah'));
    };

    xhr.send(formData);
  });
}

export async function uploadChunksWithProgress(uploadId, file, totalChunks, options = {}) {
  const { onProgress, apiBase = '', concurrency = 3 } = options;
  const db = await getChunkDatabase();

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

    // Worker task to upload individual chunk
    const uploadWorker = async () => {
      while (nextChunkIndex < totalChunks) {
        const i = nextChunkIndex++;
        // Fast path: slice directly from File in memory to bypass IndexedDB read latency
        const start = i * DEFAULT_CHUNK_SIZE;
        const end = Math.min(file.size, start + DEFAULT_CHUNK_SIZE);
        let chunkBlob = (file && typeof file.slice === 'function')
          ? file.slice(start, end, file.type || 'application/octet-stream')
          : await db.get('chunks', `${uploadId}_${i}`);

        if (!chunkBlob) {
          chunkBlob = await db.get('chunks', `${uploadId}_${i}`);
        }

        if (!chunkBlob) {
          throw new Error(`Chunk ${i} tidak ditemukan`);
        }

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
            const res = await fetch(chunkEndpoint, {
              method: 'POST',
              body: formData
            });

            if (!res.ok) {
              let errorMsg = `Gagal mengunggah chunk ${i + 1}/${totalChunks} (HTTP ${res.status})`;
              if (res.status === 413) {
                errorMsg = `Ukuran chunk terlalu besar untuk server proxy (413 Payload Too Large).`;
              } else {
                try {
                  const errJson = await res.json();
                  if (errJson.error) errorMsg = errJson.error;
                } catch (_) {}
              }
              throw new Error(errorMsg);
            }

            success = true;
          } catch (fetchErr) {
            lastErr = fetchErr;
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 250 * attempt));
            }
          }
        }

        if (!success) {
          throw lastErr || new Error(`Gagal mengunggah chunk ${i + 1}/${totalChunks}`);
        }

        completedChunks++;
        const percent = Math.min(98, Math.round((completedChunks / totalChunks) * 100));
        if (typeof onProgress === 'function') {
          onProgress(percent, completedChunks, totalChunks);
        }
      }
    };

    // Parallel multi-stream upload pipeline
    const poolSize = Math.min(concurrency, totalChunks);
    const workers = Array.from({ length: poolSize }, () => uploadWorker());
    await Promise.all(workers);

    // Step 3: Trigger server-side merge of all chunks
    const mergeRes = await fetch(mergeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        originalName: file.name
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

    // Cleanup IndexedDB store for this upload
    await cleanupIndexedDB(uploadId, totalChunks);

    return mergeData;
  } catch (err) {
    await cleanupIndexedDB(uploadId, totalChunks);
    throw err;
  }
}
