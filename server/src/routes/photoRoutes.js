const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateQrDataUri } = require('../services/qrService');
const { prisma } = require('../db');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');
const framesDir = path.resolve(uploadsDir, 'frames');
const mediaDir = path.resolve(uploadsDir, 'media');
const photosDir = path.resolve(uploadsDir, 'photos');
const tempChunksDir = path.resolve(uploadsDir, 'temp_chunks');

// Ensure all functional upload subdirectories exist
[uploadsDir, framesDir, mediaDir, photosDir, tempChunksDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Determine upload category/folder based on request metadata
 */
function determineCategory(req, originalname = '') {
  const explicit = (req.query?.category || req.body?.category || '').toLowerCase();
  if (explicit === 'frames' || explicit === 'frame') return 'frames';
  if (explicit === 'photos' || explicit === 'photo') return 'photos';
  if (explicit === 'media' || explicit === 'video') return 'media';

  const lowerName = originalname.toLowerCase();
  if (lowerName.startsWith('frame_') || lowerName.includes('frame')) return 'frames';
  if (lowerName.startsWith('photo_')) return 'photos';
  return 'media';
}

/**
 * Link or mirror subfolder file to root uploads for full backward compatibility
 */
async function mirrorToRoot(subfolderPath, filename) {
  const rootPath = path.join(uploadsDir, filename);
  if (subfolderPath !== rootPath && !fs.existsSync(rootPath)) {
    try {
      await fs.promises.link(subfolderPath, rootPath);
    } catch (_) {
      try {
        await fs.promises.copyFile(subfolderPath, rootPath);
      } catch (_) {}
    }
  }
}

// Multer storage configuration for direct media uploads (video, frame, image)
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = determineCategory(req, file.originalname);
    if (category === 'frames') cb(null, framesDir);
    else if (category === 'photos') cb(null, photosDir);
    else cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(ext);
    const category = determineCategory(req, file.originalname);

    let prefix = 'video_landing_';
    if (category === 'frames') prefix = 'frame_';
    else if (category === 'photos') prefix = 'photo_';
    else if (isImage) prefix = 'image_landing_';

    const safeName = `${prefix}${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const uploadVideoMiddleware = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    const isAllowed =
      (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/'))) ||
      /\.(mp4|webm|mov|ogg|m4v|mkv|jpg|jpeg|png|webp|gif)$/i.test(file.originalname);
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa format video (MP4, WebM, MOV) atau gambar (JPG, PNG, WebP)'));
    }
  }
}).single('video');

// Multer storage for chunked uploads
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadId = (req.body.uploadId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    const sessionChunkDir = path.join(tempChunksDir, uploadId);
    if (!fs.existsSync(sessionChunkDir)) {
      fs.mkdirSync(sessionChunkDir, { recursive: true });
    }
    cb(null, sessionChunkDir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const safeIndex = isNaN(chunkIndex) ? Date.now() : chunkIndex;
    cb(null, `chunk_${safeIndex}`);
  }
});

const uploadChunkMiddleware = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max per single chunk
}).single('chunk');

// POST /api/photos/upload-chunk
router.post('/upload-chunk', (req, res) => {
  uploadChunkMiddleware(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Ukuran chunk melebihi batas (maks 50MB per chunk)' });
      }
      return res.status(400).json({ error: err.message || 'Gagal menyimpan chunk' });
    }
    const { uploadId, chunkIndex, totalChunks } = req.body;
    if (!uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ error: 'uploadId, chunkIndex, dan totalChunks wajib disertakan' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Data binary chunk tidak ditemukan' });
    }

    return res.json({
      success: true,
      uploadId,
      chunkIndex: parseInt(chunkIndex, 10),
      totalChunks: parseInt(totalChunks, 10)
    });
  });
});

// POST /api/photos/merge-chunks
router.post('/merge-chunks', async (req, res) => {
  try {
    const { uploadId, totalChunks, originalName, category: reqCat } = req.body;
    if (!uploadId || !totalChunks) {
      return res.status(400).json({ error: 'uploadId dan totalChunks wajib disertakan' });
    }

    const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const sessionChunkDir = path.join(tempChunksDir, safeUploadId);

    if (!fs.existsSync(sessionChunkDir)) {
      return res.status(404).json({ error: 'Sesi chunk upload tidak ditemukan atau telah kedaluwarsa' });
    }

    const numChunks = parseInt(totalChunks, 10);
    const ext = path.extname(originalName || 'video.mp4').toLowerCase() || '.mp4';
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(ext);

    const category = determineCategory({ body: { category: reqCat } }, originalName);
    const targetDir = category === 'frames' ? framesDir : (category === 'photos' ? photosDir : mediaDir);
    const subfolder = category === 'frames' ? 'frames' : (category === 'photos' ? 'photos' : 'media');

    let prefix = 'video_landing_';
    if (category === 'frames') prefix = 'frame_';
    else if (category === 'photos') prefix = 'photo_';
    else if (isImage) prefix = 'image_landing_';

    const finalFilename = `${prefix}${Date.now()}${ext}`;
    const finalFilepath = path.join(targetDir, finalFilename);

    const writeStream = fs.createWriteStream(finalFilepath);

    for (let i = 0; i < numChunks; i++) {
      const chunkFile = path.join(sessionChunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkFile)) {
        writeStream.destroy();
        await fs.promises.unlink(finalFilepath).catch(() => {});
        return res.status(400).json({ error: `Chunk ke-${i} tidak ditemukan di server` });
      }

      const chunkBuffer = await fs.promises.readFile(chunkFile);
      const canContinue = writeStream.write(chunkBuffer);
      if (!canContinue) {
        await new Promise((resolve) => writeStream.once('drain', resolve));
      }
    }

    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Cleanup session temp chunk directory
    await fs.promises.rm(sessionChunkDir, { recursive: true, force: true }).catch(() => {});

    // Maintain root mirror for 100% backward compatibility
    await mirrorToRoot(finalFilepath, finalFilename);

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
    const videoUrl = `${host}/uploads/${subfolder}/${finalFilename}`;
    const relativeUrl = `/uploads/${subfolder}/${finalFilename}`;
    const stats = await fs.promises.stat(finalFilepath);

    return res.json({
      success: true,
      filename: finalFilename,
      subfolder,
      videoUrl,
      relativeUrl,
      size: stats.size
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menggabungkan chunk video' });
  }
});

// POST /api/photos/upload-video (categorized direct upload for media, frames, or photos)
router.post('/upload-video', (req, res) => {
  uploadVideoMiddleware(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Ukuran file melebihi batas maksimum 500MB' });
      }
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file media' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file media yang dikirim' });
    }

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
    const filename = req.file.filename;

    let subfolder = 'media';
    if (req.file.destination.endsWith('frames')) subfolder = 'frames';
    else if (req.file.destination.endsWith('photos')) subfolder = 'photos';

    // Maintain root mirror for 100% backward compatibility
    await mirrorToRoot(req.file.path, filename);

    const relativeUrl = `/uploads/${subfolder}/${filename}`;
    const fullUrl = `${host}${relativeUrl}`;

    return res.json({
      success: true,
      filename,
      subfolder,
      url: relativeUrl,
      mediaUrl: relativeUrl,
      videoUrl: fullUrl,
      relativeUrl,
      size: req.file.size
    });
  });
});

// POST /api/photos/qr-generate
router.post('/qr-generate', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required for QR generation' });
    }
    const qrCodeDataUri = await generateQrDataUri(url);
    return res.json({ qrCodeDataUri });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/photos/upload - Saves captured/composited photo into uploads/photos/
router.post('/upload', async (req, res) => {
  try {
    const { imageBase64, sessionId, poseIndex } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 required' });
    }

    // Sanitize sessionId to prevent directory traversal
    const safeSessionId = (sessionId ? String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '') : '') || `anon_${Date.now()}`;

    // Dynamic extension detection based on MIME header
    let ext = '.jpg';
    if (imageBase64.startsWith('data:image/')) {
      const match = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
      if (match && match[1]) {
        const subtype = match[1].toLowerCase();
        if (subtype === 'png') ext = '.png';
        else if (subtype === 'webp') ext = '.webp';
        else if (subtype === 'jpeg' || subtype === 'jpg') ext = '.jpg';
      }
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `photo_${safeSessionId}_${Date.now()}${ext}`;
    const filepath = path.join(photosDir, filename);

    await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

    // Maintain root mirror for 100% backward compatibility
    await mirrorToRoot(filepath, filename);

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3001');
    const downloadPageUrl = `${host}/download/${filename}`;
    const rawFileUrl = `${host}/uploads/photos/${filename}`;
    const relativeUrl = `/uploads/photos/${filename}`;
    const qrCodeDataUri = await generateQrDataUri(downloadPageUrl);

    // Save to DB if safeSessionId and DATABASE_URL are present without bloating DB with multi-MB base64
    if (sessionId && process.env.DATABASE_URL) {
      try {
        const truncatedDataUri = imageBase64.length > 256
          ? `${imageBase64.slice(0, 128)}...[truncated, size=${imageBase64.length}]`
          : imageBase64;

        await prisma.capturedPhoto.create({
          data: {
            sessionId,
            poseIndex: Number(poseIndex) || 0,
            filePath: filepath,
            imageDataUri: truncatedDataUri
          }
        });
      } catch (dbErr) {
        console.error('Prisma DB error saving photo record:', dbErr.message);
      }
    }

    return res.json({
      success: true,
      downloadUrl: downloadPageUrl,
      rawUrl: rawFileUrl,
      relativeUrl,
      subfolder: 'photos',
      filename,
      qrCodeDataUri
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.default = router;
