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

// Static uploads serving
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Mount modular REST routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/print', printRoutes);

module.exports = { app, uploadsDir };
