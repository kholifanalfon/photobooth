const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const fs = require("fs");
const path = require("path");
const { app, uploadsDir, framesDir } = require("../src/app");
const { teardownTestEnvironment } = require("./testHelper");

const dataDir = path.resolve(__dirname, "../../data");
const configFile = path.join(dataDir, "landing_config.json");

test("GET /api/config/landing returns landing config with success", async () => {
  const res = await request(app).get("/api/config/landing");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.config);
  assert.ok(res.body.config.title);
});

test("POST /api/config/landing updates config and sanitizes blob URLs", async () => {
  // Preserve original config before test
  let originalConfig = null;
  if (fs.existsSync(configFile)) {
    try {
      originalConfig = fs.readFileSync(configFile, "utf8");
    } catch (_) {}
  }

  try {
    const updatePayload = {
      title: "The Wedding Celebration ✨",
      theme: "wedding",
      videoUrl: "blob:http://localhost/dummy-temp-blob"
    };

    const res = await request(app)
      .post("/api/config/landing")
      .send(updatePayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.config.title, "The Wedding Celebration ✨");
    assert.strictEqual(res.body.config.theme, "wedding");
    // Verify blob: URLs are never persisted on the server
    assert.notStrictEqual(res.body.config.videoUrl, "blob:http://localhost/dummy-temp-blob");
  } finally {
    // Restore original config so test never corrupts active production data
    if (originalConfig) {
      try {
        fs.writeFileSync(configFile, originalConfig, "utf8");
      } catch (_) {}
    }
  }
});

test("GET /api/config/media returns files array", async () => {
  const res = await request(app).get("/api/config/media");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.files));
});

test("DELETE /api/config/media deletes dummy media file safely", async () => {
  // uploadsDir is imported from app
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const dummyFile = path.join(uploadsDir, "video_landing_test_dummy.mp4");
  fs.writeFileSync(dummyFile, "dummy content for delete test", "utf8");

  const res = await request(app)
    .delete("/api/config/media")
    .send({ filename: "video_landing_test_dummy.mp4" });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.deleted, true);
  assert.strictEqual(fs.existsSync(dummyFile), false);
});

test("POST /api/config/verify-admin validates admin code", async () => {
  const validRes = await request(app)
    .post("/api/config/verify-admin")
    .send({ adminCode: "9999" });
  assert.strictEqual(validRes.status, 200);
  assert.strictEqual(validRes.body.success, true);
  assert.strictEqual(validRes.body.verified, true);

  const invalidRes = await request(app)
    .post("/api/config/verify-admin")
    .send({ adminCode: "wrong-code" });
  assert.strictEqual(invalidRes.status, 401);
  assert.strictEqual(invalidRes.body.success, false);
});

test("DELETE /api/config/frame deletes frame image and removes frame from config store", async () => {
  // framesDir is imported from app
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  const dummyFrameFile = path.join(framesDir, "frame_custom_test_dummy.png");
  fs.writeFileSync(dummyFrameFile, "dummy frame data", "utf8");

  const res = await request(app)
    .delete("/api/config/frame")
    .send({
      frameId: "test-frame-to-delete",
      filename: "frame_custom_test_dummy.png"
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.deleted, true);
  assert.strictEqual(fs.existsSync(dummyFrameFile), false);
});

test("DELETE /api/photos/chunks/:uploadId cleans up temporary chunk directory from storage", async () => {
  const tempDir = path.resolve(uploadsDir, "temp_chunks/test_upload_purge_123");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  fs.writeFileSync(path.join(tempDir, "chunk_0"), "temp chunk", "utf8");
  assert.strictEqual(fs.existsSync(tempDir), true);

  const res = await request(app).delete("/api/photos/chunks/test_upload_purge_123");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(fs.existsSync(tempDir), false);
});

test.after(async () => {
  await teardownTestEnvironment();
});
