const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');

const router = express.Router();
function stringToUuid(str) {
  if (!str) return crypto.randomUUID();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(String(str)).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

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
    const { eventId } = req.query;
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
        const where = {};
        if (eventId) {
          where.eventId = eventId;
        }
        dbSessions = await prisma.boothSession.findMany({
          where,
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
    const aliasMap = new Map();

    for (const dbs of dbSessions) {
      const displayId = (dbs.templateConfig && typeof dbs.templateConfig === 'object' && dbs.templateConfig.legacySessionId)
        ? dbs.templateConfig.legacySessionId
        : (dbs.storageUrl && dbs.storageUrl.startsWith('sess_') ? dbs.storageUrl : dbs.id);

      const sessionObj = {
        id: displayId,
        uuid: dbs.id,
        eventId: dbs.eventId || null,
        createdAt: dbs.createdAt && dbs.createdAt.toISOString ? dbs.createdAt.toISOString() : String(dbs.createdAt),
        status: dbs.status || 'COMPLETED',
        photoCount: dbs.photoCount || 1,
        frameTemplate: dbs.frameTemplate || 'custom',
        frameColor: dbs.frameColor || '#FFFFFF',
        photos: [],
        compositeUrl: null,
        printJobs: dbs.printJobs || []
      };
      sessionMap.set(dbs.id, sessionObj);
      sessionMap.set(displayId, sessionObj);

      if (dbs.templateConfig && typeof dbs.templateConfig === 'object' && dbs.templateConfig.legacySessionId) {
        aliasMap.set(dbs.templateConfig.legacySessionId, dbs.id);
      }
      if (dbs.storageUrl) {
        aliasMap.set(dbs.storageUrl, dbs.id);
      }
    }

    // Also include in-memory sessions if any
    for (const [memId, memSession] of memorySessions.entries()) {
      if (eventId && memSession.eventId !== eventId) {
        continue;
      }
      if (!sessionMap.has(memId)) {
        sessionMap.set(memId, {
          id: memId,
          eventId: memSession.eventId || null,
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

      let targetId = sessionId;
      if (aliasMap.has(sessionId)) {
        targetId = aliasMap.get(sessionId);
      }

      if (!sessionMap.has(targetId)) {
        if (eventId) {
          continue;
        }
        sessionMap.set(targetId, {
          id: targetId,
          eventId: null,
          createdAt: fileInfo.createdAt,
          status: 'COMPLETED',
          photoCount: 1,
          frameTemplate: 'custom',
          photos: [],
          compositeUrl: null,
          printJobs: []
        });
      }

      const s = sessionMap.get(targetId);
      s.photos.push(fileInfo);
      if (isCompositeFile || !s.compositeUrl) {
        s.compositeUrl = fileInfo.url;
      }
    }

    // Sort sessions by date descending
    const sessions = Array.from(new Set(sessionMap.values())).sort((a, b) => {
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
    const { eventId, frameTemplate = 'strip-classic', photoCount = 3, frameColor = '#FFFFFF', templateConfig } = req.body || {};
    const cleanEventId = (eventId && typeof eventId === 'string' && eventId.trim() !== '') ? eventId.trim() : null;

    let session;
    try {
      if (process.env.DATABASE_URL) {
        session = await prisma.boothSession.create({
          data: {
            eventId: cleanEventId,
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
        eventId: cleanEventId,
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
      if (process.env.DATABASE_URL) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const targetDbId = isUuid ? id.toLowerCase() : stringToUuid(id);
        // Cascade delete records from PostgreSQL store
        await prisma.printJob.deleteMany({ where: { sessionId: targetDbId } }).catch(() => {});
        await prisma.capturedPhoto.deleteMany({ where: { sessionId: targetDbId } }).catch(() => {});
        session = await prisma.boothSession.delete({
          where: { id: targetDbId }
        }).catch(async () => {
          return await prisma.boothSession.update({
            where: { id: targetDbId },
            data: {
              status: 'PURGED',
              purgedAt: new Date()
            }
          }).catch(() => null);
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
