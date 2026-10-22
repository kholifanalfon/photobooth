const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { prisma } = require('../db');

const configDataDir = process.env.NODE_ENV === 'test'
  ? path.resolve(__dirname, '../../data_test')
  : path.resolve(__dirname, '../../data');

const eventsFile = path.join(configDataDir, 'events.json');
const landingConfigFile = path.join(configDataDir, 'landing_config.json');
const framesConfigFile = path.join(configDataDir, 'frames_config.json');

const defaultUploadsDirName = process.env.NODE_ENV === 'test' ? 'uploads_test' : 'uploads';
const uploadsDir = process.env.UPLOADS_DIR
  ? (path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.resolve(__dirname, '../../..', process.env.UPLOADS_DIR))
  : path.resolve(__dirname, '../../..', defaultUploadsDirName);

const mediaDir = path.join(uploadsDir, 'media');

const defaultBaseConfig = {
  theme: 'wedding',
  title: 'The Wedding Celebration',
  subtitle: 'Abadikan momen bahagia dan penuh cinta di hari istimewa ini.',
  coupleNames: 'Kevin & Sheila',
  eventDate: 'Saturday, 17 October 2026',
  eventTitle: 'The Wedding Celebration',
  eventSubtitle: 'Abadikan momen bahagia dan penuh cinta di hari istimewa ini.',
  footerText: 'Scan QR di hasil cetak untuk mengunduh fotomu • Free high-res download',
  requireSessionCode: false,
  sessionCode: '1234',
  adminExitCode: '9999',
  isLive: false,
  printerName: 'Niimbot 4R Photo Printer',
  paperSize: '4R',
  printCopies: 1,
  printerModelPreset: 'b1_pro',
  printMethod: 'kiosk',
  autoPrint: false,
  printOrientation: 'portrait',
  bluetoothDeviceName: '',
  bluetoothLabelSize: '50x50',
  bluetoothLabelWidthMm: 50,
  bluetoothLabelHeightMm: 50,
  bluetoothMarginMm: 0,
  bluetoothFitMode: 'fit',
  bluetoothAutoRotate: true,
  bluetoothDensity: 1,
  bluetoothBrightnessPreset: 'asli',
  bluetoothBrightness: 0,
  bluetoothContrast: 1.10,
  bluetoothGamma: 1.15,
  bluetoothDither: 'atkinson',
  bluetoothSharpen: true,
  videoDisplayMode: 'background',
  countdownDuration: 3
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'event';
}

function getLatestMediaFile() {
  try {
    const searchDirs = [
      { dir: mediaDir, urlPrefix: '/uploads/media' },
      { dir: uploadsDir, urlPrefix: '/uploads' }
    ];

    const mediaFiles = [];
    for (const { dir, urlPrefix } of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const lower = f.toLowerCase();
        if (
          lower.startsWith('media_landing_') ||
          lower.startsWith('video_landing_') ||
          lower.startsWith('video_') ||
          lower.startsWith('image_landing_') ||
          lower.endsWith('.mp4') ||
          lower.endsWith('.webm') ||
          lower.endsWith('.mov') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.png') ||
          lower.endsWith('.webp')
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
  } catch (_) {
    return null;
  }
}

function readEventsFromFile() {
  if (fs.existsSync(eventsFile)) {
    try {
      const raw = fs.readFileSync(eventsFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return [];
}

function writeEventsToFile(events) {
  try {
    const dir = path.dirname(eventsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2), 'utf8');
  } catch (_) {}
}

async function syncToFile() {
  try {
    const all = await prisma.event.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });
    writeEventsToFile(all);
  } catch (_) {}
}

async function readLegacyConfig() {
  let legacy = null;
  if (process.env.DATABASE_URL) {
    try {
      const dbRecord = await prisma.appConfig.findUnique({
        where: { key: 'landing_config' }
      });
      if (dbRecord && dbRecord.value) {
        legacy = typeof dbRecord.value === 'string' ? JSON.parse(dbRecord.value) : dbRecord.value;
      }
    } catch (_) {}
  }

  if (!legacy && fs.existsSync(landingConfigFile)) {
    try {
      const raw = fs.readFileSync(landingConfigFile, 'utf8');
      legacy = JSON.parse(raw);
    } catch (_) {}
  }

  return legacy;
}

async function ensureGlobalFrames() {
  try {
    let framesData = null;
    if (process.env.DATABASE_URL) {
      try {
        const dbRec = await prisma.appConfig.findUnique({ where: { key: 'frames_config' } });
        if (dbRec && dbRec.value) {
          framesData = typeof dbRec.value === 'string' ? JSON.parse(dbRec.value) : dbRec.value;
        }
      } catch (_) {}
    }

    if (!framesData && fs.existsSync(framesConfigFile)) {
      try {
        framesData = JSON.parse(fs.readFileSync(framesConfigFile, 'utf8'));
      } catch (_) {}
    }

    if (framesData) {
      let modified = false;
      const framesList = Array.isArray(framesData)
        ? framesData
        : (Array.isArray(framesData.customFrames) ? framesData.customFrames : []);

      for (const frame of framesList) {
        if (frame.isGlobal === undefined) {
          frame.isGlobal = true;
          modified = true;
        }
        if (!Array.isArray(frame.assignedEventIds)) {
          frame.assignedEventIds = [];
          modified = true;
        }
      }

      if (modified) {
        if (fs.existsSync(path.dirname(framesConfigFile))) {
          fs.writeFileSync(framesConfigFile, JSON.stringify(framesData, null, 2), 'utf8');
        }
        if (process.env.DATABASE_URL) {
          try {
            await prisma.appConfig.upsert({
              where: { key: 'frames_config' },
              create: { key: 'frames_config', value: framesData },
              update: { value: framesData }
            });
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}

async function ensureDefaultEvent() {
  // Check database first if available
  try {
    const count = await prisma.event.count();
    if (count > 0) {
      const existingDefault = await prisma.event.findFirst({
        where: { isDefault: true }
      });
      if (existingDefault) return existingDefault;

      const firstEvent = await prisma.event.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      if (firstEvent) return firstEvent;
    }

    // Zero events in database: proceed to auto-seed
    const legacyConfig = await readLegacyConfig();
    const config = { ...defaultBaseConfig, ...(legacyConfig || {}) };

    if (!config.videoUrl) {
      const media = getLatestMediaFile();
      if (media) config.videoUrl = media;
    }

    const eventName = legacyConfig?.eventTitle || legacyConfig?.title || 'Default Photobooth Event';
    const slug = 'default-event';

    const seededEvent = await prisma.event.create({
      data: {
        name: eventName,
        slug,
        status: 'ACTIVE',
        isDefault: true,
        config
      }
    });

    await ensureGlobalFrames();
    await syncToFile();
    return seededEvent;
  } catch (err) {
    // Database query failed: fallback to offline file mechanism
    const fileEvents = readEventsFromFile();
    if (fileEvents.length > 0) {
      const def = fileEvents.find(e => e.isDefault) || fileEvents[0];
      return def;
    }

    const legacyConfig = await readLegacyConfig();
    const config = { ...defaultBaseConfig, ...(legacyConfig || {}) };
    if (!config.videoUrl) {
      const media = getLatestMediaFile();
      if (media) config.videoUrl = media;
    }

    const eventName = legacyConfig?.eventTitle || legacyConfig?.title || 'Default Photobooth Event';
    const now = new Date().toISOString();
    const defaultEv = {
      id: crypto.randomUUID(),
      name: eventName,
      slug: 'default-event',
      status: 'ACTIVE',
      isDefault: true,
      config,
      createdAt: now,
      updatedAt: now
    };

    writeEventsToFile([defaultEv]);
    await ensureGlobalFrames();
    return defaultEv;
  }
}

async function listEvents(filter = {}) {
  const { status } = filter || {};

  try {
    const count = await prisma.event.count();
    if (count === 0) {
      await ensureDefaultEvent();
    }

    const where = status ? { status } : {};
    const events = await prisma.event.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    writeEventsToFile(events);
    return events;
  } catch (err) {
    // Database offline: fallback to file
    let fileEvents = readEventsFromFile();
    if (fileEvents.length === 0) {
      const def = await ensureDefaultEvent();
      fileEvents = [def];
    }

    let results = fileEvents;
    if (status) {
      results = results.filter(e => e.status === status);
    }
    return results.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }
}

async function getEventByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const trimmed = String(idOrSlug).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);

  try {
    const count = await prisma.event.count();
    if (count === 0) {
      await ensureDefaultEvent();
    }

    const event = await prisma.event.findFirst({
      where: isUuid
        ? { OR: [{ id: trimmed }, { slug: trimmed }] }
        : { slug: trimmed }
    });

    return event;
  } catch (err) {
    const fileEvents = readEventsFromFile();
    return fileEvents.find(e => e.id === trimmed || e.slug === trimmed) || null;
  }
}

async function createEvent(payload = {}) {
  const { name, description, config, status, isDefault } = payload;
  if (!name || typeof name !== 'string') {
    throw new Error('Event name is required');
  }

  const baseSlug = slugify(payload.slug || name);
  const eventStatus = status || 'ACTIVE';
  const eventIsDefault = Boolean(isDefault);
  const eventConfig = config || defaultBaseConfig;

  try {
    // Ensure slug uniqueness in database
    let uniqueSlug = baseSlug;
    let counter = 2;
    while (await prisma.event.findUnique({ where: { slug: uniqueSlug } })) {
      const suffix = `-${counter}`;
      uniqueSlug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
      counter++;
    }

    if (eventIsDefault) {
      await prisma.event.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const created = await prisma.event.create({
      data: {
        name: name.trim(),
        slug: uniqueSlug,
        description: description || null,
        status: eventStatus,
        isDefault: eventIsDefault,
        config: eventConfig
      }
    });

    await syncToFile();
    return created;
  } catch (err) {
    // Fallback to offline file handling
    const fileEvents = readEventsFromFile();
    let uniqueSlug = baseSlug;
    let counter = 2;
    while (fileEvents.some(e => e.slug === uniqueSlug)) {
      const suffix = `-${counter}`;
      uniqueSlug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
      counter++;
    }

    if (eventIsDefault) {
      for (const e of fileEvents) {
        e.isDefault = false;
      }
    }

    const now = new Date().toISOString();
    const newEvent = {
      id: crypto.randomUUID(),
      name: name.trim(),
      slug: uniqueSlug,
      description: description || null,
      status: eventStatus,
      isDefault: eventIsDefault,
      config: eventConfig,
      createdAt: now,
      updatedAt: now
    };

    fileEvents.unshift(newEvent);
    writeEventsToFile(fileEvents);
    return newEvent;
  }
}

async function updateEvent(id, payload = {}) {
  if (!id) throw new Error('Event id is required for update');

  try {
    const updateData = {};
    if (payload.name !== undefined) updateData.name = String(payload.name).trim();
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.config !== undefined) updateData.config = payload.config;

    if (payload.slug !== undefined) {
      const baseSlug = slugify(payload.slug);
      let uniqueSlug = baseSlug;
      let counter = 2;
      while (await prisma.event.findFirst({ where: { slug: uniqueSlug, id: { not: id } } })) {
        const suffix = `-${counter}`;
        uniqueSlug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
        counter++;
      }
      updateData.slug = uniqueSlug;
    }

    if (payload.isDefault !== undefined) {
      const isDef = Boolean(payload.isDefault);
      updateData.isDefault = isDef;
      if (isDef) {
        await prisma.event.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false }
        });
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData
    });

    await syncToFile();
    return updated;
  } catch (err) {
    if (err.code === 'P2025') {
      return null;
    }

    // Offline file fallback
    const fileEvents = readEventsFromFile();
    const idx = fileEvents.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const existing = fileEvents[idx];
    if (payload.name !== undefined) existing.name = String(payload.name).trim();
    if (payload.description !== undefined) existing.description = payload.description;
    if (payload.status !== undefined) existing.status = payload.status;
    if (payload.config !== undefined) existing.config = payload.config;

    if (payload.slug !== undefined) {
      const baseSlug = slugify(payload.slug);
      let uniqueSlug = baseSlug;
      let counter = 2;
      while (fileEvents.some(e => e.slug === uniqueSlug && e.id !== id)) {
        const suffix = `-${counter}`;
        uniqueSlug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
        counter++;
      }
      existing.slug = uniqueSlug;
    }

    if (payload.isDefault !== undefined) {
      const isDef = Boolean(payload.isDefault);
      existing.isDefault = isDef;
      if (isDef) {
        for (const e of fileEvents) {
          if (e.id !== id) e.isDefault = false;
        }
      }
    }

    existing.updatedAt = new Date().toISOString();
    writeEventsToFile(fileEvents);
    return existing;
  }
}

async function deleteEvent(id) {
  if (!id) return null;

  try {
    const deleted = await prisma.event.delete({
      where: { id }
    });
    await syncToFile();
    return deleted;
  } catch (err) {
    if (err.code === 'P2025') {
      return null;
    }

    // Offline file fallback
    const fileEvents = readEventsFromFile();
    const idx = fileEvents.findIndex(e => e.id === id);
    if (idx !== -1) {
      const [removed] = fileEvents.splice(idx, 1);
      writeEventsToFile(fileEvents);
      return removed;
    }
    return null;
  }
}

module.exports = {
  listEvents,
  getEventByIdOrSlug,
  createEvent,
  updateEvent,
  deleteEvent,
  ensureDefaultEvent,
  slugify,
  readEventsFromFile,
  writeEventsToFile,
  syncToFile,
  defaultBaseConfig
};
