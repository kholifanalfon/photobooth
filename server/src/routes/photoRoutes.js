const express = require('express');
const path = require('path');
const fs = require('fs');
const { generateQrDataUri } = require('../services/qrService');
const { prisma } = require('../db');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    const mimeMatch = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    if (mimeMatch) {
      const mimeSubtype = mimeMatch[1].toLowerCase();
      if (mimeSubtype === 'png') {
        ext = '.png';
      } else if (mimeSubtype === 'webp') {
        ext = '.webp';
      } else if (mimeSubtype === 'jpeg' || mimeSubtype === 'jpg') {
        ext = '.jpg';
      }
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `photo_${safeSessionId}_${Date.now()}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3001');
    const downloadUrl = `${host}/uploads/${filename}`;
    const qrCodeDataUri = await generateQrDataUri(downloadUrl);

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
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Prisma DB error saving photo record:', dbErr.message);
        }
      }
    }

    return res.json({
      success: true,
      downloadUrl,
      qrCodeDataUri,
      filename
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
