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

// Static uploads serving with explicit headers for image downloads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
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
// Forces Content-Disposition: attachment for mobile browser downloads
app.get('/api/photos/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filepath)) {
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

export { app, uploadsDir, clientDistDir };
export default app;
