import test from 'node:test';
import assert from 'node:assert';
import {
  isDirectVideoUrl,
  isMediaImage,
  getFastVideoUrl,
  preloadAndCacheVideo,
  getCachedVideoBlobUrl,
  hasCachedVideo,
  seedLocalVideoCache,
  resolveMediaUrl
} from '../src/utils/videoCache.js';

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

test("videoCache - preloadAndCacheVideo stream progress callback", async () => {
  const originalFetch = global.fetch;
  const originalUrlCreate = global.URL?.createObjectURL;

  try {
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    let readCount = 0;

    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-length", "8"],
          ["content-type", "video/mp4"]
        ]),
        body: {
          getReader() {
            return {
              async read() {
                readCount++;
                if (readCount === 1) return { done: false, value: chunk1 };
                if (readCount === 2) return { done: false, value: chunk2 };
                return { done: true, value: undefined };
              }
            };
          }
        }
      };
    };

    if (!global.URL) global.URL = {};
    global.URL.createObjectURL = () => "blob:mock-streamed-video";

    const recordedProgress = [];
    const testUrl = "http://localhost:5000/uploads/test_stream_video.mp4";
    const result = await preloadAndCacheVideo(testUrl, (percent, stats) => {
      recordedProgress.push({ percent, stats });
    });

    assert.strictEqual(result, "blob:mock-streamed-video");
    assert.ok(recordedProgress.length >= 2, "Must record progress callbacks");
    assert.strictEqual(recordedProgress[recordedProgress.length - 1].percent, 100);
  } finally {
    global.fetch = originalFetch;
    if (originalUrlCreate) {
      global.URL.createObjectURL = originalUrlCreate;
    }
  }
});

test("videoCache - isMediaImage detection", () => {
  assert.strictEqual(isMediaImage("http://localhost:5000/uploads/image_landing_123.jpg"), true);
  assert.strictEqual(isMediaImage("/uploads/image_landing_123.png"), true);
  assert.strictEqual(isMediaImage("https://example.com/banner.webp"), true);
  assert.strictEqual(isMediaImage("data:image/jpeg;base64,AAAA"), true);

  // Video formats should be false
  assert.strictEqual(isMediaImage("http://localhost:5000/uploads/video_landing_123.mp4"), false);
  assert.strictEqual(isMediaImage("/uploads/video_landing_123.webm"), false);
  assert.strictEqual(isMediaImage("https://www.youtube.com/watch?v=123"), false);
  assert.strictEqual(isMediaImage(""), false);
  assert.strictEqual(isMediaImage(null), false);
});

test("videoCache - resolveMediaUrl normalizes cross-browser and cross-origin paths", () => {
  // Strips foreign host / port prefix to prevent mixed-content or unreachable localhost on other devices
  assert.strictEqual(
    resolveMediaUrl("http://localhost:5000/uploads/video_landing_123.mp4"),
    "/uploads/video_landing_123.mp4"
  );
  assert.strictEqual(
    resolveMediaUrl("https://photobooth.kholifan.my.id/uploads/video_landing_123.mp4"),
    "/uploads/video_landing_123.mp4"
  );
  assert.strictEqual(
    resolveMediaUrl("/uploads/video_landing_123.mp4"),
    "/uploads/video_landing_123.mp4"
  );

  // External video or blob URLs are preserved appropriately
  assert.strictEqual(
    resolveMediaUrl("https://cdn.example.com/stream.mp4"),
    "https://cdn.example.com/stream.mp4"
  );
  assert.strictEqual(
    resolveMediaUrl("blob:http://localhost:5125/uuid-123"),
    "blob:http://localhost:5125/uuid-123"
  );
  assert.strictEqual(resolveMediaUrl(""), "");
  assert.strictEqual(resolveMediaUrl(null), "");
});

test("videoCache - getCachedVideoBlobUrl and hasCachedVideo behavior", async () => {
  const originalUrlCreate = global.URL?.createObjectURL;
  if (!global.URL) global.URL = {};
  global.URL.createObjectURL = () => "blob:mock-seeded-video";

  try {
    const fakeUrl = "/uploads/test_cache_check.mp4";
    // Initially not cached
    assert.strictEqual(await getCachedVideoBlobUrl(fakeUrl), null);
    assert.strictEqual(await hasCachedVideo(fakeUrl), false);

    // Seed local cache
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" });
    const seeded = await seedLocalVideoCache(fakeUrl, fakeBlob);
    assert.strictEqual(seeded, "blob:mock-seeded-video");

    // Now it should be found in memory cache
    assert.strictEqual(await hasCachedVideo(fakeUrl), true);
    assert.strictEqual(await getCachedVideoBlobUrl(fakeUrl), "blob:mock-seeded-video");

    // Invalid or non-video URLs return null / false
    assert.strictEqual(await getCachedVideoBlobUrl(""), null);
    assert.strictEqual(await getCachedVideoBlobUrl("https://youtube.com/watch?v=1"), null);
    assert.strictEqual(await hasCachedVideo(""), false);
  } finally {
    if (originalUrlCreate) {
      global.URL.createObjectURL = originalUrlCreate;
    }
  }
});
