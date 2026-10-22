import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const configDataDir = process.env.NODE_ENV === "test"
  ? path.resolve(__dirname, "../../data_test")
  : path.resolve(__dirname, "../../data");
const configFile = path.join(configDataDir, "landing_config.json");
const framesConfigFile = path.join(configDataDir, "frames_config.json");
const LANDING_CONFIG_KEY = "landing_config";
const FRAMES_CONFIG_KEY = "frames_config";
const defaultUploadsDirName = process.env.NODE_ENV === 'test' ? 'uploads_test' : 'uploads';
const uploadsDir = process.env.UPLOADS_DIR
  ? (path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.resolve(__dirname, '../..', process.env.UPLOADS_DIR))
  : path.resolve(__dirname, '../..', defaultUploadsDirName);
const mediaDir = path.resolve(uploadsDir, "media");
const framesDir = path.resolve(uploadsDir, "frames");
const photosDir = path.resolve(uploadsDir, "photos");

function getLatestLandingMedia() {
  try {
    const searchDirs = [
      { dir: mediaDir, urlPrefix: "/uploads/media" },
      { dir: uploadsDir, urlPrefix: "/uploads" }
    ];

    const mediaFiles = [];

    for (const { dir, urlPrefix } of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const lower = f.toLowerCase();
        if (
          lower.startsWith("media_landing_") ||
          lower.startsWith("video_landing_") ||
          lower.startsWith("video_") ||
          lower.startsWith("image_landing_") ||
          lower.endsWith(".mp4") ||
          lower.endsWith(".webm") ||
          lower.endsWith(".mov") ||
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".png") ||
          lower.endsWith(".webp")
        ) {
          try {
            const stat = fs.statSync(path.join(dir, f));
            if (stat.isFile()) {
              mediaFiles.push({
                url: `${urlPrefix}/${f}`,
                mtimeMs: stat.mtimeMs
              });
            }
          } catch (_) {}
        }
      }
    }

    if (mediaFiles.length === 0) return null;

    mediaFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return mediaFiles[0].url;
  } catch (err) {
    return null;
  }
}

const defaultModern4RFrames = [
  {
    id: "frame-4r-1photo",
    name: "Bingkai 1 Foto",
    enabled: true,
    orientation: "portrait",
    width: 1200,
    height: 1800,
    imageUrl: "/frames/frame_4r_1photo.png",
    layerMode: "background",
    photoCount: 1,
    slots: [
      { id: 1, x: 100, y: 240, width: 1000, height: 1300, radius: 8, borderWidth: 3, borderColor: "#1E293B" }
    ]
  },
  {
    id: "frame-4r-2photos",
    name: "Bingkai 2 Foto",
    enabled: true,
    orientation: "portrait",
    width: 1200,
    height: 1800,
    imageUrl: "/frames/frame_4r_2photos.png",
    layerMode: "background",
    photoCount: 2,
    slots: [
      { id: 1, x: 100, y: 240, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 2, x: 100, y: 910, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" }
    ]
  },
  {
    id: "frame-4r-3photos",
    name: "Bingkai 3 Foto",
    enabled: true,
    orientation: "portrait",
    width: 1200,
    height: 1800,
    imageUrl: "/frames/frame_4r_3photos.png",
    layerMode: "background",
    photoCount: 3,
    slots: [
      { id: 1, x: 80, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 2, x: 620, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 3, x: 80, y: 920, width: 1040, height: 620, radius: 8, borderWidth: 3, borderColor: "#1E293B" }
    ]
  },
  {
    id: "frame-4r-4photos",
    name: "Bingkai 4 Foto",
    enabled: true,
    orientation: "portrait",
    width: 1200,
    height: 1800,
    imageUrl: "/frames/frame_4r_4photos.png",
    layerMode: "background",
    photoCount: 4,
    slots: [
      { id: 1, x: 80, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 2, x: 620, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 3, x: 80, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" },
      { id: 4, x: 620, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: "#1E293B" }
    ]
  }
];

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

async function readStoredConfig(key, filePath) {
  if (process.env.DATABASE_URL) {
    try {
      const record = await prisma.appConfig.findUnique({ where: { key } });
      if (record && record.value != null) {
        return typeof record.value === "string" ? JSON.parse(record.value) : record.value;
      }
    } catch (_) {}
  }
  if (filePath && fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (_) {}
  }
  return null;
}

async function writeStoredConfig(key, filePath, value) {
  if (process.env.DATABASE_URL) {
    try {
      await prisma.appConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value }
      });
    } catch (_) {}
  }
  try {
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch (_) {}
}

function normalizeFramesStore(value) {
  if (!value) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return {
      customFrames: value,
      customFrame: value.find((f) => f && f.enabled) || value[0]
    };
  }

  const frames = Array.isArray(value.customFrames) && value.customFrames.length > 0
    ? value.customFrames
    : (value.customFrame
        ? [value.customFrame]
        : (Array.isArray(value.frames) && value.frames.length > 0 ? value.frames : null));

  if (!frames) return null;

  return {
    customFrames: frames,
    customFrame: value.customFrame || frames.find((f) => f && f.enabled) || frames[0]
  };
}

function extractFramesPayload(config = {}) {
  return normalizeFramesStore({
    customFrames: config.customFrames,
    customFrame: config.customFrame
  });
}

function stripFrameFields(config = {}) {
  const next = { ...config };
  delete next.customFrames;
  delete next.customFrame;
  return next;
}

async function ensureFramesConfig() {
  const stored = normalizeFramesStore(
    await readStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile)
  );
  if (stored) return stored;

  const legacy = await readStoredConfig(LANDING_CONFIG_KEY, configFile);
  const migrated = extractFramesPayload(legacy || {});
  if (migrated) {
    await writeStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile, migrated);
    await writeStoredConfig(LANDING_CONFIG_KEY, configFile, stripFrameFields(legacy));
    return migrated;
  }

  const defaults = {
    customFrames: cloneJson(defaultModern4RFrames),
    customFrame: cloneJson(defaultModern4RFrames[0])
  };
  await writeStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile, defaults);
  return defaults;
}

// GET /api/config/frames
router.get("/frames", async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",    "Expires": "0"
  });
  try {
    const frames = await ensureFramesConfig();
    const { eventId } = req.query;
    let customFrames = frames.customFrames;
    if (Array.isArray(customFrames)) {
      customFrames = customFrames.filter((f) => {
        return f.isGlobal !== false || (eventId && Array.isArray(f.assignedEventIds) && f.assignedEventIds.includes(eventId));
      });
    }
    const customFrame = (customFrames && customFrames.length > 0)
      ? (customFrames.find((f) => f && f.enabled) || customFrames[0])
      : null;

    return res.json({ success: true, ...frames, customFrames, customFrame });
  } catch (err) {
    return res.status(500).json({ error: "Gagal membaca konfigurasi frame" });
  }
});

// POST /api/config/frames
router.post("/frames", async (req, res) => {
  try {
    const frames = normalizeFramesStore(req.body);
    if (!frames) {
      return res.status(400).json({ error: "Data frame tidak valid" });
    }

    await writeStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile, frames);
    return res.json({ success: true, ...frames });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menyimpan konfigurasi frame" });
  }
});

// GET /api/config/landing
router.get("/landing", async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  try {
    let config = null;

    if (process.env.DATABASE_URL) {
      try {
        const dbRecord = await prisma.appConfig.findUnique({
          where: { key: "landing_config" }
        });
        if (dbRecord && dbRecord.value) {
          config = typeof dbRecord.value === "string" ? JSON.parse(dbRecord.value) : dbRecord.value;
        }
      } catch (dbErr) {}
    }

    if (!config && fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, "utf8");
        config = JSON.parse(raw);
      } catch (fsErr) {}
    }

    const defaultBase = {
      theme: "wedding",
      title: "The Wedding Celebration",
      subtitle: "Abadikan momen bahagia dan penuh cinta di hari istimewa ini.",
      coupleNames: "Kevin & Sheila",
      eventDate: "Saturday, 17 October 2026",
      eventTitle: "The Wedding Celebration",
      eventSubtitle: "Abadikan momen bahagia dan penuh cinta di hari istimewa ini.",
      footerText: "Scan QR di hasil cetak untuk mengunduh fotomu • Free high-res download",
      requireSessionCode: false,
      sessionCode: "1234",
      adminExitCode: "9999",
      isLive: false,
      printerName: "Niimbot 4R Photo Printer",
      paperSize: "4R",
      printCopies: 1,
      printerModelPreset: "b1_pro",
      printMethod: "kiosk",
      autoPrint: false,
      printOrientation: "portrait",
      bluetoothDeviceName: "",
      bluetoothLabelSize: "50x50",
      bluetoothLabelWidthMm: 50,
      bluetoothLabelHeightMm: 50,
      bluetoothMarginMm: 0,
      bluetoothFitMode: "fit",
      bluetoothAutoRotate: true,
      bluetoothDensity: 1,
      bluetoothBrightnessPreset: "asli",
      bluetoothBrightness: 0,
      bluetoothContrast: 1.10,
      bluetoothGamma: 1.15,
      bluetoothDither: "atkinson",
      bluetoothSharpen: true,
      videoDisplayMode: "background",
      countdownDuration: 3
    };

    if (!config) {
      config = {};
    }

    // Frame data is stored separately in its own config row/file.
    await ensureFramesConfig();
    config = stripFrameFields(config);

    if (!config.videoUrl) {
      const latestMedia = getLatestLandingMedia();
      if (latestMedia) {
        config.videoUrl = latestMedia;
        config.enableVideo = true;
      }
    }

    if (process.env.DATABASE_URL) {
      prisma.appConfig.upsert({
        where: { key: "landing_config" },
        create: { key: "landing_config", value: config },
        update: { value: config }
      }).catch(() => {});
    }
    try {
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
    } catch (_) {}

    const mergedConfig = { ...defaultBase, ...config };
    return res.json({ success: true, config: mergedConfig });
  } catch (err) {
    return res.status(500).json({ error: "Gagal membaca konfigurasi landing page" });
  }
});

// POST /api/config/landing
router.post("/landing", async (req, res) => {
  try {
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== "object") {
      return res.status(400).json({ error: "Data konfigurasi tidak valid" });
    }

    // Frame data has its own config row/file and must not be stored here.
    const framesPayload = extractFramesPayload(newConfig);
    if (framesPayload) {
      await writeStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile, framesPayload);
    }

    const landingConfig = stripFrameFields(newConfig);

    // Sanitize any transient blob URLs
    if (landingConfig.videoUrl && landingConfig.videoUrl.startsWith("blob:")) {
      landingConfig.videoUrl = "";
    }

    await writeStoredConfig(LANDING_CONFIG_KEY, configFile, landingConfig);

    return res.json({ success: true, config: landingConfig });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menyimpan konfigurasi landing page" });
  }
});

// GET /api/config/media - Searches media subfolder and uploads root
router.get("/media", (req, res) => {
  try {
    const searchDirs = [
      { dir: mediaDir, urlPrefix: "/uploads/media" },
      { dir: uploadsDir, urlPrefix: "/uploads" }
    ];

    const seen = new Set();
    const mediaFiles = [];

    for (const { dir, urlPrefix } of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const rawFiles = fs.readdirSync(dir);

      for (const file of rawFiles) {
        if (seen.has(file)) continue;
        try {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) continue;

          const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(file);
          const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file);
          if (!isVideo && !isImage) continue;

          seen.add(file);
          mediaFiles.push({
            filename: file,
            size: stat.size,
            mtime: stat.mtimeMs,
            createdAt: stat.mtime,
            isVideo,
            url: `${urlPrefix}/${file}`
          });
        } catch (_) {}
      }
    }

    // Sort newest first
    mediaFiles.sort((a, b) => b.mtime - a.mtime);

    return res.json({ success: true, files: mediaFiles });
  } catch (err) {
    return res.status(500).json({ error: "Gagal membaca direktori media" });
  }
});

// DELETE /api/config/media - Deletes media file from storage and updates config store
router.delete("/media", async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: "Filename wajib disertakan" });
    }
    const safeName = path.basename(filename);
    const searchDirs = [mediaDir, uploadsDir, framesDir, photosDir];

    let deleted = false;
    for (const dir of searchDirs) {
      const filePath = path.join(dir, safeName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          deleted = true;
        } catch (_) {}
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: "File tidak ditemukan" });
    }

    // Also update config store if deleted file was active videoUrl or media
    try {
      let cfg = null;
      if (fs.existsSync(configFile)) {
        cfg = JSON.parse(fs.readFileSync(configFile, "utf8"));
      }
      if (cfg && cfg.videoUrl && cfg.videoUrl.includes(safeName)) {
        cfg.videoUrl = "";
        cfg.enableVideo = false;
        fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), "utf8");
        if (process.env.DATABASE_URL) {
          await prisma.appConfig.upsert({
            where: { key: "landing_config" },
            create: { key: "landing_config", value: cfg },
            update: { value: cfg }
          }).catch(() => {});
        }
      }
    } catch (_) {}

    return res.json({ success: true, deleted: true, filename: safeName });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menghapus file media" });
  }
});

// DELETE /api/config/frame - Deletes custom frame image from storage and removes from customFrames config store
router.delete("/frame", async (req, res) => {
  try {
    const { frameId, filename, imageUrl } = req.body || {};
    if (!frameId && !filename && !imageUrl) {
      return res.status(400).json({ error: "frameId, filename, atau imageUrl wajib disertakan" });
    }

    const targetName = filename ? path.basename(filename) : (imageUrl ? path.basename(imageUrl) : "");
    let fileDeleted = false;

    // Delete image file from storage if safe file name exists and is not a built-in static asset
    if (targetName && !targetName.startsWith("default_") && targetName.length > 3) {
      const searchDirs = [framesDir, uploadsDir, mediaDir];
      for (const dir of searchDirs) {
        const filePath = path.join(dir, targetName);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            fileDeleted = true;
          } catch (_) {}
        }
      }
    }

    // Update the dedicated frames config store (never the landing config)
    const currentFrames = await ensureFramesConfig();
    const remainingFrames = currentFrames.customFrames.filter((f) => {
      if (frameId && f.id === frameId) return false;
      if (targetName && f.imageUrl && f.imageUrl.includes(targetName)) return false;
      return true;
    });

    const activeWasDeleted = currentFrames.customFrame && (
      (frameId && currentFrames.customFrame.id === frameId) ||
      (targetName && currentFrames.customFrame.imageUrl && currentFrames.customFrame.imageUrl.includes(targetName))
    );

    const updatedFrames = {
      customFrames: remainingFrames,
      customFrame: activeWasDeleted
        ? (remainingFrames.find((f) => f && f.enabled) || remainingFrames[0] || null)
        : currentFrames.customFrame
    };

    await writeStoredConfig(FRAMES_CONFIG_KEY, framesConfigFile, updatedFrames);

    return res.json({
      success: true,
      deleted: true,
      fileDeleted,
      frameId,
      filename: targetName,
      customFrames: updatedFrames.customFrames,
      customFrame: updatedFrames.customFrame,
      config: updatedFrames
    });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menghapus file frame dan konfigurasi" });
  }
});

// POST /api/config/verify-admin
router.post("/verify-admin", async (req, res) => {
  try {
    const code = req.body.adminCode || req.body.code;
    let storedAdminCode = "9999";

    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, "utf8");
        const cfg = JSON.parse(raw);
        if (cfg && cfg.adminExitCode) {
          storedAdminCode = String(cfg.adminExitCode);
        }
      } catch (_) {}
    }

    if (code !== undefined && String(code).trim() === storedAdminCode.trim()) {
      return res.json({ success: true, authorized: true, verified: true });
    }
    return res.status(401).json({ success: false, error: "Kode PIN Admin tidak cocok" });
  } catch (err) {
    return res.status(500).json({ error: "Gagal memverifikasi kode admin" });
  }
});

export default router;
