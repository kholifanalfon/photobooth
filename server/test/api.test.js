const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, uploadsDir, photosDir } = require('../src/app');

const { teardownTestEnvironment } = require('./testHelper');

// Clean up all testing data from separate test DB and upload files after test suite
test.after(async () => {
  await teardownTestEnvironment();
});

test('GET /health returns status ok', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(res.body.timestamp);
});

test('POST /api/photos/qr-generate creates valid data URI', async () => {
  const res = await request(app)
    .post('/api/photos/qr-generate')
    .send({ url: 'https://example.com/photo/123' });
  assert.strictEqual(res.status, 200);
  assert.match(res.body.qrCodeDataUri, /^data:image\/png;base64,/);
});

test('POST /api/photos/qr-generate returns 400 when URL is missing', async () => {
  const res = await request(app)
    .post('/api/photos/qr-generate')
    .send({});
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error);
});

test('POST /api/photos/upload stores image and returns downloadUrl and QR with dynamic extension', async () => {
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const res = await request(app)
    .post('/api/photos/upload')
    .send({
      imageBase64: sampleBase64,
      sessionId: 'test-session-123'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.downloadUrl);
  assert.match(res.body.qrCodeDataUri, /^data:image\/png;base64,/);
  // Verifies dynamic extension .png
  assert.match(res.body.filename, /^photo_test-session-123_.*\.png$/);
});

test('POST /api/photos/upload sanitizes sessionId to prevent directory traversal', async () => {
  const sampleBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const res = await request(app)
    .post('/api/photos/upload')
    .send({
      imageBase64: sampleBase64,
      sessionId: '../../traversal_test'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  // Verifies directory traversal stripped and .jpg extension detected
  assert.match(res.body.filename, /^photo_traversal_test_.*\.jpg$/);
  // Confirm file was created safely inside uploadsDir
  assert.ok(fs.existsSync(path.join(photosDir, res.body.filename)));
});

test('POST /api/photos/upload returns 400 if imageBase64 is missing', async () => {
  const res = await request(app)
    .post('/api/photos/upload')
    .send({});
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'imageBase64 required');
});

test('POST /api/print queues print job successfully', async () => {
  const res = await request(app)
    .post('/api/print')
    .send({
      sessionId: 'test-session-123',
      copies: 2
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.status, 'QUEUED');
  assert.strictEqual(res.body.copies, 2);
  assert.ok(res.body.jobId);
  assert.ok(res.body.printJobId);
});

test('POST /api/sessions creates a new session', async () => {
  const res = await request(app)
    .post('/api/sessions')
    .send({
      frameTemplate: 'strip-classic',
      photoCount: 4,
      frameColor: '#000000'
    });

  assert.strictEqual(res.status, 201);
  assert.ok(res.body.id);
  assert.strictEqual(res.body.frameTemplate, 'strip-classic');
  assert.strictEqual(res.body.photoCount, 4);
  assert.strictEqual(res.body.frameColor, '#000000');
});

test('DELETE /api/sessions/:id purges session and cleans local files with anchored prefix', async () => {
  const sessionId = 'purge-test-session';

  // Upload a temporary file for this session
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await request(app)
    .post('/api/photos/upload')
    .send({
      imageBase64: sampleBase64,
      sessionId
    });

  const createdFile = path.join(photosDir, uploadRes.body.filename);
  assert.ok(fs.existsSync(createdFile), 'Uploaded file should exist prior to purge');

  const res = await request(app).delete(`/api/sessions/${sessionId}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.session.status, 'PURGED');

  // Verify file was cleaned up by anchored prefix deletion
  assert.strictEqual(fs.existsSync(createdFile), false, 'Uploaded file should be removed after purge');
});
