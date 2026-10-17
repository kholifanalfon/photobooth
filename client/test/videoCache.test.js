import test from 'node:test';
import assert from 'node:assert';
import { isDirectVideoUrl, getFastVideoUrl, preloadAndCacheVideo } from '../src/utils/videoCache.js';

test('videoCache - isDirectVideoUrl detection', () => {
  // Direct video formats
  assert.strictEqual(isDirectVideoUrl('http://localhost:5000/uploads/video_landing_123.mp4'), true);
  assert.strictEqual(isDirectVideoUrl('/uploads/video_landing_123.webm'), true);
  assert.strictEqual(isDirectVideoUrl('blob:http://localhost:5173/abc-123'), true);
  assert.strictEqual(isDirectVideoUrl('data:video/mp4;base64,AAAA'), true);
  assert.strictEqual(isDirectVideoUrl('https://example.com/assets/video.mov'), true);

  // Non-direct video formats (YouTube / Google Drive)
  assert.strictEqual(isDirectVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
  assert.strictEqual(isDirectVideoUrl('https://drive.google.com/file/d/12345/view'), false);
  assert.strictEqual(isDirectVideoUrl(''), false);
  assert.strictEqual(isDirectVideoUrl(null), false);
  assert.strictEqual(isDirectVideoUrl(undefined), false);
});

test('videoCache - getFastVideoUrl and preloadAndCacheVideo resilience', async () => {
  // Should handle non-video URLs gracefully
  const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  assert.strictEqual(getFastVideoUrl(ytUrl), ytUrl);

  const cachedResult = await preloadAndCacheVideo(ytUrl);
  assert.strictEqual(cachedResult, ytUrl);

  // Should handle empty / invalid gracefully
  assert.strictEqual(await preloadAndCacheVideo(''), '');
  assert.strictEqual(await preloadAndCacheVideo(null), null);
});
