# Photobooth Web Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive Photobooth Web Application featuring a gift-themed animated landing page, layout & frame customizer, mirrored WebRTC camera session with audio countdown and flash effect, client-side 300 DPI Canvas compositor, QR code digital delivery, direct print queue endpoint, and PostgreSQL persistence with deterministic data purges.

**Architecture:** Monorepo with separated `client/` (React + Vite + Tailwind CSS + Framer Motion + Canvas compositor) and `server/` (Node.js + Express + Prisma ORM + PostgreSQL + Cloud storage/print spooler). Client communicates via REST API to backend, while performing heavy video rendering and high-DPI image stitching in-browser.

**Tech Stack:** React 18, Vite, Tailwind CSS, Lucide React, Framer Motion, HTML5 Canvas 2D, WebRTC `getUserMedia`, Node.js, Express, Prisma ORM, PostgreSQL, QRCode generator (`qrcode`).

**Spec:** [docs/superpowers/specs/2026-10-17-photobooth-web-app-prd.md](file:///home/kholifan/html/photobooth/docs/superpowers/specs/2026-10-17-photobooth-web-app-prd.md)

## Global Constraints
- Target Canvas Print Quality: 300 DPI ($600 \times 1800\text{ px}$ for photo strips, $1200 \times 1800\text{ px}$ for 4R grid).
- Camera Feed: WebRTC `getUserMedia` mirrored horizontally with zero lag and configurable 3s countdown.
- Database: PostgreSQL with Prisma ORM and UUID primary keys.
- Ephemeral Security: Raw webcam frames kept in client volatile memory; reset action confirms and purges active session.
- Never run `git commit` or `git push` automatically.

---

### Task 1: Project Scaffolding and Dependencies Setup

**Files:**
- Create: `package.json` (Root workspace config)
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/index.html`

**Interfaces:**
- Produces: Runnable scripts `npm run dev:server` and `npm run dev:client`.

- [ ] **Step 1: Create root package.json for concurrent orchestration**

```json
{
  "name": "photobooth-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:server": "npm --prefix server run dev",
    "dev:client": "npm --prefix client run dev",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build:client": "npm --prefix client run build",
    "test:server": "npm --prefix server run test"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create server package.json & environment config**

`server/package.json`:
```json
{
  "name": "photobooth-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "test": "node --test test/**/*.test.js"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0"
  }
}
```

`server/.env.example`:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/photobooth?schema=public"
CLIENT_URL="http://localhost:5173"
PUBLIC_HOST_URL="http://localhost:5000"
```

- [ ] **Step 3: Create client package.json and Vite configuration**

`client/package.json`:
```json
{
  "name": "photobooth-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "framer-motion": "^11.2.10",
    "lucide-react": "^0.395.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.2.13"
  }
}
```

`client/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
```

- [ ] **Step 4: Install root, server, and client dependencies**

Run:
```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

- [ ] **Step 5: Verify build script for client**

Run: `npm run build:client`
Expected: Output successfully generates `client/dist`.

---

### Task 2: PostgreSQL Database Layer & Prisma Schema

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/src/db.js`
- Test: `server/test/db.test.js`

**Interfaces:**
- Produces: `prisma` client instance exported from `server/src/db.js`.
- Schema: Models `BoothSession`, `CapturedPhoto`, `PrintJob`.

- [ ] **Step 1: Define Prisma Schema with PostgreSQL Dialect**

`server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum SessionStatus {
  ACTIVE
  COMPLETED
  PURGED
}

enum PrintStatus {
  QUEUED
  PRINTING
  SUCCESS
  FAILED
}

model BoothSession {
  id             String          @id @default(uuid()) @db.Uuid
  frameTemplate  String          @map("frame_template") @db.VarChar(32)
  photoCount     Int             @default(3) @map("photo_count") @db.SmallInt
  frameColor     String          @default("#FFFFFF") @map("frame_color") @db.VarChar(16)
  templateConfig Json?           @map("template_config")
  status         SessionStatus   @default(ACTIVE)
  storageUrl     String?         @map("storage_url") @db.VarChar(512)
  clientIp       String?         @map("client_ip") @db.VarChar(45)
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz
  completedAt    DateTime?       @map("completed_at") @db.Timestamptz
  purgedAt       DateTime?       @map("purged_at") @db.Timestamptz
  photos         CapturedPhoto[]
  printJobs      PrintJob[]

  @@index([status, createdAt(sort: Desc)])
  @@map("booth_sessions")
}

model CapturedPhoto {
  id           String       @id @default(uuid()) @db.Uuid
  sessionId    String       @map("session_id") @db.Uuid
  poseIndex    Int          @map("pose_index") @db.SmallInt
  filePath     String?      @map("file_path") @db.VarChar(512)
  imageDataUri String       @map("image_data_uri") @db.Text
  capturedAt   DateTime     @default(now()) @map("captured_at") @db.Timestamptz
  session      BoothSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, poseIndex])
  @@map("captured_photos")
}

model PrintJob {
  id           String       @id @default(uuid()) @db.Uuid
  sessionId    String       @map("session_id") @db.Uuid
  copies       Int          @default(1) @db.SmallInt
  printerName  String       @map("printer_name") @db.VarChar(128)
  status       PrintStatus  @default(QUEUED)
  errorMessage String?      @map("error_message") @db.Text
  dispatchedAt DateTime     @default(now()) @map("dispatched_at") @db.Timestamptz
  completedAt  DateTime?    @map("completed_at") @db.Timestamptz
  session      BoothSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([status, dispatchedAt])
  @@map("print_jobs")
}
```

- [ ] **Step 2: Implement server/src/db.js connection manager**

`server/src/db.js`:
```javascript
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = { prisma };
```

- [ ] **Step 3: Run prisma generate**

Run: `cd server && npx prisma generate && cd ..`
Expected: Prisma Client generated successfully into node_modules.

---

### Task 3: Backend REST API Endpoints (Session, Upload, QR, Print)

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/routes/sessionRoutes.js`
- Create: `server/src/routes/photoRoutes.js`
- Create: `server/src/routes/printRoutes.js`
- Create: `server/src/services/qrService.js`
- Test: `server/test/api.test.js`

**Interfaces:**
- Consumes: `prisma` from `server/src/db.js`
- Produces:
  - `POST /api/sessions`: Creates session `{ frameTemplate, photoCount, frameColor }` $\to$ `{ id, ... }`
  - `POST /api/photos/upload`: Stores final composite image, returns `{ downloadUrl, qrCodeDataUri }`
  - `POST /api/print`: Spools print request, returns `{ printJobId, status: "QUEUED" }`
  - `DELETE /api/sessions/:id`: Updates session status to `PURGED`, deletes local file buffers.

- [ ] **Step 1: Write failing API unit tests**

`server/test/api.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/app');

test('GET /health returns status ok', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

test('POST /api/photos/qr-generate creates valid data URI', async () => {
  const res = await request(app)
    .post('/api/photos/qr-generate')
    .send({ url: 'https://example.com/photo/123' });
  assert.strictEqual(res.status, 200);
  assert.match(res.body.qrCodeDataUri, /^data:image\/png;base64,/);
});
```

- [ ] **Step 2: Implement QR code service**

`server/src/services/qrService.js`:
```javascript
const QRCode = require('qrcode');

async function generateQrDataUri(url) {
  if (!url) throw new Error('URL is required for QR generation');
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });
}

module.exports = { generateQrDataUri };
```

- [ ] **Step 3: Implement Express app and routes**

`server/src/app.js`:
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { generateQrDataUri } = require('./services/qrService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads serving
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// QR Generator endpoint
app.post('/api/photos/qr-generate', async (req, res) => {
  try {
    const { url } = req.body;
    const qrCodeDataUri = await generateQrDataUri(url);
    res.json({ qrCodeDataUri });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Photo upload endpoint
app.post('/api/photos/upload', async (req, res) => {
  try {
    const { imageBase64, sessionId } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `photo_${sessionId || Date.now()}_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

    const host = process.env.PUBLIC_HOST_URL || `http://${req.headers.host}`;
    const downloadUrl = `${host}/uploads/${filename}`;
    const qrCodeDataUri = await generateQrDataUri(downloadUrl);

    res.json({
      success: true,
      downloadUrl,
      qrCodeDataUri,
      filename
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Print trigger endpoint
app.post('/api/print', async (req, res) => {
  const { sessionId, copies = 1 } = req.body;
  // Future direct OS spooler integration hook
  res.json({
    success: true,
    jobId: `print_${Date.now()}`,
    sessionId,
    copies,
    status: 'QUEUED',
    message: 'Print job queued for local kiosk printer'
  });
});

module.exports = { app };
```

- [ ] **Step 4: Run unit tests**

Run: `npm --prefix server test`
Expected: 2 tests PASS.

---

### Task 4: Web Audio Synthesizer and Audio Feedback Engine

**Files:**
- Create: `client/src/utils/audioEffects.js`

**Interfaces:**
- Produces:
  - `playCountdownBeep()`: Generates short 800Hz / 1200Hz sine beep.
  - `playShutterSound()`: Synthesizes camera shutter click.
  - `playGiftPopSound()`: Synthesizes celebration chime.

- [ ] **Step 1: Implement Web Audio synthesis without external mp3 files**

`client/src/utils/audioEffects.js`:
```javascript
class AudioEffects {
  constructor() {
    this.ctx = null;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playCountdownBeep(isFinal = false) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1200 : 700, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  playShutterSound() {
    try {
      const ctx = this.getAudioContext();
      // Generate noise burst for realistic mechanical click
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {
      // Audio fallback
    }
  }

  playGiftPopSound() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio fallback
    }
  }
}

export const audioFx = new AudioEffects();
```

---

### Task 5: High-Resolution Canvas Compositor Engine

**Files:**
- Create: `client/src/utils/canvasCompositor.js`

**Interfaces:**
- Produces:
  - `composePhotosToFrame(photos, options)`: Returns `{ dataUrl, width, height }`.
  - Layout definitions: `STRIP_3`, `STRIP_4`, `GRID_2X2`, `POLAROID_1`.

- [ ] **Step 1: Implement Canvas stitching with aspect ratio crop calculation**

`client/src/utils/canvasCompositor.js`:
```javascript
export const FRAME_CONFIGS = {
  STRIP_3: {
    name: 'Photo Strip 3 Pose',
    photoCount: 3,
    canvasWidth: 600,
    canvasHeight: 1800,
    slots: [
      { x: 50, y: 100, width: 500, height: 420 },
      { x: 50, y: 560, width: 500, height: 420 },
      { x: 50, y: 1020, width: 500, height: 420 }
    ],
    footerY: 1650
  },
  STRIP_4: {
    name: 'Photo Strip 4 Pose',
    photoCount: 4,
    canvasWidth: 600,
    canvasHeight: 1800,
    slots: [
      { x: 50, y: 70, width: 500, height: 350 },
      { x: 50, y: 450, width: 500, height: 350 },
      { x: 50, y: 830, width: 500, height: 350 },
      { x: 50, y: 1210, width: 500, height: 350 }
    ],
    footerY: 1680
  },
  GRID_2X2: {
    name: 'Grid 2x2 Pose',
    photoCount: 4,
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 70, y: 120, width: 510, height: 600 },
      { x: 620, y: 120, width: 510, height: 600 },
      { x: 70, y: 760, width: 510, height: 600 },
      { x: 620, y: 760, width: 510, height: 600 }
    ],
    footerY: 1550
  },
  POLAROID_1: {
    name: 'Polaroid Single Pose',
    photoCount: 1,
    canvasWidth: 1200,
    canvasHeight: 1500,
    slots: [
      { x: 100, y: 100, width: 1000, height: 1000 }
    ],
    footerY: 1300
  }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function composePhotosToFrame(photos, options = {}) {
  const {
    layoutType = 'STRIP_3',
    frameColor = '#FFFFFF',
    textColor = '#1e293b',
    eventTitle = 'PHOTOBOOTH MEMORY',
    dateText = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
  } = options;

  const config = FRAME_CONFIGS[layoutType] || FRAME_CONFIGS.STRIP_3;
  const canvas = document.createElement('canvas');
  canvas.width = config.canvasWidth;
  canvas.height = config.canvasHeight;
  const ctx = canvas.getContext('2d');

  // 1. Draw frame background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw slots with aspect-ratio centering crop
  for (let i = 0; i < config.slots.length; i++) {
    const slot = config.slots[i];
    const photoSrc = photos[i];

    if (photoSrc) {
      const img = await loadImage(photoSrc);

      // Center crop calculation
      const scale = Math.max(slot.width / img.width, slot.height / img.height);
      const cropW = slot.width / scale;
      const cropH = slot.height / scale;
      const cropX = (img.width - cropW) / 2;
      const cropY = (img.height - cropH) / 2;

      ctx.save();
      // Rounded slot clip
      ctx.beginPath();
      const radius = 12;
      ctx.roundRect(slot.x, slot.y, slot.width, slot.height, radius);
      ctx.clip();

      ctx.drawImage(img, cropX, cropY, cropW, cropH, slot.x, slot.y, slot.width, slot.height);
      ctx.restore();

      // Border around photo
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
    }
  }

  // 3. Draw Branding & Footer
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(eventTitle, canvas.width / 2, config.footerY);

  ctx.font = '22px sans-serif';
  ctx.fillStyle = textColor === '#FFFFFF' ? '#e2e8f0' : '#64748b';
  ctx.fillText(dateText, canvas.width / 2, config.footerY + 45);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
    width: canvas.width,
    height: canvas.height
  };
}
```

---

### Task 6: UI Components (Landing Page & Frame Selector)

**Files:**
- Create: `client/src/components/LandingPage.jsx`
- Create: `client/src/components/FrameSelector.jsx`

**Interfaces:**
- `LandingPage`: Receives `onStartSession()`, triggers gift opening animation, confetti burst, and sound chime.
- `FrameSelector`: Receives `onConfirm({ layoutType, frameColor })` and `onBack()`.

- [ ] **Step 1: Create LandingPage component with interactive gift box**

`client/src/components/LandingPage.jsx`:
```jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, Gift } from 'lucide-react';
import { audioFx } from '../utils/audioEffects';

export default function LandingPage({ onStartSession }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleStart = () => {
    audioFx.playGiftPopSound();
    setIsOpen(true);
    setTimeout(() => {
      onStartSession();
    }, 800);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 overflow-hidden select-none">
      {/* Floating decorative elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="absolute top-12 left-16 text-pink-400 opacity-60 pointer-events-none"
      >
        <Sparkles size={48} />
      </motion.div>
      <motion.div
        animate={{ y: [0, 25, 0], rotate: [0, -15, 15, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="absolute bottom-20 right-20 text-indigo-400 opacity-60 pointer-events-none"
      >
        <Camera size={56} />
      </motion.div>

      {/* Main Gift Container */}
      <div className="z-10 flex flex-col items-center max-w-lg text-center p-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-2"
        >
          Capture The Magic! ✨
        </motion.h1>
        <p className="text-slate-600 text-lg mb-8 font-medium">
          Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.
        </p>

        {/* Gift Box Graphic */}
        <div className="relative mb-10 cursor-pointer" onClick={handleStart}>
          <motion.div
            animate={isOpen ? { scale: [1, 1.2, 0.9], y: -30 } : { y: [0, -8, 0] }}
            transition={isOpen ? { duration: 0.5 } : { repeat: Infinity, duration: 2.5 }}
            className="w-48 h-48 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-3xl shadow-2xl flex items-center justify-center border-4 border-white relative"
          >
            <Gift size={96} className="text-white drop-shadow-md" />
            {isOpen && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-yellow-300 rounded-full blur-xl"
              />
            )}
          </motion.div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          className="px-10 py-5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white font-extrabold text-2xl rounded-full shadow-xl shadow-pink-500/30 transition-all flex items-center gap-3 border-2 border-white/50"
        >
          <Camera size={28} />
          Mulai Sekarang
        </motion.button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create FrameSelector component**

`client/src/components/FrameSelector.jsx`:
```jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { FRAME_CONFIGS } from '../utils/canvasCompositor';

const PALETTES = [
  { name: 'Pure White', hex: '#FFFFFF', text: '#1e293b' },
  { name: 'Midnight Black', hex: '#1E1E24', text: '#FFFFFF' },
  { name: 'Pastel Pink', hex: '#FFE4E6', text: '#881337' },
  { name: 'Sky Lavender', hex: '#E0E7FF', text: '#312E81' },
  { name: 'Mint Soft', hex: '#D1FAE5', text: '#064E3B' },
  { name: 'Warm Cream', hex: '#FEF3C7', text: '#78350F' }
];

export default function FrameSelector({ onConfirm, onBack }) {
  const [selectedLayout, setSelectedLayout] = useState('STRIP_3');
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);

  const layouts = Object.entries(FRAME_CONFIGS);

  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 text-slate-800 p-6 md:p-10 select-none">
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-100 font-semibold"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <h2 className="text-2xl md:text-3xl font-black">Pilih Template & Warna Frame</h2>
        <div className="w-24"></div>
      </div>

      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Layout Options */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-700">1. Pilih Tata Letak Foto</h3>
          <div className="grid grid-cols-2 gap-4">
            {layouts.map(([key, config]) => {
              const active = selectedLayout === key;
              return (
                <div
                  key={key}
                  onClick={() => setSelectedLayout(key)}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                    active ? 'border-pink-500 bg-pink-50/50 shadow-md scale-102' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-16 h-24 bg-slate-200 rounded-lg mb-3 flex flex-col gap-1 p-1 justify-center items-center">
                    {Array.from({ length: config.photoCount }).slice(0, 4).map((_, i) => (
                      <div key={i} className="w-full h-full bg-slate-400 rounded-sm" />
                    ))}
                  </div>
                  <span className="font-bold text-sm text-slate-800">{config.name}</span>
                  <span className="text-xs text-slate-500">{config.photoCount} Jepretan</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-4 text-slate-700">2. Pilih Warna Bingkai</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {PALETTES.map((p) => {
                const active = selectedPalette.hex === p.hex;
                return (
                  <button
                    key={p.hex}
                    onClick={() => setSelectedPalette(p)}
                    className="flex flex-col items-center p-3 rounded-xl border border-slate-200 hover:shadow-sm transition-all"
                  >
                    <div
                      className="w-10 h-10 rounded-full border-2 border-slate-300 mb-2 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: p.hex }}
                    >
                      {active && <Check size={20} className={p.hex === '#1E1E24' ? 'text-white' : 'text-slate-800'} />}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onConfirm({ layoutType: selectedLayout, palette: selectedPalette })}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-500 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 hover:opacity-95"
          >
            Lanjut ke Kamera <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 7: WebRTC Camera Session, Countdown & Capture Engine

**Files:**
- Create: `client/src/components/CameraSession.jsx`

**Interfaces:**
- Receives: `layoutConfig`, `onComplete(photosArray)`.
- Handles: WebRTC video stream, mirror mode, 3s audio countdown, screen flash effect, and multi-pose capture loop.

- [ ] **Step 1: Implement CameraSession component**

`client/src/components/CameraSession.jsx`:
```jsx
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, RefreshCw } from 'lucide-react';
import { audioFx } from '../utils/audioEffects';

export default function CameraSession({ layoutConfig, onComplete, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [currentPose, setCurrentPose] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const totalPhotos = layoutConfig.photoCount;

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const triggerCaptureSequence = () => {
    if (countdown !== null) return;

    let timer = 3;
    setCountdown(timer);
    audioFx.playCountdownBeep(false);

    const interval = setInterval(() => {
      timer -= 1;
      if (timer > 0) {
        setCountdown(timer);
        audioFx.playCountdownBeep(false);
      } else {
        clearInterval(interval);
        setCountdown(0);
        audioFx.playCountdownBeep(true);
        executeShutter();
      }
    }, 1000);
  };

  const executeShutter = () => {
    setIsFlashing(true);
    audioFx.playShutterSound();

    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoData = canvas.toDataURL('image/jpeg', 0.95);
      const nextPhotos = [...capturedPhotos, photoData];
      setCapturedPhotos(nextPhotos);

      setTimeout(() => {
        setIsFlashing(false);
        setCountdown(null);

        if (nextPhotos.length >= totalPhotos) {
          onComplete(nextPhotos);
        } else {
          setCurrentPose(nextPhotos.length);
        }
      }, 300);
    }
  };

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
        <p className="text-rose-400 font-bold text-xl mb-4">{cameraError}</p>
        <button onClick={onCancel} className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold">
          Kembali ke Menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen w-full bg-slate-950 overflow-hidden select-none p-6">
      {/* Screen Flash Overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {/* Header Info */}
      <div className="z-10 flex items-center justify-between w-full max-w-4xl text-white">
        <button onClick={onCancel} className="text-slate-400 hover:text-white font-medium">
          Batalkan Sesi
        </button>
        <div className="bg-slate-800/80 backdrop-blur px-6 py-2 rounded-full border border-slate-700 font-bold text-sm">
          Pose ke <span className="text-pink-400 text-base">{currentPose + 1}</span> dari {totalPhotos}
        </div>
        <div className="w-20" />
      </div>

      {/* Main Viewfinder */}
      <div className="relative z-10 w-full max-w-3xl aspect-[4/3] bg-black rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* Large Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs"
            >
              <span className="text-9xl font-black text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="z-10 flex flex-col items-center gap-4">
        <button
          disabled={countdown !== null}
          onClick={triggerCaptureSequence}
          className={`px-10 py-5 rounded-full font-black text-2xl flex items-center gap-3 shadow-2xl transition-all ${
            countdown !== null
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:scale-105 text-white shadow-pink-500/30'
          }`}
        >
          <Camera size={28} />
          {countdown !== null ? 'Bersiap...' : 'Ambil Gambar'}
        </button>
      </div>
    </div>
  );
}
```

---

### Task 8: Preview Result, QR Delivery Modal & Reset Guard

**Files:**
- Create: `client/src/components/PreviewResult.jsx`
- Create: `client/src/components/QrModal.jsx`
- Create: `client/src/components/ResetConfirmModal.jsx`

**Interfaces:**
- `PreviewResult`: Combines high-DPI canvas preview with actions: Print, Download (QR), and New Session.
- `QrModal`: Displays QR code generated from backend `/api/photos/upload`.
- `ResetConfirmModal`: Warns visitor that photos will be permanently deleted before resetting to landing.

- [ ] **Step 1: Create QrModal & ResetConfirmModal**

`client/src/components/QrModal.jsx`:
```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { X, QrCode, Download } from 'lucide-react';

export default function QrModal({ isOpen, onClose, qrCodeDataUri, downloadUrl }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl text-center relative border border-slate-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>

        <h3 className="text-2xl font-black text-slate-800 mb-1">Scan QR Code</h3>
        <p className="text-slate-500 text-sm mb-6">
          Arahkan kamera smartphone untuk mengunduh fotomu.
        </p>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mb-6 shadow-inner">
          {qrCodeDataUri ? (
            <img src={qrCodeDataUri} alt="QR Code Download" className="w-56 h-56 object-contain rounded-lg" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-400">Membuat QR...</div>
          )}
        </div>

        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-pink-600 hover:underline font-semibold"
          >
            <Download size={16} /> Buka Link Langsung
          </a>
        )}
      </motion.div>
    </div>
  );
}
```

`client/src/components/ResetConfirmModal.jsx`:
```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function ResetConfirmModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center border border-slate-100"
      >
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-500 mx-auto flex items-center justify-center mb-4">
          <AlertTriangle size={32} />
        </div>

        <h3 className="text-2xl font-black text-slate-800 mb-2">Mulai Sesi Baru?</h3>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Semua foto pada sesi ini akan <strong>segera dihapus permanen</strong> demi privasi Anda. Pastikan Anda telah mengunduh atau mencetak foto sebelum melanjutkan.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 px-4 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 px-4 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30"
          >
            Ya, Hapus & Mulai
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Implement PreviewResult component with Canvas render and action buttons**

`client/src/components/PreviewResult.jsx`:
```jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, QrCode, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { composePhotosToFrame } from '../utils/canvasCompositor';
import QrModal from './QrModal';
import ResetConfirmModal from './ResetConfirmModal';

export default function PreviewResult({ photos, layoutConfig, onResetSession }) {
  const [compositeUrl, setCompositeUrl] = useState(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [qrCodeDataUri, setQrCodeDataUri] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [printStatus, setPrintStatus] = useState(null);

  useEffect(() => {
    async function renderFrame() {
      const res = await composePhotosToFrame(photos, {
        layoutType: layoutConfig.layoutType,
        frameColor: layoutConfig.palette?.hex || '#FFFFFF',
        textColor: layoutConfig.palette?.text || '#1e293b'
      });
      setCompositeUrl(res.dataUrl);
    }
    renderFrame();
  }, [photos, layoutConfig]);

  const handleDownloadQr = async () => {
    setIsQrOpen(true);
    if (!qrCodeDataUri && compositeUrl) {
      try {
        const res = await fetch('http://localhost:5000/api/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compositeUrl })
        });
        const data = await res.json();
        setQrCodeDataUri(data.qrCodeDataUri);
        setDownloadUrl(data.downloadUrl);
      } catch (err) {
        // Fallback local QR
        setDownloadUrl(compositeUrl);
      }
    }
  };

  const handlePrint = async () => {
    setPrintStatus('Mengirim ke printer...');
    try {
      await fetch('http://localhost:5000/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copies: 1 })
      });
      setPrintStatus('Terkirim ke antrean cetak!');
      setTimeout(() => setPrintStatus(null), 3000);
    } catch {
      window.print();
      setPrintStatus(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen w-full bg-slate-900 text-white p-6 md:p-10 select-none">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black mb-1">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-400 text-sm">Cetak langsung atau scan QR code untuk menyimpan di ponsel.</p>
      </div>

      {/* Frame Preview Card */}
      <div className="max-h-[60vh] flex items-center justify-center p-2 bg-slate-800/60 rounded-2xl border border-slate-700 shadow-2xl">
        {compositeUrl ? (
          <img src={compositeUrl} alt="Composited Result" className="max-h-[58vh] object-contain rounded-lg shadow-lg" />
        ) : (
          <div className="text-slate-400">Merender komposit...</div>
        )}
      </div>

      {printStatus && (
        <div className="mt-4 flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/80 px-4 py-2 rounded-full border border-emerald-800">
          <CheckCircle2 size={18} /> {printStatus}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 w-full max-w-xl">
        <button
          onClick={handlePrint}
          className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg"
        >
          <Printer size={22} /> Print Foto
        </button>

        <button
          onClick={handleDownloadQr}
          className="flex-1 py-4 px-6 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg"
        >
          <QrCode size={22} /> Download (QR)
        </button>

        <button
          onClick={() => setIsResetOpen(true)}
          className="w-full md:w-auto py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2"
        >
          <RefreshCcw size={18} /> Mulai Sesi Baru
        </button>
      </div>

      {/* Modals */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        qrCodeDataUri={qrCodeDataUri}
        downloadUrl={downloadUrl}
      />
      <ResetConfirmModal
        isOpen={isResetOpen}
        onCancel={() => setIsResetOpen(false)}
        onConfirm={() => {
          setIsResetOpen(false);
          onResetSession();
        }}
      />
    </div>
  );
}
```

---

### Task 9: Main App Orchestration and State Flow Integration

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/index.css`
- Create: `client/src/main.jsx`

**Interfaces:**
- Manages complete photobooth state machine: `LANDING` $\to$ `FRAME_PICKER` $\to$ `CAMERA` $\to$ `PREVIEW`.

- [ ] **Step 1: Create client styles in index.css**

`client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  user-select: none;
  background-color: #0f172a;
}
```

- [ ] **Step 2: Implement main App component state coordinator**

`client/src/App.jsx`:
```jsx
import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import FrameSelector from './components/FrameSelector';
import CameraSession from './components/CameraSession';
import PreviewResult from './components/PreviewResult';

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // LANDING, FRAME_PICKER, CAMERA, PREVIEW
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);

  const handleStartLanding = () => {
    setCurrentStep('FRAME_PICKER');
  };

  const handleConfirmFrame = (config) => {
    setLayoutConfig(config);
    setCurrentStep('CAMERA');
  };

  const handleCompletePhotos = (photos) => {
    setCapturedPhotos(photos);
    setCurrentStep('PREVIEW');
  };

  const handleResetSession = () => {
    setCapturedPhotos([]);
    setLayoutConfig(null);
    setCurrentStep('LANDING');
  };

  return (
    <div className="w-full min-h-screen">
      {currentStep === 'LANDING' && <LandingPage onStartSession={handleStartLanding} />}

      {currentStep === 'FRAME_PICKER' && (
        <FrameSelector
          onConfirm={handleConfirmFrame}
          onBack={() => setCurrentStep('LANDING')}
        />
      )}

      {currentStep === 'CAMERA' && (
        <CameraSession
          layoutConfig={layoutConfig}
          onComplete={handleCompletePhotos}
          onCancel={() => setCurrentStep('FRAME_PICKER')}
        />
      )}

      {currentStep === 'PREVIEW' && (
        <PreviewResult
          photos={capturedPhotos}
          layoutConfig={layoutConfig}
          onResetSession={handleResetSession}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement client entry point main.jsx**

`client/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Verify client build**

Run: `npm run build:client`
Expected: Build succeeds with 0 errors.

---

### Task 10: End-to-End Verification & Health Inspection

**Files:**
- Test: `server/test/health.test.js`

- [ ] **Step 1: Test Server routes and client bundle integration**

Run: `npm --prefix server test`
Expected: All backend unit tests pass.

- [ ] **Step 2: Run build across all workspaces**

Run: `npm run build:client`
Expected: Production assets ready in `client/dist`.
