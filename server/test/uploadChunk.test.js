const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../src/app');

const uploadsDir = path.resolve(__dirname, '../uploads');

test('POST /api/photos/upload-chunk and /merge-chunks successfully processes chunked video', async () => {
  const uploadId = `test_upl_${Date.now()}`;
  const chunk1 = Buffer.from('CHUNK_ONE_DATA_');
  const chunk2 = Buffer.from('CHUNK_TWO_DATA_');
  const chunk3 = Buffer.from('CHUNK_THREE_DATA');

  // 1. Upload Chunk 0
  const res1 = await request(app)
    .post('/api/photos/upload-chunk')
    .field('uploadId', uploadId)
    .field('chunkIndex', '0')
    .field('totalChunks', '3')
    .field('filename', 'my_video.mp4')
    .attach('chunk', chunk1, 'chunk_0.part');

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.strictEqual(res1.body.chunkIndex, 0);

  // 2. Upload Chunk 1
  const res2 = await request(app)
    .post('/api/photos/upload-chunk')
    .field('uploadId', uploadId)
    .field('chunkIndex', '1')
    .field('totalChunks', '3')
    .field('filename', 'my_video.mp4')
    .attach('chunk', chunk2, 'chunk_1.part');

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.success, true);

  // 3. Upload Chunk 2
  const res3 = await request(app)
    .post('/api/photos/upload-chunk')
    .field('uploadId', uploadId)
    .field('chunkIndex', '2')
    .field('totalChunks', '3')
    .field('filename', 'my_video.mp4')
    .attach('chunk', chunk3, 'chunk_2.part');

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.success, true);

  // 4. Merge Chunks
  const mergeRes = await request(app)
    .post('/api/photos/merge-chunks')
    .send({
      uploadId,
      totalChunks: 3,
      originalName: 'my_video.mp4'
    });

  assert.strictEqual(mergeRes.status, 200);
  assert.strictEqual(mergeRes.body.success, true);
  assert.ok(mergeRes.body.filename);
  assert.ok(mergeRes.body.videoUrl);
  assert.ok(mergeRes.body.relativeUrl);

  const mergedPath = path.join(uploadsDir, mergeRes.body.filename);
  assert.ok(fs.existsSync(mergedPath));

  // Verify merged file content matches concatenated chunks
  const mergedContent = await fs.promises.readFile(mergedPath, 'utf8');
  assert.strictEqual(mergedContent, 'CHUNK_ONE_DATA_CHUNK_TWO_DATA_CHUNK_THREE_DATA');

  // Verify temp chunk dir was cleanly purged
  const tempChunkDir = path.join(uploadsDir, 'temp_chunks', uploadId);
  assert.strictEqual(fs.existsSync(tempChunkDir), false);

  // Cleanup test video
  await fs.promises.unlink(mergedPath).catch(() => {});
});

test('POST /api/photos/merge-chunks returns 404 if uploadId does not exist', async () => {
  const res = await request(app)
    .post('/api/photos/merge-chunks')
    .send({
      uploadId: 'non_existent_upload_id',
      totalChunks: 2
    });

  assert.strictEqual(res.status, 404);
  assert.ok(res.body.error);
});
