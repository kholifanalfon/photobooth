import { openDB } from 'idb';

const DB_NAME = 'photobooth_chunks_db';
const DB_VERSION = 1;
export const DEFAULT_CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5 MB per chunk to prevent any HTTP timeout

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
      mimeType: file.type || 'video/mp4',
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
export async function uploadChunksWithProgress(uploadId, file, totalChunks, options = {}) {
  const { onProgress, apiBase = '' } = options;
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
    for (let i = 0; i < totalChunks; i++) {
      // 1. Retrieve chunk directly from IndexedDB
      const chunkBlob = await db.get('chunks', `${uploadId}_${i}`);
      if (!chunkBlob) {
        throw new Error(`Chunk ${i} tidak ditemukan di IndexedDB`);
      }

      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(i));
      formData.append('totalChunks', String(totalChunks));
      formData.append('filename', file.name);
      formData.append('chunk', chunkBlob, `chunk_${i}.part`);

      const res = await fetch(chunkEndpoint, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Gagal mengunggah chunk ${i + 1}/${totalChunks} (HTTP ${res.status})`);
      }

      // Update progress
      const percent = Math.min(98, Math.round(((i + 1) / totalChunks) * 100));
      if (typeof onProgress === 'function') {
        onProgress(percent, i + 1, totalChunks);
      }
    }

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
