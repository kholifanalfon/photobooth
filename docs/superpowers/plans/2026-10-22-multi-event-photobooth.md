# Multi-Event Photobooth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the photobooth system to support multiple events with per-event configurations (branding, background videos, printer settings), event-specific or global frame assignments, a touchscreen event selector prior to landing, PIN-protected session switching, and database-level session isolation.

**Architecture:** Extend Prisma schema with an `Event` model and link `BoothSession` via `eventId`. Implement an auto-seed zero-data migration service to seamlessly preserve existing setups. Provide REST endpoints under `/api/events` and updated frame/session routes. Introduce a dedicated `EventSelectorScreen` and `EventManagerModal` in the React client, integrate a PIN-protected event switch button on the Landing Page, and ensure fast video background caching per event.

**Tech Stack:** Node.js, Express, Prisma ORM, PostgreSQL, React 18, Tailwind CSS, Lucide React, Framer Motion, Node native test runner (`node:test`), Supertest.

**Spec:** [`docs/superpowers/specs/2026-10-22-multi-event-photobooth-design.md`](file:///home/kholifan/html/photobooth/docs/superpowers/specs/2026-10-22-multi-event-photobooth-design.md)

## Global Constraints

- Never execute `git commit` or `git push` automatically.
- Server test command: `npm run test:server` (running `node --env-file=.env.test --test --test-concurrency=1 test/**/*.test.js`).
- Client test command: `npm run test:client` (running `node --test test/**/*.test.js`).
- Client production build verification: `npm run build:client`.
- Maintain full offline and database-fallback resilience (fallback to `data/events.json` and `data/frames_config.json` if PostgreSQL is offline).
- Do not break backward compatibility with existing single-event setups or existing photo files.

---

### Task 1: Prisma Schema & Database Models

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/test/testHelper.js`
- Test: `server/test/eventModel.test.js`

**Interfaces:**
- Consumes: Prisma database connection from `server/src/db.js`
- Produces: `prisma.event` client model, `BoothSession.eventId` relation

- [ ] **Step 1: Write the failing test for Event Prisma model**

Create `server/test/eventModel.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/db');
const { cleanDatabase } = require('./testHelper');

test.beforeEach(async () => {
  await cleanDatabase();
});

test.after(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

test('Prisma Event model CRUD and BoothSession relation', async () => {
  // Verify model exists
  assert.ok(prisma.event, 'prisma.event model should be defined');

  // Create an event
  const createdEvent = await prisma.event.create({
    data: {
      name: 'Wedding Kevin & Sheila',
      slug: 'wedding-kevin-sheila',
      status: 'ACTIVE',
      isDefault: true,
      config: {
        theme: 'wedding',
        title: 'Kevin & Sheila Wedding',
        coupleNames: 'Kevin & Sheila',
        eventDate: '2026-10-24',
        videoUrl: '/uploads/media/wedding.mp4',
        printCopies: 2
      }
    }
  });

  assert.ok(createdEvent.id);
  assert.strictEqual(createdEvent.slug, 'wedding-kevin-sheila');
  assert.strictEqual(createdEvent.config.printCopies, 2);

  // Create a BoothSession linked to this event
  const session = await prisma.boothSession.create({
    data: {
      eventId: createdEvent.id,
      frameTemplate: 'frame-4r-1photo',
      photoCount: 1,
      frameColor: '#FFFFFF'
    }
  });

  assert.ok(session.id);
  assert.strictEqual(session.eventId, createdEvent.id);

  // Query event including sessions
  const eventWithSessions = await prisma.event.findUnique({
    where: { id: createdEvent.id },
    include: { sessions: true }
  });

  assert.strictEqual(eventWithSessions.sessions.length, 1);
  assert.strictEqual(eventWithSessions.sessions[0].id, session.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env.test --test server/test/eventModel.test.js`
Expected: FAIL with `prisma.event model should be defined` or validation error.

- [ ] **Step 3: Update schema.prisma and testHelper.js**

Update `server/prisma/schema.prisma` to include `EventStatus` enum and `Event` model, and add `eventId` relation to `BoothSession`:
```prisma
enum EventStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

model Event {
  id            String         @id @default(uuid()) @db.Uuid
  slug          String         @unique @db.VarChar(64)
  name          String         @db.VarChar(128)
  description   String?        @db.Text
  status        EventStatus    @default(ACTIVE)
  isDefault     Boolean        @default(false) @map("is_default")
  config        Json
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
```

Update `server/test/testHelper.js` to clean `prisma.event`:
```javascript
// In cleanDatabase function:
await prisma.printJob.deleteMany().catch(() => {});
await prisma.capturedPhoto.deleteMany().catch(() => {});
await prisma.boothSession.deleteMany().catch(() => {});
await prisma.event.deleteMany().catch(() => {});
```

Push schema to local and test databases:
`npm --prefix server run prisma:generate`
`node --env-file=.env.test ./server/node_modules/.bin/prisma db push`
`npm --prefix server run prisma:push`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file=.env.test --test server/test/eventModel.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Verify database model and run `npm run test:server`. All tests must pass.

---

### Task 2: Backend Event Service & Auto-Seed Migration

**Files:**
- Create: `server/src/services/eventService.js`
- Test: `server/test/eventService.test.js`

**Interfaces:**
- Consumes: `prisma` from `server/src/db.js`, config files in `server/data`
- Produces:
  - `listEvents({ status })`
  - `getEventByIdOrSlug(idOrSlug)`
  - `createEvent(payload)`
  - `updateEvent(id, payload)`
  - `deleteEvent(id)`
  - `ensureDefaultEvent()`

- [ ] **Step 1: Write the failing test for Event Service**

Create `server/test/eventService.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { cleanDatabase } = require('./testHelper');
const { prisma } = require('../src/db');
const eventService = require('../src/services/eventService');

test.beforeEach(async () => {
  await cleanDatabase();
});

test.after(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

test('eventService auto-seeds default event when zero events exist', async () => {
  const events = await eventService.listEvents();
  assert.strictEqual(events.length >= 1, true, 'Should auto-seed at least 1 default event');

  const defaultEv = events[0];
  assert.strictEqual(defaultEv.isDefault, true);
  assert.strictEqual(defaultEv.status, 'ACTIVE');
  assert.ok(defaultEv.config);
});

test('eventService supports create, update, and get by slug/id', async () => {
  const newEv = await eventService.createEvent({
    name: 'Gala Night 2026',
    slug: 'gala-night-2026',
    description: 'Corporate annual dinner',
    config: {
      theme: 'neon_cyber',
      title: 'Annual Gala 2026',
      printCopies: 1
    }
  });

  assert.ok(newEv.id);
  assert.strictEqual(newEv.slug, 'gala-night-2026');

  // Fetch by slug
  const fetchedBySlug = await eventService.getEventByIdOrSlug('gala-night-2026');
  assert.strictEqual(fetchedBySlug.id, newEv.id);

  // Update
  const updated = await eventService.updateEvent(newEv.id, {
    name: 'Gala Night 2026 - Updated',
    config: { ...newEv.config, printCopies: 3 }
  });
  assert.strictEqual(updated.name, 'Gala Night 2026 - Updated');
  assert.strictEqual(updated.config.printCopies, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env.test --test server/test/eventService.test.js`
Expected: FAIL with `Cannot find module '../src/services/eventService'`

- [ ] **Step 3: Implement eventService.js**

Create `server/src/services/eventService.js` implementing:
- Auto-generation of slug from event name if slug not provided.
- JSON fallback file handling (`data/events.json` or `data_test/events.json`).
- `ensureDefaultEvent()`: Reads legacy `landing_config` or returns default base config if no events exist in database or file.
- CRUD methods (`listEvents`, `getEventByIdOrSlug`, `createEvent`, `updateEvent`, `deleteEvent`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file=.env.test --test server/test/eventService.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:server` to verify no regressions.

---

### Task 3: Backend API Endpoints (`/api/events`) & Frame Config Extension

**Files:**
- Create: `server/src/routes/eventRoutes.js`
- Modify: `server/src/app.js`
- Modify: `server/src/routes/configRoutes.js`
- Modify: `server/src/routes/photoRoutes.js`
- Test: `server/test/eventRoutes.test.js`

**Interfaces:**
- Consumes: `eventService`
- Produces:
  - Express routes on `/api/events`
  - Event filtering on `GET /api/config/frames?eventId=...`
  - Per-event video association on `POST /api/photos/upload-video`

- [ ] **Step 1: Write the failing test for Event Routes**

Create `server/test/eventRoutes.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');
const { cleanDatabase } = require('./testHelper');
const { prisma } = require('../src/db');

test.beforeEach(async () => {
  await cleanDatabase();
});

test.after(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

test('GET /api/events returns list with auto-seeded default event', async () => {
  const res = await request(app).get('/api/events');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.events));
  assert.ok(res.body.events.length >= 1);
});

test('POST /api/events creates a new event and returns 201', async () => {
  const payload = {
    name: 'Music Festival 2026',
    slug: 'music-fest-2026',
    config: {
      theme: 'sunset',
      title: 'Sunset Fest',
      printCopies: 1
    }
  };

  const res = await request(app).post('/api/events').send(payload);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.event.slug, 'music-fest-2026');
});

test('GET /api/config/frames?eventId= filters frames based on isGlobal and assignedEventIds', async () => {
  // First update frames with specific assignments
  const framesPayload = {
    customFrames: [
      {
        id: 'frame-global',
        name: 'Global Frame',
        enabled: true,
        isGlobal: true,
        assignedEventIds: [],
        slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }]
      },
      {
        id: 'frame-event-a',
        name: 'Event A Frame',
        enabled: true,
        isGlobal: false,
        assignedEventIds: ['event-uuid-a'],
        slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }]
      }
    ]
  };

  await request(app).post('/api/config/frames').send(framesPayload);

  // Request frames for event-uuid-a
  const resA = await request(app).get('/api/config/frames?eventId=event-uuid-a');
  assert.strictEqual(resA.status, 200);
  const frameIdsA = resA.body.customFrames.map(f => f.id);
  assert.ok(frameIdsA.includes('frame-global'));
  assert.ok(frameIdsA.includes('frame-event-a'));

  // Request frames for event-uuid-b (should NOT include frame-event-a)
  const resB = await request(app).get('/api/config/frames?eventId=event-uuid-b');
  assert.strictEqual(resB.status, 200);
  const frameIdsB = resB.body.customFrames.map(f => f.id);
  assert.ok(frameIdsB.includes('frame-global'));
  assert.strictEqual(frameIdsB.includes('frame-event-a'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env.test --test server/test/eventRoutes.test.js`
Expected: FAIL (404 on `/api/events` or missing handlers)

- [ ] **Step 3: Implement eventRoutes and update configRoutes/photoRoutes**

1. Create `server/src/routes/eventRoutes.js`:
   - Express router handling `GET /`, `GET /:idOrSlug`, `POST /`, `PUT /:id`, `DELETE /:id`.
2. Register `/api/events` in `server/src/app.js`:
   ```javascript
   const eventRoutes = require('./routes/eventRoutes');
   app.use('/api/events', eventRoutes);
   ```
3. Update `GET /api/config/frames` in `server/src/routes/configRoutes.js`:
   - Accept query `eventId`.
   - Filter frames: `f.isGlobal !== false || (eventId && Array.isArray(f.assignedEventIds) && f.assignedEventIds.includes(eventId))`.
4. Update `POST /api/photos/upload-video` in `server/src/routes/photoRoutes.js`:
   - Check if `req.query.eventId || req.body.eventId` is provided. If so, update the event's `config.videoUrl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file=.env.test --test server/test/eventRoutes.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:server`. All tests must pass.

---

### Task 4: Database Session Persistence & Event-Isolated Photos

**Files:**
- Modify: `server/src/routes/sessionRoutes.js`
- Modify: `server/src/routes/photoRoutes.js`
- Test: `server/test/sessionEventIsolation.test.js`

**Interfaces:**
- Consumes: `prisma.boothSession`, `prisma.capturedPhoto`
- Produces:
  - `POST /api/sessions` with `eventId` storing valid UUID
  - `POST /api/photos/upload` storing record in `captured_photos`
  - `GET /api/sessions?eventId=...` filtering sessions by event

- [ ] **Step 1: Write failing test for session creation and event filtering**

Create `server/test/sessionEventIsolation.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');
const { cleanDatabase } = require('./testHelper');
const { prisma } = require('../src/db');
const eventService = require('../src/services/eventService');

test.beforeEach(async () => {
  await cleanDatabase();
});

test.after(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

test('Session persistence links to eventId and filters properly', async () => {
  const event1 = await eventService.createEvent({ name: 'Event One', slug: 'event-1' });
  const event2 = await eventService.createEvent({ name: 'Event Two', slug: 'event-2' });

  // Create session for event 1
  const resSess1 = await request(app)
    .post('/api/sessions')
    .send({
      eventId: event1.id,
      frameTemplate: 'frame-4r-1photo',
      photoCount: 1
    });

  assert.strictEqual(resSess1.status, 201);
  const sess1Id = resSess1.body.id;
  assert.strictEqual(resSess1.body.eventId, event1.id);

  // Upload photo with session ID
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const resUpload = await request(app)
    .post('/api/photos/upload')
    .send({
      imageBase64: dummyBase64,
      sessionId: sess1Id,
      poseIndex: 0
    });

  assert.strictEqual(resUpload.status, 200);

  // Verify in PostgreSQL database
  const photoInDb = await prisma.capturedPhoto.findFirst({
    where: { sessionId: sess1Id }
  });
  assert.ok(photoInDb, 'CapturedPhoto should be saved in database');

  // Filter GET /api/sessions by eventId
  const resListEvent1 = await request(app).get(`/api/sessions?eventId=${event1.id}`);
  assert.strictEqual(resListEvent1.status, 200);
  assert.strictEqual(resListEvent1.body.sessions.length, 1);
  assert.strictEqual(resListEvent1.body.sessions[0].id, sess1Id);

  const resListEvent2 = await request(app).get(`/api/sessions?eventId=${event2.id}`);
  assert.strictEqual(resListEvent2.status, 200);
  assert.strictEqual(resListEvent2.body.sessions.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env.test --test server/test/sessionEventIsolation.test.js`
Expected: FAIL

- [ ] **Step 3: Update sessionRoutes.js and photoRoutes.js**

1. In `server/src/routes/sessionRoutes.js`:
   - In `POST /api/sessions`: Accept `eventId`, store `eventId` in `prisma.boothSession.create`. Ensure ID generated is standard UUID.
   - In `GET /api/sessions`: Accept `req.query.eventId`. When provided, filter `where: { eventId }`.
2. In `server/src/routes/photoRoutes.js`:
   - In `POST /api/photos/upload`: Check if `sessionId` exists in DB. If valid UUID and present in DB, insert into `prisma.capturedPhoto`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file=.env.test --test server/test/sessionEventIsolation.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:server`. All tests must pass.

---

### Task 5: Frontend: Event Selector Screen Component

**Files:**
- Create: `client/src/components/EventSelectorScreen.jsx`
- Test: `client/test/eventSelectorScreen.test.js`

**Interfaces:**
- Consumes: List of active events, callback `onSelectEvent(event)`, callback `onOpenAdmin()`
- Produces: Fullscreen kiosk touch interface for event selection

- [ ] **Step 1: Write test for EventSelectorScreen rendering and selection**

Create `client/test/eventSelectorScreen.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-event-selector-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/)/ }, (args) => ({
      path: args.path,
      external: true
    }));
  }
};

async function buildComponent() {
  const outFile = path.join(tmpDir, 'EventSelectorScreen.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'EventSelectorScreen.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('EventSelectorScreen renders event cards and empty state correctly', async () => {
  const { default: EventSelectorScreen } = await buildComponent();

  const dummyEvents = [
    {
      id: 'ev-1',
      name: 'Wedding Kevin & Sheila',
      slug: 'wedding-kevin-sheila',
      status: 'ACTIVE',
      config: { eventDate: '24 Oktober 2026', theme: 'wedding' }
    },
    {
      id: 'ev-2',
      name: 'Corporate Annual Dinner',
      slug: 'corp-dinner',
      status: 'ACTIVE',
      config: { eventDate: '15 November 2026', theme: 'modern_dark' }
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(EventSelectorScreen, {
      events: dummyEvents,
      onSelectEvent: () => {},
      onOpenAdmin: () => {}
    })
  );

  assert.ok(html.includes('Wedding Kevin &amp; Sheila') || html.includes('Wedding Kevin & Sheila'));
  assert.ok(html.includes('Corporate Annual Dinner'));
  assert.ok(html.includes('Pilih Event'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test client/test/eventSelectorScreen.test.js`
Expected: FAIL with component not found.

- [ ] **Step 3: Implement EventSelectorScreen.jsx**

Create `client/src/components/EventSelectorScreen.jsx`:
- Hero header with subtitle explaining: *"Silakan pilih acara yang sedang berlangsung untuk memulai Photobooth."*
- Card grid with touch-friendly cards, event badges, icons, event date, and "Masuk ke Booth" button.
- Empty state: When `events.length === 0`, display warning and button to unlock Admin configuration.
- Top-right settings button allowing operator to open Admin directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test client/test/eventSelectorScreen.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:client`. All tests must pass.

---

### Task 6: Frontend: Admin Event Manager Modal

**Files:**
- Create: `client/src/components/EventManagerModal.jsx`
- Test: `client/test/eventManagerModal.test.js`

**Interfaces:**
- Consumes: `isOpen`, `onClose`, `onEventUpdated`
- Produces: Modal for adding, editing, switching active status, and deleting events

- [ ] **Step 1: Write test for EventManagerModal**

Create `client/test/eventManagerModal.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-event-manager-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/)/ }, (args) => ({
      path: args.path,
      external: true
    }));
  }
};

async function buildComponent() {
  const outFile = path.join(tmpDir, 'EventManagerModal.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'EventManagerModal.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('EventManagerModal renders modal header, add event button, and event list', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const dummyEvents = [
    {
      id: 'ev-1',
      name: 'Wedding Kevin & Sheila',
      slug: 'wedding-kevin-sheila',
      status: 'ACTIVE',
      isDefault: true,
      config: { title: 'Kevin & Sheila Wedding' }
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: true,
      onClose: () => {},
      events: dummyEvents,
      onRefreshEvents: () => {}
    })
  );

  assert.ok(html.includes('Manajemen Event'));
  assert.ok(html.includes('Tambah Event Baru'));
  assert.ok(html.includes('Wedding Kevin &amp; Sheila') || html.includes('Wedding Kevin & Sheila'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test client/test/eventManagerModal.test.js`
Expected: FAIL with component not found.

- [ ] **Step 3: Implement EventManagerModal.jsx**

Create `client/src/components/EventManagerModal.jsx`:
- Modal containing list of events.
- Form to add new event or edit existing event:
  - Event Name, Slug, Description.
  - Landing Text: Event Title, Subtitle, Couple/Host Names, Event Date, Footer Text.
  - Video Background: Upload video / URL input with preview.
  - Printer Settings: Copies, Paper Size, Auto-print toggle.
  - Status toggle (`ACTIVE` / `INACTIVE`) and "Set as Default".
- Save action calling `POST /api/events` or `PUT /api/events/:id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test client/test/eventManagerModal.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:client`. All tests must pass.

---

### Task 7: Frontend: Frame Assignment Extension in FrameManagerModal

**Files:**
- Modify: `client/src/components/FrameManagerModal.jsx`
- Test: `client/test/frameManagerMultiEvent.test.js`

**Interfaces:**
- Consumes: `events` list prop
- Produces: `isGlobal` toggle and `assignedEventIds` selector per frame

- [ ] **Step 1: Write test for FrameManagerModal multi-event assignment UI**

Create `client/test/frameManagerMultiEvent.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-framemgr-event-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/)/ }, (args) => ({
      path: args.path,
      external: true
    }));
  }
};

async function buildComponent() {
  const outFile = path.join(tmpDir, 'FrameManagerModal.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'FrameManagerModal.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('FrameManagerModal renders event assignment options on frame cards', async () => {
  const { default: FrameManagerModal } = await buildComponent();

  const dummyFrames = [
    {
      id: 'frame-1',
      name: 'Bingkai 1 Foto',
      enabled: true,
      isGlobal: false,
      assignedEventIds: ['ev-1'],
      slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }]
    }
  ];

  const dummyEvents = [
    { id: 'ev-1', name: 'Wedding Kevin' },
    { id: 'ev-2', name: 'Gala Night' }
  ];

  const html = renderToStaticMarkup(
    React.createElement(FrameManagerModal, {
      isOpen: true,
      onClose: () => {},
      customFrames: dummyFrames,
      events: dummyEvents,
      onSaveFrames: () => {}
    })
  );

  assert.ok(html.includes('Semua Event') || html.includes('Global') || html.includes('Penugasan Event'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test client/test/frameManagerMultiEvent.test.js`
Expected: FAIL

- [ ] **Step 3: Update FrameManagerModal.jsx**

In `client/src/components/FrameManagerModal.jsx`:
- Accept `events` prop (array of available events).
- In each frame card or frame detail editor, add:
  - Toggle: *"Tersedia untuk Semua Event (Global)"*
  - If unchecked: Checklist of events to select `assignedEventIds`.
- Ensure `isGlobal` (default: true) and `assignedEventIds` are preserved when updating/saving frame store.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test client/test/frameManagerMultiEvent.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:client`. All tests must pass.

---

### Task 8: Frontend: Kiosk Flow Integration & PIN-Protected Event Switch

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/LandingPage.jsx`
- Modify: `client/src/components/LandingConfigDrawer.jsx`
- Modify: `client/src/components/SessionManagerModal.jsx`
- Test: `client/test/appFlowMultiEvent.test.js`

**Interfaces:**
- Consumes: `EventSelectorScreen`, `EventManagerModal`, active event state
- Produces: Seamless multi-event photobooth experience with PIN-protected event switching

- [ ] **Step 1: Write test for Multi-Event App Flow & PIN Switch**

Create `client/test/appFlowMultiEvent.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-app-flow-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\/)/ }, (args) => ({
      path: args.path,
      external: true
    }));
  }
};

async function buildLandingPage() {
  const outFile = path.join(tmpDir, 'LandingPage.mjs');
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/components/LandingPage.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('LandingPage renders Ganti Event button when hasMultipleEvents is true', async () => {
  const { default: LandingPage } = await buildLandingPage();

  const html = renderToStaticMarkup(
    React.createElement(LandingPage, {
      initialConfig: { title: 'The Wedding' },
      isLiveMode: false,
      hasMultipleEvents: true,
      activeEventName: 'Wedding Kevin & Sheila',
      onRequestSwitchEvent: () => {}
    })
  );

  assert.ok(html.includes('Ganti Event') || html.includes('Pindah Event'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test client/test/appFlowMultiEvent.test.js`
Expected: FAIL

- [ ] **Step 3: Update App.jsx, LandingPage.jsx, LandingConfigDrawer.jsx, SessionManagerModal.jsx**

1. In `client/src/App.jsx`:
   - Add step `'EVENT_SELECT'` to `currentStep` states.
   - Maintain `activeEvent` and `eventsList` in state and `localStorage` (`photobooth_active_event_id`).
   - Check URL query parameter `?event=slug` for deep linking.
   - If only 1 active event exists, automatically set it as `activeEvent` and jump to `LANDING`. If >1 active events and no active event stored, show `EVENT_SELECT`.
   - On starting session, call `POST /api/sessions` with `{ eventId: activeEvent?.id, ... }` to generate standard UUID session record in DB.
   - Pass `activeEvent` configuration (video, theme, texts, printer) to `LandingPage`, `FrameSelector`, and `PreviewResult`.
2. In `client/src/components/LandingPage.jsx`:
   - Add "Ganti Event" button in the top action bar.
   - On click, prompt `AdminExitModal` (PIN keypad). If correct code entered, trigger `onRequestSwitchEvent()` which clears `activeEvent` and switches to `EVENT_SELECT`.
3. In `client/src/components/LandingConfigDrawer.jsx`:
   - Add "Kelola Event" action/tab that opens `EventManagerModal`.
4. In `client/src/components/SessionManagerModal.jsx`:
   - Add event dropdown filter to filter session history and download photos per event.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test client/test/appFlowMultiEvent.test.js`
Expected: PASS

- [ ] **Step 5: Verify deliverable**

Run `npm run test:client`. All tests must pass.

---

### Task 9: Full System Verification & Production Build

**Files:**
- All touched files

- [ ] **Step 1: Run complete server test suite**

Run: `npm run test:server`
Expected: All 54+ tests PASS with 0 failures.

- [ ] **Step 2: Run complete client test suite**

Run: `npm run test:client`
Expected: All 189+ tests PASS with 0 failures.

- [ ] **Step 3: Run production client build**

Run: `npm run build:client`
Expected: Build succeeds without bundle errors.

- [ ] **Step 4: Verify end-to-end integration**

Run: `node -e "const { prisma } = require('./server/src/db'); prisma.event.count().then(c => console.log('Events in DB:', c)).finally(() => prisma.$disconnect());"`
Expected: Output showing database query executes successfully without errors.
