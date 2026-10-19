import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import photoRoutes from './routes/photoRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import printRoutes from './routes/printRoutes.js';
import configRoutes from './routes/configRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static uploads serving with grouped subdirectories (photos, frames, media)
const uploadsDir = path.join(__dirname, '../uploads');
const framesDir = path.join(uploadsDir, 'frames');
const mediaDir = path.join(uploadsDir, 'media');
const photosDir = path.join(uploadsDir, 'photos');

[uploadsDir, framesDir, mediaDir, photosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Fallback resolver for root /uploads/:filename to check subdirectories (photos, frames, media)
app.get('/uploads/:filename', (req, res, next) => {
  const filename = path.basename(req.params.filename);
  const directPath = path.join(uploadsDir, filename);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return next();
  }
  const subdirs = ['photos', 'frames', 'media'];
  for (const sub of subdirs) {
    const candidate = path.join(uploadsDir, sub, filename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return res.sendFile(candidate);
    }
  }
  next();
});

app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      // Allow cross-origin access and prompt download or display
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  })
);

// Static frames serving
const clientPublicFrames = path.join(__dirname, '../../client/public/frames');
if (fs.existsSync(clientPublicFrames)) {
  app.use(
    '/frames',
    express.static(clientPublicFrames, {
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    })
  );
}

// Dedicated direct download endpoint: /api/photos/download/:filename
// Searches across uploads/photos, uploads, uploads/frames, and uploads/media
app.get('/api/photos/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const candidates = [
    path.join(photosDir, filename),
    path.join(uploadsDir, filename),
    path.join(framesDir, filename),
    path.join(mediaDir, filename)
  ];

  const filepath = candidates.find((p) => fs.existsSync(p));

  if (!filepath) {
    return res.status(404).json({ error: 'File foto tidak ditemukan' });
  }

  res.download(filepath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Gagal mengunduh file foto' });
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/photos', photoRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/print', printRoutes);
app.use('/api/config', configRoutes);

// Client production bundle integration (SPA static serving)
const clientDistDir = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));

  // SPA fallback: only rewrite for GET requests that do NOT start with /api/ or /uploads/
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/frames/')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

// Global 404 Handler for unhandled API/resource routes - guarantees JSON response without leaking HTML
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    status: 404
  });
});

export { app, uploadsDir, framesDir, mediaDir, photosDir, clientDistDir };
export default app;
