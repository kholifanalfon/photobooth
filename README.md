# 📷 Photobooth Web Application

Aplikasi web photobooth interaktif modern dengan dukungan WebRTC camera feed mirror realtime, Web Audio synthesizer tanpa file eksternal, compositing canvas cetak beresolusi tinggi (300 DPI), generate QR Code untuk download smartphone, serta spooler antrean cetak foto.

---

## 📋 Fitur Utama

- **WebRTC Viewfinder**: Tampilan kamera responsif dengan mode cermin (mirroring horizontal) bebas latensi dan countdown audio-visual 3 detik.
- **Audio Synthesis Engine**: Efek suara sintetis (tick countdown, shutter kamera mekanis, pop perayaan) langsung menggunakan Web Audio API tanpa dependensi file audio eksternal.
- **High-DPI Canvas Compositor (300 DPI)**:
  - `STRIP_3`: 3 Pose (600 × 1800 px)
  - `STRIP_4`: 4 Pose (600 × 1800 px)
  - `GRID_2X2`: 4 Pose format 4R (1200 × 1800 px)
  - `POLAROID_1`: 1 Pose Vintage (1200 × 1500 px)
- **Desain Frame & Palet Warna**: Pilihan layout dinamis dengan 6 tema warna (Pure White, Midnight Black, Soft Pastel Pink, Sky Breeze, Sage Mint, Vintage Cream).
- **Distribusi QR Code & Cetak**: Generate QR code otomatis untuk unduh foto langsung ke ponsel, serta integrasi tombol print ke antrean spooler (dengan fallback native `window.print()`).
- **Keamanan Data & Privasi (Ephemeral Security)**: Foto disimpan di memori volatil browser selama sesi aktif dan otomatis dibersihkan saat sesi di-reset atau dibatalkan.

---

## ☁️ Menjalankan dengan GitHub Codespaces (Rekomendasi Cloud)

Project ini telah dilengkapi konfigurasi **GitHub Dev Container** (`.devcontainer`) sehingga dapat langsung dijalankan di cloud tanpa instalasi lokal:

1. Buka repositori ini di GitHub.
2. Klik tombol hijau **Code** -> pilih tab **Codespaces** -> klik **Create codespace on main**.
3. Codespace akan otomatis menyiapkan container Linux, Node.js 20, dan database PostgreSQL internal, serta menjalankan instalasi dependensi & Prisma push secara otomatis.
4. Di terminal Codespaces, jalankan:
   ```bash
   npm run dev
   ```
5. Codespace otomatis mem-forward port frontend `5173` dan menampilkan pop-up browser preview aplikasi Photobooth.
> **Catatan Keamanan Port Database:**
> Port database PostgreSQL (5432) dikonfigurasi dengan `"onAutoForward": "ignore"` dan `"visibility": "private"` sehingga **tidak diekspos keluar / publik**, hanya dapat diakses secara lokal/internal oleh backend.

---

## 🐳 Menjalankan dengan Docker Compose (Lokal)

Jika Anda ingin menjalankan seluruh ekosistem (Frontend, Backend, PostgreSQL) di mesin lokal menggunakan Docker:

### 1. Jalankan Seluruh Service
```bash
docker compose up --build
```
Atau melalui NPM script:
```bash
npm run docker:up
```

- **Client Frontend**: [http://localhost:5173](http://localhost:5173)
- **Server API**: [http://localhost:5025](http://localhost:5025)
- **Database PostgreSQL**: Berjalan di dalam jaringan internal Docker (`photobooth-net`). Port `5432` sengaja **tidak diekspor/dipublish ke host** demi keamanan isolasi data lokal.

### 2. Menghentikan Docker
```bash
docker compose down
# Atau: npm run docker:down
```

---

## 🛠️ Menjalankan Secara Manual (Node.js & Local Dev)

### Prasyarat Sistem
Sebelum menjalankan aplikasi, pastikan sistem Anda telah terpasang:
- **Node.js**: Versi `18.x` atau lebih baru (`node -v`)
- **NPM**: Versi `9.x` atau lebih baru (`npm -v`)
- **PostgreSQL** *(Opsional untuk mode persistence penuh)*: Versi `14.x` ke atas.
  > *Catatan: Server dilengkapi dengan fallback memory-session otomatis sehingga Anda tetap dapat menjalankan dan menguji aplikasi secara offline tanpa setup database PostgreSQL.*

### 1. Install Dependensi
Jalankan instalasi dependensi pada root project serta sub-package client & server:

```bash
# Install dependensi root
npm install

# Install dependensi server
npm --prefix server install

# Install dependensi client
npm --prefix client install
```

### 2. Konfigurasi Environment Variable

#### A. Konfigurasi Server (`server/.env`)
Salin template konfigurasi dari `server/.env.example`:
```bash
cp server/.env.example server/.env
```
Contoh isi file `server/.env`:
```env
PORT=5025
DATABASE_URL="postgresql://postgres:P%40ssw0rd@localhost:5432/photobooth?schema=public"
CLIENT_URL="http://localhost:5173"
PUBLIC_HOST_URL="http://localhost:5025"
```

#### B. Konfigurasi Client (`client/.env`)
Salin template konfigurasi dari `client/.env.example`:
```bash
cp client/.env.example client/.env
```
Contoh isi file `client/.env`:
```env
# Port dev server Vite (bisa diubah sesuai keinginan)
PORT=5173
VITE_PORT=5173

# URL API Server backend Express
VITE_API_BASE_URL=http://localhost:5025
```

---

### 3. Setup Prisma Database (Jika Menggunakan PostgreSQL)
Jika database PostgreSQL aktif, generate Prisma Client dan sinkronkan schema:

```bash
# Generate Prisma Client
npm --prefix server run prisma:generate

# Push schema ke database PostgreSQL
npm --prefix server run prisma:push
```

---

## ▶️ Opsi Menjalankan Manual

### Opsi A: Menjalankan Mode Development (Client & Server Bersamaan)
Gunakan perintah satu langkah pada root:

```bash
npm run dev
```

- **Client Vite (Frontend)**: [http://localhost:5173](http://localhost:5173) *(atau sesuai port di `client/.env`)*
- **Express Backend (API)**: [http://localhost:5025](http://localhost:5025) *(atau sesuai port di `server/.env`)*
- **Health Check**: [http://localhost:5025/health](http://localhost:5025/health)

*(Perintah ini menjalankan server nodemon dan client Vite secara paralel via `concurrently`)*.

---

### Opsi B: Menjalankan Server & Client Secara Terpisah

1. **Jalankan Backend Server:**
   ```bash
   npm run dev:server
   # Atau: cd server && npm run dev
   ```

2. **Buka Terminal Baru, Jalankan Frontend Client:**
   ```bash
   npm run dev:client
   # Atau: cd client && npm run dev
   ```

---

### Opsi C: Menjalankan Mode Production (SPA Bundle Terintegrasi)

Untuk menguji server menyajikan frontend bundle secara utuh dari satu port backend:

1. **Build Client Production:**
   ```bash
   npm run build:client
   ```
2. **Jalankan Server Production:**
   ```bash
   npm start
   ```
3. Buka browser di URL port server backend Anda (misal [http://localhost:5025](http://localhost:5025)).

---

## 🧪 Menjalankan Pengujian (Testing)

Proyek ini dilengkapi test suite komprehensif menggunakan native Node.js test runner (`node:test`):

```bash
# Jalankan seluruh test suite (Server + Client)
npm test

# Menjalankan test server saja
npm run test:server

# Menjalankan test client saja
npm run test:client
```

---

## 📂 Struktur Direktori

```text
photobooth/
├── .devcontainer/              # Konfigurasi GitHub Codespaces dev container
│   ├── devcontainer.json       # Definisi workspace, port forwarding & extensions
│   └── docker-compose.yml      # Service PostgreSQL internal & workspace dev
├── docker-compose.yml          # Docker Compose untuk orkestrasi lokal (Client, Server, DB)
├── package.json                # Monorepo task runner (scripts dev, build, test, docker)
├── client/                     # Frontend React + Tailwind CSS + Vite
│   ├── Dockerfile              # Dockerfile client Vite
│   ├── .env                    # Konfigurasi client (PORT & VITE_API_BASE_URL)
│   ├── .env.example            # Template konfigurasi client
│   ├── vite.config.js          # Konfigurasi Vite dinamis berbasis .env & proxy
│   ├── src/
│   │   ├── components/         # LandingPage, FrameSelector, CameraSession, PreviewResult, dll.
│   │   ├── utils/              # canvasCompositor.js, audioEffects.js, apiConfig.js
│   │   ├── App.jsx             # State machine coordinator
│   │   └── main.jsx            # React entrypoint
│   └── test/                   # Test suites unit & integrasi frontend
├── server/                     # Backend Express + Prisma ORM
│   ├── Dockerfile              # Dockerfile backend server
│   ├── docker-entrypoint.sh    # Entrypoint script untuk auto prisma db push
│   ├── .env                    # Konfigurasi backend (PORT, DATABASE_URL, dll.)
│   ├── .env.example            # Template konfigurasi backend
│   ├── prisma/                 # schema.prisma (BoothSession, CapturedPhoto, PrintJob)
│   ├── src/                    # Routes, services, Express app & db singleton
│   ├── uploads/                # Direktori penyimpanan sementara foto & QR
│   └── test/                   # Test suites API REST, DB & health check
└── docs/                       # Dokumentasi arsitektur, PRD & implementation plans
```

---

## 💡 Troubleshooting & Tips

1. **Izin Kamera (WebRTC):**
   - Pastikan browser memiliki izin untuk mengakses webcam (`navigator.mediaDevices.getUserMedia`).
   - Pada Google Chrome / Edge, akses ke kamera di `localhost` diizinkan secara default. Jika diakses melalui IP jaringan lokal, pastikan menggunakan koneksi HTTPS atau tambahkan flag `unsafely-treat-insecure-origin-as-secure` di `chrome://flags`.
2. **Audio Tidak Bersuara:**
   - Kebijakan modern browser (Web Audio Autoplay Policy) mewajibkan interaksi pengguna (seperti klik tombol "Mulai Photobooth") sebelum audio dapat berbunyi. Klik tombol interaktif pada Landing Page untuk mengaktifkan audio.
3. **Penyimpanan Uploads:**
   - File foto yang diunggah ke server akan disimpan di direktori `server/uploads/` dan disajikan secara statis untuk akses QR Code mobile. Direktori ini otomatis dibuat jika belum ada.
