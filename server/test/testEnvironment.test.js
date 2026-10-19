const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { prisma, getTestDatabaseUrl } = require('../src/db');
const { photosDir, mediaDir, framesDir, uploadsDir } = require('../src/app');
const { cleanDatabase, cleanTestFiles, teardownTestEnvironment } = require('./testHelper');

test('Test Environment & Database Isolation Suite', async (t) => {
  await t.test('NODE_ENV is test and DATABASE_URL targets photobooth_test', () => {
    assert.strictEqual(process.env.NODE_ENV, 'test', 'NODE_ENV must be test');
    const testDbUrl = getTestDatabaseUrl();
    assert.ok(testDbUrl.includes('photobooth_test'), `Database URL must target photobooth_test, got: ${testDbUrl}`);
    assert.ok(process.env.DATABASE_URL.includes('photobooth_test'), 'process.env.DATABASE_URL must target photobooth_test');
  });

  await t.test('uploadsDir points to isolated uploads_test directory in test environment', () => {
    assert.ok(uploadsDir.includes('uploads_test'), `uploadsDir must contain uploads_test, got: ${uploadsDir}`);
    assert.strictEqual(fs.existsSync(uploadsDir), true, 'uploads_test directory must exist');
  });

  await t.test('cleanDatabase removes test records from photobooth_test', async () => {
    // Insert a test session into the isolated test database
    const created = await prisma.boothSession.create({
      data: {
        frameTemplate: 'strip-classic',
        photoCount: 3,
        frameColor: '#FFFFFF',
        status: 'ACTIVE'
      }
    });
    assert.ok(created.id, 'Session should be created in photobooth_test');

    // Verify record exists
    const beforeCount = await prisma.boothSession.count({ where: { id: created.id } });
    assert.strictEqual(beforeCount, 1);

    // Run cleanDatabase
    await cleanDatabase();

    // Verify record is cleanly wiped
    const afterCount = await prisma.boothSession.count({ where: { id: created.id } });
    assert.strictEqual(afterCount, 0, 'Test record must be purged after cleanDatabase');
  });

  await t.test('cleanTestFiles removes dummy files across uploads directories', async () => {
    const dummyPhoto = path.join(photosDir, `photo_test_dummy_${Date.now()}.jpg`);
    const dummyMedia = path.join(mediaDir, `video_landing_dummy_${Date.now()}.mp4`);
    const dummyFrame = path.join(framesDir, `frame_custom_test_dummy_${Date.now()}.png`);
    const dummyChunkDir = path.join(uploadsDir, 'temp_chunks', `test_upl_${Date.now()}`);

    fs.writeFileSync(dummyPhoto, 'dummy photo data');
    fs.writeFileSync(dummyMedia, 'dummy media data');
    fs.writeFileSync(dummyFrame, 'dummy frame data');
    fs.mkdirSync(dummyChunkDir, { recursive: true });
    fs.writeFileSync(path.join(dummyChunkDir, 'chunk_0'), 'dummy chunk');

    assert.ok(fs.existsSync(dummyPhoto), 'dummyPhoto should exist');
    assert.ok(fs.existsSync(dummyMedia), 'dummyMedia should exist');
    assert.ok(fs.existsSync(dummyFrame), 'dummyFrame should exist');
    assert.ok(fs.existsSync(dummyChunkDir), 'dummyChunkDir should exist');

    // Run cleanTestFiles
    await cleanTestFiles();

    // Verify all cleaned
    assert.strictEqual(fs.existsSync(dummyPhoto), false, 'dummyPhoto must be deleted');
    assert.strictEqual(fs.existsSync(dummyMedia), false, 'dummyMedia must be deleted');
    assert.strictEqual(fs.existsSync(dummyFrame), false, 'dummyFrame must be deleted');
    assert.strictEqual(fs.existsSync(dummyChunkDir), false, 'dummyChunkDir must be deleted');
  });

  await t.test('cleanTestFiles preserves non-test / real user files in main uploads/ directory', async () => {
    // Path to the real uploads directory
    const realUploadsDir = path.resolve(__dirname, '../uploads');
    const realPhotosDir = path.join(realUploadsDir, 'photos');
    const realMediaDir = path.join(realUploadsDir, 'media');
    const realFramesDir = path.join(realUploadsDir, 'frames');

    [realPhotosDir, realMediaDir, realFramesDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    const realUserPhoto = path.join(realPhotosDir, 'real_user_photo.jpg');
    const realUserMedia = path.join(realMediaDir, 'real_user_video.mp4');
    const realUserFrame = path.join(realFramesDir, 'real_user_frame.png');

    fs.writeFileSync(realUserPhoto, 'precious user photo content');
    fs.writeFileSync(realUserMedia, 'precious user video content');
    fs.writeFileSync(realUserFrame, 'precious user frame content');

    // Run cleanTestFiles
    await cleanTestFiles();

    // Verify real user files are 100% untouched and NOT deleted!
    assert.strictEqual(fs.existsSync(realUserPhoto), true, 'Real user photo must NOT be deleted by tests');
    assert.strictEqual(fs.existsSync(realUserMedia), true, 'Real user media must NOT be deleted by tests');
    assert.strictEqual(fs.existsSync(realUserFrame), true, 'Real user frame must NOT be deleted by tests');

    // Clean up our manual mock files from real uploads
    fs.unlinkSync(realUserPhoto);
    fs.unlinkSync(realUserMedia);
    fs.unlinkSync(realUserFrame);
  });

  t.after(async () => {
    await teardownTestEnvironment();
  });
});
