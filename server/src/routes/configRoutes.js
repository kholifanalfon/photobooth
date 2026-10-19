import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const configFile = path.resolve(__dirname, "../../data/landing_config.json");
const uploadsDir = path.resolve(__dirname, "../../uploads");
const mediaDir = path.resolve(uploadsDir, "media");

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
      printMethod: "kiosk",
      autoPrint: false,
      videoDisplayMode: "background",
      countdownDuration: 3,
      customFrame: defaultModern4RFrames[0],
      customFrames: defaultModern4RFrames
    };

    if (!config) {
      config = {};
    }
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
    if (!Array.isArray(mergedConfig.customFrames) || mergedConfig.customFrames.length === 0) {
      if (mergedConfig.customFrame) {
        mergedConfig.customFrames = [{ id: 'frame-1', name: 'Frame 1', ...mergedConfig.customFrame }];
      } else {
        mergedConfig.customFrames = defaultModern4RFrames;
      }
    }
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

    // Sanitize any transient blob URLs
    if (newConfig.videoUrl && newConfig.videoUrl.startsWith("blob:")) {
      newConfig.videoUrl = "";
    }

    if (process.env.DATABASE_URL) {
      try {
        await prisma.appConfig.upsert({
          where: { key: "landing_config" },
          create: { key: "landing_config", value: newConfig },
          update: { value: newConfig }
        });
      } catch (dbErr) {}
    }

    try {
      const dataDir = path.dirname(configFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2), "utf8");
    } catch (fsErr) {}

    return res.json({ success: true, config: newConfig });
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

// DELETE /api/config/media
router.delete("/media", (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: "Filename wajib disertakan" });
    }
    const safeName = path.basename(filename);
    const searchDirs = [mediaDir, uploadsDir];

    for (const dir of searchDirs) {
      const filePath = path.join(dir, safeName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, deleted: true, filename: safeName });
      }
    }

    return res.status(404).json({ error: "File tidak ditemukan" });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menghapus file media" });
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
