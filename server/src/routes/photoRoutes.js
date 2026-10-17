const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateQrDataUri } = require('../services/qrService');
const { prisma } = require('../db');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');
const tempChunksDir = path.resolve(uploadsDir, 'temp_chunks');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(tempChunksDir)) {
  fs.mkdirSync(tempChunksDir, { recursive: true });
}

// Multer storage configuration for persistent direct landing video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const safeName = `video_landing_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const uploadVideoMiddleware = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    const isVideo =
      (file.mimetype && file.mimetype.startsWith('video/')) ||
      /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.originalname);
    if (isVideo) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa format video (MP4, WebM, MOV, OGG)'));
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max per single chunk
}).single('chunk');

// POST /api/photos/upload-chunk
router.post('/upload-chunk', (req, res) => {
  uploadChunkMiddleware(req, res, (err) => {
    if (err) {
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
    const { uploadId, totalChunks, originalName } = req.body;
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
    const finalFilename = `video_landing_${Date.now()}${ext}`;
    const finalFilepath = path.join(uploadsDir, finalFilename);

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

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
    const videoUrl = `${host}/uploads/${finalFilename}`;
    const relativeUrl = `/uploads/${finalFilename}`;
    const stats = await fs.promises.stat(finalFilepath);

    return res.json({
      success: true,
      filename: finalFilename,
      videoUrl,
      relativeUrl,
      size: stats.size
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menggabungkan chunk video' });
  }
});

// POST /api/photos/upload-video (single-file fallback)
router.post('/upload-video', (req, res) => {
  uploadVideoMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file video' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file video yang dikirim' });
    }

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
    const filename = req.file.filename;
    const videoUrl = `${host}/uploads/${filename}`;
    const relativeUrl = `/uploads/${filename}`;

    return res.json({
      success: true,
      filename,
      videoUrl,
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

// POST /api/photos/upload
router.post('/upload', async (req, res) => {
  try {
    const { imageBase64, sessionId, poseIndex } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 required' });
    }

    // 1. Sanitize sessionId to prevent directory traversal
    const safeSessionId = (sessionId ? String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '') : '') || `anon_${Date.now()}`;

    // 3. Dynamic extension detection based on MIME header
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
    const filepath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3001');
    const downloadPageUrl = `${host}/download/${filename}`;
    const rawFileUrl = `${host}/uploads/${filename}`;
    const qrCodeDataUri = await generateQrDataUri(downloadPageUrl);

    // 4. Save to DB if safeSessionId and DATABASE_URL are present without bloating DB with multi-MB base64
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
      filename,
      qrCodeDataUri
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
