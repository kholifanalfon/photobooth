const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');

const router = express.Router();
const defaultUploadsDirName = process.env.NODE_ENV === 'test' ? 'uploads_test' : 'uploads';
const uploadsDir = process.env.UPLOADS_DIR
  ? (path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.resolve(__dirname, '../..', process.env.UPLOADS_DIR))
  : path.resolve(__dirname, '../..', defaultUploadsDirName);
const photosDir = path.resolve(uploadsDir, 'photos');

// Ensure photos directory exists
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// In-memory fallback session store for local/testing without a live DB connection
const memorySessions = new Map();

// GET /api/sessions - List all sessions with photos and download links
router.get('/', async (req, res) => {
  try {
    const host = process.env.PUBLIC_HOST_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');

    // 1. Gather photo files from uploads/photos and uploads
    const searchDirs = [
      { dir: photosDir, urlPrefix: '/uploads/photos' },
      { dir: uploadsDir, urlPrefix: '/uploads' }
    ];

    const fileMap = new Map();

    for (const { dir, urlPrefix } of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          if (file.startsWith('photo_') && /\.(jpg|jpeg|png|webp)$/i.test(file)) {
            if (!fileMap.has(file)) {
              try {
                const stat = await fs.promises.stat(path.join(dir, file));
                fileMap.set(file, {
                  filename: file,
                  url: `${urlPrefix}/${file}`,
                  downloadUrl: `${host}/download/${file}`,
                  apiDownloadUrl: `${host}/api/photos/download/${file}`,
                  size: stat.size,
                  createdAt: stat.mtime.toISOString(),
                  mtimeMs: stat.mtimeMs
                });
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }

    // 2. Query Prisma database if available
    let dbSessions = [];
    if (process.env.DATABASE_URL) {
      try {
        dbSessions = await prisma.boothSession.findMany({
          orderBy: { createdAt: 'desc' },
          include: { photos: true, printJobs: true },
          take: 100
        });
      } catch (dbErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Prisma DB error in get all sessions:', dbErr.message);
        }
      }
    }

    // 3. Group by session
    const sessionMap = new Map();

    for (const dbs of dbSessions) {
      sessionMap.set(dbs.id, {
        id: dbs.id,
        createdAt: dbs.createdAt && dbs.createdAt.toISOString ? dbs.createdAt.toISOString() : String(dbs.createdAt),
        status: dbs.status || 'COMPLETED',
        photoCount: dbs.photoCount || 1,
        frameTemplate: dbs.frameTemplate || 'custom',
        frameColor: dbs.frameColor || '#FFFFFF',
        photos: [],
        compositeUrl: null,
        printJobs: dbs.printJobs || []
      });
    }

    // Also include in-memory sessions if any
    for (const [memId, memSession] of memorySessions.entries()) {
      if (!sessionMap.has(memId)) {
        sessionMap.set(memId, {
          id: memId,
          createdAt: memSession.createdAt || new Date().toISOString(),
          status: memSession.status || 'ACTIVE',
          photoCount: memSession.photoCount || 1,
          frameTemplate: memSession.frameTemplate || 'custom',
          frameColor: memSession.frameColor || '#FFFFFF',
          photos: [],
          compositeUrl: null,
          printJobs: []
        });
      }
    }

    // Associate photos with sessions
    for (const [filename, fileInfo] of fileMap.entries()) {
      const raw = filename.replace(/^photo_/, '').replace(/\.[a-zA-Z0-9]+$/, '');
      let sessionId = 'legacy';
      let isCompositeFile = false;

      if (raw.includes('_composite_')) {
        sessionId = raw.split('_composite_')[0];
        isCompositeFile = true;
      } else if (raw.includes('_pose_')) {
        sessionId = raw.split('_pose_')[0];
      } else {
        const parts = raw.split('_');
        sessionId = parts.length > 1 ? parts.slice(0, parts.length - 1).join('_') : parts[0];
      }

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          id: sessionId,
          createdAt: fileInfo.createdAt,
          status: 'COMPLETED',
          photoCount: 1,
          frameTemplate: 'custom',
          photos: [],
          compositeUrl: null,
          printJobs: []
        });
      }

      const s = sessionMap.get(sessionId);
      s.photos.push(fileInfo);
      if (isCompositeFile || !s.compositeUrl) {
        s.compositeUrl = fileInfo.url;
      }
    }

    // Sort sessions by date descending
    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return res.json({
      success: true,
      total: sessions.length,
      sessions
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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
      memorySessions.set(session.id, session);
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

    if (!session && memorySessions.has(id)) {
      session = memorySessions.get(id);
    }

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id - Purges session and deletes associated photo files from disk and store
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let session;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid && process.env.DATABASE_URL) {
        // Cascade delete records from PostgreSQL store
        await prisma.printJob.deleteMany({ where: { sessionId: id } }).catch(() => {});
        await prisma.capturedPhoto.deleteMany({ where: { sessionId: id } }).catch(() => {});
        session = await prisma.boothSession.delete({
          where: { id }
        }).catch(async () => {
          return await prisma.boothSession.update({
            where: { id },
            data: {
              status: 'PURGED',
              purgedAt: new Date()
            }
          });
        });
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Prisma DB error in delete session, using fallback:', dbErr.message);
      }
    }

    if (!session) {
      session = memorySessions.get(id) || {
        id,
        status: 'PURGED',
        purgedAt: new Date().toISOString()
      };
    }
    session.status = 'PURGED';
    session.purgedAt = new Date().toISOString();
    memorySessions.delete(id);

    // Delete local photo files from uploads/photos and uploads
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = `photo_${safeId}_`;
    const photoboothPrefix = `photobooth_${safeId}`;

    let deletedFilesCount = 0;
    const searchDirs = [photosDir, uploadsDir];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir) && safeId) {
        try {
          const files = await fs.promises.readdir(dir);
          for (const file of files) {
            if (
              file.startsWith(prefix) ||
              file.startsWith(photoboothPrefix) ||
              file === id ||
              file.includes(safeId)
            ) {
              await fs.promises.unlink(path.join(dir, file)).catch(() => {});
              deletedFilesCount++;
            }
          }
        } catch (fileErr) {
          if (process.env.NODE_ENV !== 'test') {
            console.warn('Error purging session files:', fileErr.message);
          }
        }
      }
    }

    return res.json({
      success: true,
      message: 'Session purged and local files removed from store',
      deletedFilesCount,
      session
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/photo/:filename - Deletes an individual photo file from disk and store
router.delete('/photo/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const searchDirs = [
      photosDir,
      uploadsDir,
      path.join(uploadsDir, 'frames'),
      path.join(uploadsDir, 'media')
    ];

    let deleted = false;
    for (const dir of searchDirs) {
      const fullPath = path.join(dir, filename);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath).catch(() => {});
        deleted = true;
      }
    }

    // Delete record from database store
    if (process.env.DATABASE_URL) {
      try {
        await prisma.capturedPhoto.deleteMany({
          where: {
            OR: [
              { filePath: { contains: filename } },
              { imageDataUri: { contains: filename } }
            ]
          }
        }).catch(() => {});
      } catch (dbErr) {}
    }

    // Also update in-memory session store
    for (const [sessId, sess] of memorySessions.entries()) {
      if (sess && Array.isArray(sess.photos)) {
        const initialCount = sess.photos.length;
        sess.photos = sess.photos.filter((p) => p.filename !== filename);
        if (sess.photos.length !== initialCount) {
          memorySessions.set(sessId, sess);
        }
      }
    }

    return res.json({ success: true, deleted, filename });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.default = router;
