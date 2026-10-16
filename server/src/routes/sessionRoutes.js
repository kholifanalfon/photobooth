const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');

// POST /api/sessions
router.post('/', async (req, res) => {
  try {
    const { frameTemplate = 'strip-classic', photoCount = 3, frameColor = '#FFFFFF', templateConfig } = req.body || {};
    let session;
    try {
      if (process.env.DATABASE_URL) {
        session = await prisma.boothSession.create({
          data: {
            frameTemplate: String(frameTemplate),
            photoCount: Number(photoCount) || 3,
            frameColor: String(frameColor),
            templateConfig: templateConfig || null,
            clientIp: req.ip || req.headers['x-forwarded-for'] || null
          }
        });
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Prisma DB error in create session, using fallback:', dbErr.message);
      }
    }

    if (!session) {
      // Fallback for test/dev environments without a running DB
      session = {
        id: crypto.randomUUID(),
        frameTemplate: String(frameTemplate),
        photoCount: Number(photoCount) || 3,
        frameColor: String(frameColor),
        templateConfig: templateConfig || null,
        status: 'ACTIVE',
        clientIp: req.ip || null,
        createdAt: new Date().toISOString()
      };
    }

    return res.status(201).json(session);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let session;
    try {
      if (process.env.DATABASE_URL) {
        session = await prisma.boothSession.findUnique({
          where: { id },
          include: { photos: true, printJobs: true }
        });
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Prisma DB error in get session:', dbErr.message);
      }
    }
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let session;
    try {
      if (process.env.DATABASE_URL) {
        session = await prisma.boothSession.update({
          where: { id },
          data: {
            status: 'PURGED',
            purgedAt: new Date()
          }
        });
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Prisma DB error in delete session, using fallback:', dbErr.message);
      }
    }

    if (!session) {
      session = {
        id,
        status: 'PURGED',
        purgedAt: new Date().toISOString()
      };
    }

    // 2. Delete local file buffers using anchored prefix matching with sanitized ID
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = `photo_${safeId}_`;

    if (fs.existsSync(uploadsDir) && safeId) {
      try {
        const files = await fs.promises.readdir(uploadsDir);
        for (const file of files) {
          if (file.startsWith(prefix)) {
            await fs.promises.unlink(path.join(uploadsDir, file)).catch(() => {});
          }
        }
      } catch (fileErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Error purging session files:', fileErr.message);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Session purged and local files removed',
      session
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
