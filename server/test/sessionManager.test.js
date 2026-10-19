const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, uploadsDir, photosDir } = require('../src/app.js');
const { teardownTestEnvironment } = require('./testHelper');

test('Session Management & Upload Functional Grouping Suite', async (t) => {
  const sampleBase64 = 'data:image/jpeg;base64,' + Buffer.from('photo-session-test-data').toString('base64');
  const testSessionId = `sess_test_${Date.now()}`;

  await t.test('POST /api/photos/upload saves photo in photos/ subfolder without root duplication', async () => {
    const uploadRes = await request(app)
      .post('/api/photos/upload')
      .send({
        sessionId: testSessionId,
        imageBase64: sampleBase64,
        poseIndex: 1
      });

    assert.equal(uploadRes.status, 200);
    assert.equal(uploadRes.body.success, true);
    assert.equal(uploadRes.body.subfolder, 'photos');
    assert.ok(uploadRes.body.filename.startsWith(`photo_${testSessionId}_`));

    // Must exist in uploads/photos/
    const photoSubdirPath = path.join(photosDir, uploadRes.body.filename);
    assert.ok(fs.existsSync(photoSubdirPath), 'File must exist in uploads/photos/');

    // Must NOT be duplicated directly in root uploads/
    const rootPath = path.join(uploadsDir, uploadRes.body.filename);
    assert.ok(!fs.existsSync(rootPath), 'File must NOT be duplicated in uploads/ root');
  });

  await t.test('GET /api/sessions returns list including the uploaded session and photos', async () => {
    const res = await request(app).get('/api/sessions');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.sessions));
    assert.ok(res.body.total > 0);

    const found = res.body.sessions.find((s) => s.id === testSessionId);
    assert.ok(found, `Session ${testSessionId} must be in sessions list`);
    assert.ok(found.photos.length > 0, 'Session must contain photo entries');
    assert.ok(found.compositeUrl, 'Session must have compositeUrl');
    assert.ok(found.photos[0].downloadUrl, 'Photo must have downloadUrl');
  });

  await t.test('GET /api/photos/download/:filename downloads file from photos/ subdirectory', async () => {
    const sessionsRes = await request(app).get('/api/sessions');
    const targetSession = sessionsRes.body.sessions.find((s) => s.id === testSessionId);
    const targetFile = targetSession.photos[0].filename;

    const dlRes = await request(app).get(`/api/photos/download/${targetFile}`);
    assert.equal(dlRes.status, 200);
    assert.ok(dlRes.headers['content-disposition'].includes('attachment'));
  });

  await t.test('DELETE /api/sessions/:id purges session and removes files from both photos/ and root', async () => {
    const sessionsRes = await request(app).get('/api/sessions');
    const targetSession = sessionsRes.body.sessions.find((s) => s.id === testSessionId);
    const targetFile = targetSession.photos[0].filename;

    const delRes = await request(app).delete(`/api/sessions/${testSessionId}`);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    // Verify deletion from both photos/ and uploads/
    assert.ok(!fs.existsSync(path.join(photosDir, targetFile)), 'File should be removed from photos/');
    assert.ok(!fs.existsSync(path.join(uploadsDir, targetFile)), 'File should be removed from uploads/');
  });

  t.after(async () => {
    await teardownTestEnvironment();
  });
});
