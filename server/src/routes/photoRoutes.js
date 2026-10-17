const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateQrDataUri } = require('../services/qrService');
const { prisma } = require('../db');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration for persistent landing video uploads
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

// POST /api/photos/upload-video
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
