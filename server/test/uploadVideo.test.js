const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, uploadsDir, mediaDir } = require('../src/app');
const { teardownTestEnvironment } = require('./testHelper');

test('POST /api/photos/upload-video handles file uploads and returns accessible videoUrl', async () => {
  const dummyVideoBuffer = Buffer.from('fake mp4 video stream header 00000018ftypmp42');

  const res = await request(app)
    .post('/api/photos/upload-video')
    .attach('video', dummyVideoBuffer, 'sample_test_video.mp4');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.filename);
  assert.match(res.body.filename, /^video_landing_\d+\.mp4$/);
  assert.ok(res.body.videoUrl);
  assert.ok(res.body.relativeUrl);

  // Verify file was physically written to uploads directory
  const uploadedPath = path.join(mediaDir, res.body.filename);
  assert.ok(fs.existsSync(uploadedPath));

  // Verify file can be retrieved via /uploads/ static endpoint
  const getRes = await request(app).get(`/uploads/${res.body.filename}`);
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.headers['access-control-allow-origin'], '*');
  assert.ok(getRes.headers['cache-control']);

  // Cleanup test video
  await fs.promises.unlink(uploadedPath).catch(() => {});
});

test('POST /api/photos/upload-video returns 400 when no file is uploaded', async () => {
  const res = await request(app)
    .post('/api/photos/upload-video')
    .send({});

  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error);
});

test("POST /api/photos/upload-video handles image file uploads (JPG/PNG) and returns accessible mediaUrl", async () => {
  const dummyImageBuffer = Buffer.from("fake png stream data");

  const res = await request(app)
    .post("/api/photos/upload-video")
    .attach("video", dummyImageBuffer, "wedding_banner.png");

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.filename);
  assert.match(res.body.filename, /^image_landing_\d+\.png$/);
  assert.ok(res.body.videoUrl);

  const uploadedPath = path.join(mediaDir, res.body.filename);
  assert.ok(fs.existsSync(uploadedPath));
  await fs.promises.unlink(uploadedPath).catch(() => {});
});

test.after(async () => {
  await teardownTestEnvironment();
});
