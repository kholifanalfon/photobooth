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

function getLatestLandingMedia() {
  try {
    if (!fs.existsSync(uploadsDir)) return null;
    const files = fs.readdirSync(uploadsDir);
    const mediaFiles = files.filter((f) => {
      const lower = f.toLowerCase();
      return (
        lower.startsWith("video_landing_") ||
        lower.startsWith("video_") ||
        lower.endsWith(".mp4") ||
        lower.endsWith(".webm") ||
        lower.endsWith(".mov") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".webp")
      );
    });

    if (mediaFiles.length === 0) return null;

    mediaFiles.sort((a, b) => {
      try {
        const statA = fs.statSync(path.join(uploadsDir, a));
        const statB = fs.statSync(path.join(uploadsDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      } catch (_) {
        return 0;
      }
    });

    return `/uploads/${mediaFiles[0]}`;
  } catch (err) {
    return null;
  }
}

// GET /api/config/landing
router.get("/landing", async (req, res) => {
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
      theme: "pastel",
      title: "Captured Moments ✨",
      subtitle: "Sentuh layar atau buka hadiah untuk memulai sesi fotomu hari ini!",
      eventTitle: "OUR SPECIAL DAY",
      eventSubtitle: "Wedding & Anniversary 2026",
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
      countdownDuration: 3,
      customFrame: defaultModern4RFrames[0],
      customFrames: defaultModern4RFrames
    };

    if (!config) {
      const latestMedia = getLatestLandingMedia();
      config = {
        ...defaultBase,
        videoUrl: latestMedia || "",
        enableVideo: Boolean(latestMedia)
      };

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
    }

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

// GET /api/config/media
router.get("/media", (req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, files: [] });
    }
    const files = fs.readdirSync(uploadsDir);
    return res.json({ success: true, files });
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
    const filePath = path.join(uploadsDir, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ success: true, deleted: true, filename: safeName });
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
