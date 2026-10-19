const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, uploadsDir, clientDistDir } = require('../src/app');
const { teardownTestEnvironment } = require('./testHelper');

test('Health & Server Inspection Suite', async (t) => {
  await t.test('GET /health returns 200 OK with valid status and ISO timestamp', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type']?.includes('application/json'), true);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.timestamp, 'timestamp must be present');
    const parsedDate = new Date(res.body.timestamp);
    assert.strictEqual(Number.isNaN(parsedDate.getTime()), false, 'timestamp must be a valid date');
  });

  await t.test('app exports core directory paths correctly', () => {
    assert.ok(uploadsDir, 'uploadsDir should be exported');
    assert.strictEqual(fs.existsSync(uploadsDir), true, 'uploads directory must exist on disk');
    assert.ok(clientDistDir, 'clientDistDir should be exported');
    assert.strictEqual(clientDistDir.endsWith(path.join('client', 'dist')), true);
  });
});

test('API Route Availability & Method Handling', async (t) => {
  let createdSessionId = null;

  await t.test('POST /api/sessions handles session creation with valid structure', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        frameTemplate: 'strip-classic',
        photoCount: 3,
        frameColor: '#FFE4E6'
      });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.frameTemplate, 'strip-classic');
    assert.strictEqual(res.body.photoCount, 3);
    assert.strictEqual(res.body.frameColor, '#FFE4E6');
    createdSessionId = res.body.id;
  });

  await t.test('GET /api/sessions/:id retrieves the created session', async () => {
    assert.ok(createdSessionId, 'createdSessionId must be present');
    const res = await request(app).get(`/api/sessions/${createdSessionId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, createdSessionId);
  });

  await t.test('DELETE /api/sessions/:id purges session cleanly', async () => {
    assert.ok(createdSessionId, 'createdSessionId must be present');
    const res = await request(app).delete(`/api/sessions/${createdSessionId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.session?.status, 'PURGED');
  });

  await t.test('POST /api/photos/upload validates missing image payload', async () => {
    const res = await request(app).post('/api/photos/upload').send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'imageBase64 required');
  });

  await t.test('POST /api/photos/qr-generate validates missing url payload', async () => {
    const res = await request(app).post('/api/photos/qr-generate').send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'URL is required for QR generation');
  });

  await t.test('POST /api/print queues print job successfully', async () => {
    const res = await request(app).post('/api/print').send({ copies: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'QUEUED');
  });

  await t.test('GET /uploads/non-existent-file.jpg returns 404', async () => {
    const res = await request(app).get('/uploads/non_existent_test_photo_404.jpg');
    assert.strictEqual(res.status, 404);
  });

  await t.test('GET /api/non-existent-route returns 404 JSON without leaking SPA HTML', async () => {
    const res = await request(app).get('/api/unknown-endpoint-xyz');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers['content-type']?.includes('application/json'), true);
    assert.strictEqual(res.body.error, 'Endpoint not found');
  });
});

test('Client Production Bundle Integration & Static Delivery', async (t) => {
  const distExists = fs.existsSync(clientDistDir);

  await t.test('client dist directory is built and present', () => {
    assert.strictEqual(distExists, true, 'client/dist must exist (run npm run build:client if missing)');
    assert.strictEqual(fs.existsSync(path.join(clientDistDir, 'index.html')), true);
  });

  await t.test('GET / serves production index.html with 200 OK', async () => {
    if (!distExists) return;
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type']?.includes('text/html'), true);
    assert.strictEqual(res.text.includes('<div id="root"></div>'), true);
    assert.strictEqual(res.text.includes('<title>Photobooth</title>'), true);
  });

  await t.test('GET /camera-session (SPA route) falls back to index.html with 200 OK', async () => {
    if (!distExists) return;
    const res = await request(app).get('/camera-session');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type']?.includes('text/html'), true);
    assert.strictEqual(res.text.includes('<div id="root"></div>'), true);
  });

  await t.test('serves compiled static assets from /assets/ directory', async () => {
    if (!distExists) return;
    const assetsDir = path.join(clientDistDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      assert.ok(assetFiles.length > 0, 'assets directory should contain compiled bundles');
      const testAsset = assetFiles[0];
      const res = await request(app).get(`/assets/${testAsset}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'], 'Content-type must be defined for static asset');
    }
  });

  t.after(async () => {
    await teardownTestEnvironment();
  });
});
