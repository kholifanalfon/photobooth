const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const sessionRoutes = require('./routes/sessionRoutes');
const photoRoutes = require('./routes/photoRoutes');
const printRoutes = require('./routes/printRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Mount modular REST routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/print', printRoutes);

// 404 handler for unknown API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Client bundle integration (SPA static serving)
const clientDistDir = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
      return next();
    }
    const indexHtml = path.join(clientDistDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    next();
  });
}

module.exports = { app, uploadsDir, clientDistDir };
