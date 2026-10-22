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

  // Fetch by id
  const fetchedById = await eventService.getEventByIdOrSlug(newEv.id);
  assert.strictEqual(fetchedById.id, newEv.id);

  // Update
  const updated = await eventService.updateEvent(newEv.id, {
    name: 'Gala Night 2026 - Updated',
    config: { ...newEv.config, printCopies: 3 }
  });
  assert.strictEqual(updated.name, 'Gala Night 2026 - Updated');
  assert.strictEqual(updated.config.printCopies, 3);
});

test('eventService auto-generates slug from name if slug is not provided', async () => {
  const created = await eventService.createEvent({
    name: 'Tech Conference 2026 & AI Expo!',
    config: { theme: 'modern' }
  });

  assert.ok(created.id);
  assert.strictEqual(created.slug, 'tech-conference-2026-ai-expo');
});

test('eventService automatically resolves slug collisions with suffix numbers', async () => {
  const ev1 = await eventService.createEvent({ name: 'Wedding Party' });
  const ev2 = await eventService.createEvent({ name: 'Wedding Party' });
  const ev3 = await eventService.createEvent({ name: 'Wedding Party' });

  assert.strictEqual(ev1.slug, 'wedding-party');
  assert.strictEqual(ev2.slug, 'wedding-party-2');
  assert.strictEqual(ev3.slug, 'wedding-party-3');
});

test('eventService unsets previous default event when a new default is created or updated', async () => {
  const ev1 = await eventService.createEvent({
    name: 'First Default Event',
    isDefault: true
  });
  assert.strictEqual(ev1.isDefault, true);

  const ev2 = await eventService.createEvent({
    name: 'Second Default Event',
    isDefault: true
  });
  assert.strictEqual(ev2.isDefault, true);

  const refreshedEv1 = await eventService.getEventByIdOrSlug(ev1.id);
  assert.strictEqual(refreshedEv1.isDefault, false);

  // Switch default back to ev1 via update
  await eventService.updateEvent(ev1.id, { isDefault: true });
  const reUpdatedEv1 = await eventService.getEventByIdOrSlug(ev1.id);
  const reUpdatedEv2 = await eventService.getEventByIdOrSlug(ev2.id);

  assert.strictEqual(reUpdatedEv1.isDefault, true);
  assert.strictEqual(reUpdatedEv2.isDefault, false);
});

test('eventService supports status filtering in listEvents', async () => {
  const activeEv = await eventService.createEvent({
    name: 'Active Fest',
    status: 'ACTIVE'
  });

  const inactiveEv = await eventService.createEvent({
    name: 'Archived Fest',
    status: 'ARCHIVED'
  });

  const activeOnly = await eventService.listEvents({ status: 'ACTIVE' });
  const archivedOnly = await eventService.listEvents({ status: 'ARCHIVED' });

  assert.ok(activeOnly.some(e => e.id === activeEv.id));
  assert.strictEqual(activeOnly.some(e => e.id === inactiveEv.id), false);

  assert.ok(archivedOnly.some(e => e.id === inactiveEv.id));
  assert.strictEqual(archivedOnly.some(e => e.id === activeEv.id), false);
});

test('eventService supports deleteEvent', async () => {
  const ev = await eventService.createEvent({
    name: 'To Delete Event'
  });

  await eventService.deleteEvent(ev.id);

  const found = await eventService.getEventByIdOrSlug(ev.id);
  assert.strictEqual(found, null);
});

test('eventService falls back to reading and writing events.json when DB query fails', async () => {
  // Test offline fallback using readEventsFromFile / writeEventsToFile
  const dataDir = path.resolve(__dirname, '../data_test');
  const eventsFile = path.join(dataDir, 'events.json');

  const sampleEvents = [
    {
      id: 'offline-uuid-1234',
      name: 'Offline Event',
      slug: 'offline-event',
      status: 'ACTIVE',
      isDefault: true,
      config: { title: 'Offline Mode Title' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  await fs.promises.writeFile(eventsFile, JSON.stringify(sampleEvents, null, 2), 'utf8');

  // Query by mocking prisma error or invoking fallback directly
  const origFindMany = prisma.event.findMany;
  try {
    prisma.event.findMany = async () => {
      throw new Error('Database connection failed (simulated offline)');
    };

    const offlineEvents = await eventService.listEvents();
    assert.strictEqual(offlineEvents.length >= 1, true);
    assert.strictEqual(offlineEvents[0].slug, 'offline-event');
  } finally {
    prisma.event.findMany = origFindMany;
  }
});

test('eventService offline mode handles createEvent, updateEvent, and deleteEvent', async () => {
  const origCreate = prisma.event.create;
  const origUpdate = prisma.event.update;
  const origDelete = prisma.event.delete;
  const origFindUnique = prisma.event.findUnique;
  const origFindFirst = prisma.event.findFirst;

  try {
    // Force Prisma to throw errors simulating completely disconnected database
    prisma.event.create = async () => { throw new Error('DB Offline'); };
    prisma.event.update = async () => { throw new Error('DB Offline'); };
    prisma.event.delete = async () => { throw new Error('DB Offline'); };
    prisma.event.findUnique = async () => { throw new Error('DB Offline'); };
    prisma.event.findFirst = async () => { throw new Error('DB Offline'); };

    // Offline create
    const offlineCreated = await eventService.createEvent({
      name: 'Completely Offline Event',
      description: 'Saved to events.json only'
    });
    assert.ok(offlineCreated.id);
    assert.strictEqual(offlineCreated.slug, 'completely-offline-event');

    // Offline get
    const fetched = await eventService.getEventByIdOrSlug(offlineCreated.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'Completely Offline Event');

    // Offline update
    const updated = await eventService.updateEvent(offlineCreated.id, {
      name: 'Completely Offline Event - Updated'
    });
    assert.strictEqual(updated.name, 'Completely Offline Event - Updated');

    // Offline delete
    const deleted = await eventService.deleteEvent(offlineCreated.id);
    assert.strictEqual(deleted.id, offlineCreated.id);

    const reFetched = await eventService.getEventByIdOrSlug(offlineCreated.id);
    assert.strictEqual(reFetched, null);
  } finally {
    prisma.event.create = origCreate;
    prisma.event.update = origUpdate;
    prisma.event.delete = origDelete;
    prisma.event.findUnique = origFindUnique;
    prisma.event.findFirst = origFindFirst;
  }
});
