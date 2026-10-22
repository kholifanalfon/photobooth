const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
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

test('GET /api/events returns list with auto-seeded default event', async () => {
  const res = await request(app).get('/api/events');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.events));
  assert.ok(res.body.events.length >= 1);
  assert.strictEqual(typeof res.body.total, 'number');
});

test('GET /api/events?status= filters events by status', async () => {
  const ev1 = await eventService.createEvent({ name: 'Active Celebration', status: 'ACTIVE' });
  const ev2 = await eventService.createEvent({ name: 'Old Celebration', status: 'ARCHIVED' });

  const resActive = await request(app).get('/api/events?status=ACTIVE');
  assert.strictEqual(resActive.status, 200);
  assert.ok(resActive.body.events.some(e => e.id === ev1.id));
  assert.strictEqual(resActive.body.events.some(e => e.id === ev2.id), false);

  const resArchived = await request(app).get('/api/events?status=ARCHIVED');
  assert.strictEqual(resArchived.status, 200);
  assert.ok(resArchived.body.events.some(e => e.id === ev2.id));
  assert.strictEqual(resArchived.body.events.some(e => e.id === ev1.id), false);
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
  assert.strictEqual(res.body.event.name, 'Music Festival 2026');
});

test('POST /api/events returns 400 when name is missing', async () => {
  const res = await request(app).post('/api/events').send({ description: 'No name event' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
});

test('GET /api/events/:idOrSlug returns event by slug and id, 404 if not found', async () => {
  const created = await eventService.createEvent({
    name: 'Tech Summit 2026',
    slug: 'tech-summit-2026'
  });

  // By slug
  const resSlug = await request(app).get('/api/events/tech-summit-2026');
  assert.strictEqual(resSlug.status, 200);
  assert.strictEqual(resSlug.body.success, true);
  assert.strictEqual(resSlug.body.event.id, created.id);

  // By ID
  const resId = await request(app).get(`/api/events/${created.id}`);
  assert.strictEqual(resId.status, 200);
  assert.strictEqual(resId.body.success, true);
  assert.strictEqual(resId.body.event.slug, 'tech-summit-2026');

  // Non-existent
  const resNotFound = await request(app).get('/api/events/non-existent-event-slug-xyz');
  assert.strictEqual(resNotFound.status, 404);
  assert.strictEqual(resNotFound.body.success, false);
});

test('PUT /api/events/:id updates event successfully or returns 404', async () => {
  const created = await eventService.createEvent({
    name: 'Original Event Name',
    config: { theme: 'classic' }
  });

  const resUpdate = await request(app)
    .put(`/api/events/${created.id}`)
    .send({
      name: 'Renamed Event',
      config: { theme: 'retro' }
    });

  assert.strictEqual(resUpdate.status, 200);
  assert.strictEqual(resUpdate.body.success, true);
  assert.strictEqual(resUpdate.body.event.name, 'Renamed Event');
  assert.strictEqual(resUpdate.body.event.config.theme, 'retro');

  // Update non-existent event
  const resNotFound = await request(app)
    .put('/api/events/00000000-0000-0000-0000-000000000000')
    .send({ name: 'Does Not Exist' });
  assert.strictEqual(resNotFound.status, 404);
  assert.strictEqual(resNotFound.body.success, false);
});

test('DELETE /api/events/:id deletes event successfully or returns 404', async () => {
  const created = await eventService.createEvent({
    name: 'Event To Delete'
  });

  const resDelete = await request(app).delete(`/api/events/${created.id}`);
  assert.strictEqual(resDelete.status, 200);
  assert.strictEqual(resDelete.body.success, true);

  // Verify deletion
  const check = await eventService.getEventByIdOrSlug(created.id);
  assert.strictEqual(check, null);

  // Delete non-existent event
  const resNotFound = await request(app).delete('/api/events/00000000-0000-0000-0000-000000000000');
  assert.strictEqual(resNotFound.status, 404);
  assert.strictEqual(resNotFound.body.success, false);
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

test('POST /api/photos/upload-video with eventId updates event config.videoUrl', async () => {
  const created = await eventService.createEvent({
    name: 'Video Event',
    config: { title: 'Event With Video' }
  });

  const dummyVideo = Buffer.from('dummy-video-data');
  const res = await request(app)
    .post(`/api/photos/upload-video?eventId=${created.id}`)
    .attach('video', dummyVideo, 'event_teaser.mp4');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.relativeUrl);

  const updatedEvent = await eventService.getEventByIdOrSlug(created.id);
  assert.ok(updatedEvent.config);
  assert.strictEqual(updatedEvent.config.videoUrl, res.body.relativeUrl);
});
