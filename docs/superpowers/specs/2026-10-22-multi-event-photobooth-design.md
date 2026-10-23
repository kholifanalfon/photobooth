# Multi-Event Photobooth Architecture & Specification

- **Tanggal Dokumen:** 2026-10-22
- **Status:** Approved Draft for Implementation
- **Topik:** Multi-Event Support, Event-Specific Frames, Per-Event Background Videos, Event Selection & Kiosk Session Management

---

## 1. Ringkasan Eksekutif & Tujuan

Aplikasi Photobooth saat ini beroperasi dengan model *single-event* di mana konfigurasi landing page, video background, printer, dan frame bersifat tunggal (global).

Tujuan perancangan ini adalah mentransformasi aplikasi menjadi sistem **Multi-Event Kiosk** yang tangguh, dengan kapabilitas:
1. **Admin Event Management:** Admin dapat menambah, mengubah, mengaktifkan/menonaktifkan, dan menghapus event.
2. **Event-Specific Branding & Media:** Setiap event memiliki nama acara, tanggal, ucapan/teks footer, dan background video masing-masing.
3. **Fleksibilitas Penugasan Frame:** Frame foto dapat diatur *Global* (berlaku untuk semua event) atau ditugaskan khusus ke satu/beberapa event tertentu.
4. **Isolasi Konfigurasi Printer & Cetak:** Setiap event memiliki salinan konfigurasi printer tersendiri (jumlah copy, ukuran kertas, preset dithering/bluetooth).
5. **Kiosk Flow & Sesi Event Terproteksi:**
   - Sebelum masuk ke Landing Page, layar *Event Selector* memungkinkan operator memilih event aktif.
   - Sesi event disimpan di state aplikasi dan `localStorage`.
   - Tombol *"Ganti Event"* di Landing Page dilindungi oleh PIN Admin (`adminExitCode`) guna mencegah tamu mengubah event sembarangan.
6. **Isolasi Database & Penyimpanan Sesi Foto:**
   - Memperbaiki pencatatan database: menggunakan standar UUID untuk `BoothSession` dan `CapturedPhoto`.
   - Mengaitkan setiap sesi foto ke `eventId` terkait agar riwayat galeri dan cetak dapat difilter per event.
7. **Zero-Data Fallback & Seamless Auto-Migration:**
   - Jika database belum memiliki data event sama sekali, sistem otomatis membuat *Default Event* dari konfigurasi yang ada dan menandai semua frame sebagai global, sehingga photobooth tetap langsung bisa berjalan tanpa jeda.

---

## 2. Arsitektur Data & Model Penyimpanan

### 2.1 Skema Prisma Database (`server/prisma/schema.prisma`)

```prisma
enum EventStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
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

model Event {
  id            String         @id @default(uuid()) @db.Uuid
  slug          String         @unique @db.VarChar(64)
  name          String         @db.VarChar(128)
  description   String?        @db.Text
  status        EventStatus    @default(ACTIVE)
  isDefault     Boolean        @default(false) @map("is_default")
  config        Json           // Berisi branding, theme, coupleNames, eventDate, videoUrl, videoDisplayMode, countdown, printer settings
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz
  sessions      BoothSession[]

  @@index([status, createdAt(sort: Desc)])
  @@map("events")
}

model BoothSession {
  id             String          @id @default(uuid()) @db.Uuid
  eventId        String?         @map("event_id") @db.Uuid
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

  event          Event?          @relation(fields: [eventId], references: [id], onDelete: SetNull)
  photos         CapturedPhoto[]
  printJobs      PrintJob[]

  @@index([eventId, createdAt(sort: Desc)])
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
```

### 2.2 Model Penugasan Frame (`frames_config.json` / `AppConfig`)

Setiap item pada `customFrames` diperluas dengan field:
- `isGlobal: boolean` (Default: `true`)
- `assignedEventIds: string[]` (Array UUID event)

```json
{
  "id": "frame-4r-1photo",
  "name": "Bingkai 1 Foto Minimalis",
  "enabled": true,
  "isGlobal": true,
  "assignedEventIds": [],
  "orientation": "portrait",
  "width": 1200,
  "height": 1800,
  "imageUrl": "/frames/frame_4r_1photo.png",
  "layerMode": "background",
  "photoCount": 1,
  "slots": [...]
}
```

*Logika Filter Frame:*
```javascript
function isFrameAvailableForEvent(frame, activeEventId) {
  if (!frame.enabled) return false;
  if (frame.isGlobal) return true;
  if (!activeEventId) return true;
  return Array.isArray(frame.assignedEventIds) && frame.assignedEventIds.includes(activeEventId);
}
```

### 2.3 Mekanisme Auto-Seed & Zero-Data Handling

Jika tabel `events` kosong (count = 0) saat server booting atau saat endpoint `/api/events` diakses:
1. Baca konfigurasi eksisting dari `landing_config` (Prisma `AppConfig` atau `data/landing_config.json`).
2. Jika ada video di folder `uploads/media/`, sertakan sebagai `videoUrl`.
3. Buat record event awal:
   - `name`: `config.eventTitle` atau `"Default Photobooth Event"`
   - `slug`: `"default-event"`
   - `status`: `"ACTIVE"`
   - `isDefault`: `true`
   - `config`: Objek lengkap konfigurasi landing + printer
4. Seluruh frame di `frames_config` otomatis dipastikan memiliki `isGlobal: true`.
5. Tulis juga fallback ke file `data/events.json` agar server tetap berjalan normal jika terjadi pemutusan koneksi PostgreSQL.

---

## 3. Spesifikasi API Server

### 3.1 Manajemen Event (`/api/events`)
- **`GET /api/events`**:
  - Query params: `status` (opsional: `ACTIVE`, `INACTIVE`, `ARCHIVED`).
  - Response: `{ success: true, total: number, events: Event[] }`.
- **`GET /api/events/:idOrSlug`**:
  - Mendapatkan satu event beserta konfigurasinya.
- **`POST /api/events`**:
  - Request body: `{ name, slug, description?, config }`.
  - Otomatis generate slug jika tidak diberikan.
- **`PUT /api/events/:id`**:
  - Memperbarui data dan konfigurasi event (nama, branding, videoUrl, printer config, status).
- **`DELETE /api/events/:id`**:
  - Menghapus event atau mengubah status menjadi `ARCHIVED`. Sesi foto yang ada tetap dipertahankan (`onDelete: SetNull`).

### 3.2 Penugasan Frame (`/api/config/frames`)
- **`GET /api/config/frames?eventId=<id>`**:
  - Jika `eventId` disertakan, hanya mengembalikan frame yang memenuhi syarat (`isGlobal: true` ATAU `assignedEventIds.includes(eventId)`).
- **`POST /api/config/frames`**:
  - Menyimpan payload frame lengkap dengan `isGlobal` dan `assignedEventIds`.

### 3.3 Upload Media Per-Event (`/api/photos/upload-video`)
- Menerima parameter `eventId` (query/body).
- Menyimpan file ke `uploads/media/`.
- Memperbarui field `videoUrl` pada event bersangkutan di database/JSON store.

### 3.4 Perbaikan Session & Sesi Foto (`/api/sessions` & `/api/photos/upload`)
- **Pembuatan Sesi:**
  - Saat sesi dimulai, frontend memanggil `POST /api/sessions` dengan `{ eventId, frameTemplate, photoCount, frameColor }`.
  - Server membuat record dengan standard UUID di tabel `booth_sessions`.
- **Upload Foto:**
  - `POST /api/photos/upload` menyimpan file foto fisik dan melakukan insert ke tabel `captured_photos` mengaitkan `sessionId` valid.
- **Filter Riwayat Sesi:**
  - `GET /api/sessions?eventId=<id>` memfilter sesi berdasarkan event.

---

## 4. Alur UX Frontend & Kiosk Flow

### 4.1 State Machine Alur Layar (`client/src/App.jsx`)

```
                      [STARTUP / REFRESH]
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       [Ada Active Event?]             [Belum Ada Active Event]
               │                               │
               │                   ┌───────────┴───────────┐
               │                   ▼                       ▼
               │          [Ada >= 1 Event Aktif]   [0 Event Aktif]
               │                   │                       │
               │                   ▼                       ▼
               │           [EVENT_SELECT Screen]   [Empty State / Admin Lock]
               │                   │
               │ (Pilih Event)     │
               └───────────►───────┘
                               │
                               ▼
                        [LANDING Screen]
                    (Branding & Video Event)
                               │
            ┌──────────────────┼──────────────────┐
            ▼                                     ▼
   (Tombol: Ganti Event)               (Sentuh Layar: Mulai Sesi)
            │                                     │
     [PIN Admin Modal]                            ▼
   (Verifikasi Sukses)                    [FRAME_PICKER Screen]
            │                              (Frame Event Terkait)
            ▼                                     │
   [EVENT_SELECT Screen]                          ▼
                                           [CAMERA Screen]
                                                  │
                                                  ▼
                                         [PREVIEW & PRINT Screen]
                                                  │
                                                  ▼ (Selesai)
                                         [Kembali ke LANDING Event]
```

### 4.2 Komponen Layar Pemilih Event (`EventSelectorScreen.jsx`)
- Tampilan kartu sentuh modern (touchscreen-friendly cards).
- Menampilkan nama event, tanggal, tema, dan status.
- Shortcut langsung via URL: `/live?event=<slug>` atau `/?event=<slug>`.
- Jika sistem hanya mendeteksi 1 event aktif, sistem otomatis *auto-select* dan langsung menuju Landing Page event tersebut.

### 4.3 Proteksi Tombol "Ganti Event"
- Tombol terpasang di pojok layar Landing Page (misal: berdampingan dengan Admin Trigger).
- Saat ditekan, sistem menampilkan modal PIN numpad.
- Validasi PIN mencocokkan `adminExitCode` event/sistem.
- Jika sukses, `activeEventId` di `localStorage` dihapus dan tampilan beralih ke `EVENT_SELECT`.

### 4.4 Modul Admin: Event Manager (`EventManagerModal.jsx`)
- Terintegrasi di dalam Admin Drawer (`LandingConfigDrawer.jsx`).
- Tab: **Events**, **Frames**, **Branding & Video**, **Printer**, **Sessions**.
- Admin dapat menambah event baru, mengunggah video background khusus event tersebut, serta mengatur jumlah cetak printer.

### 4.5 Pembaruan Frame Manager (`FrameManagerModal.jsx`)
- Setiap frame memiliki switch:
  - `Semua Event (Global)`: On/Off.
  - Jika Off: Muncul checklist daftar event aktif untuk memilih di event mana saja frame tersebut ditampilkan.

---

## 5. Strategi Caching, Offline & Keandalan

1. **Video Caching (`videoCache.js`):**
   - Video background masing-masing event diunduh dan disimpan di browser CacheStorage saat event dipilih atau di-preload di background, memastikan transisi video instan tanpa lagging/buffering.
2. **Koneksi Database Putus (Offline Resilience):**
   - Backend tetap memelihara file mirror `data/events.json` dan `data/frames_config.json`. Jika PostgreSQL restart atau offline, backend secara elegan beralih ke local JSON tanpa membuat aplikasi crash.
3. **Penyimpanan Foto Fisik:**
   - Foto tetap selalu tersimpan secara fisik di `uploads/photos/` dengan penamaan file aman (`photo_${sessionId}_${tag}.jpg`).

---

## 6. Verifikasi & Pengujian

1. **Uji Migrasi Awal (Zero Data):** Memastikan ketika tabel event kosong, sistem membuat Default Event otomatis dan frame lama tetap tampil sebagai frame global.
2. **Uji Multi-Event CRUD:** Membuat 2 event berbeda (misal: "Wedding Kevin & Sheila" dan "Corporate Gala 2026"), masing-masing dengan video background dan teks berbeda.
3. **Uji Isolasi Frame:** Menugaskan Frame A hanya ke Event 1 dan Frame B ke Event 2. Memastikan saat memilih Event 1, Frame B tidak muncul di Frame Selector.
4. **Uji Alur Kiosk & Keamanan PIN:** Memastikan tombol "Ganti Event" menolak PIN salah dan berhasil kembali ke Event Selector saat PIN benar.
5. **Uji Sesi & Database Persistence:** Memastikan data sesi tersimpan di tabel `booth_sessions` dengan `event_id` yang benar dan foto tersimpan di `captured_photos`.
