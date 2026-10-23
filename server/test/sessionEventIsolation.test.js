const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');
const { cleanDatabase, cleanTestFiles } = require('./testHelper');
const { prisma } = require('../src/db');
const eventService = require('../src/services/eventService');

test.beforeEach(async () => {
  await cleanDatabase();
});

test.after(async () => {
  await cleanDatabase();
  await cleanTestFiles();
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
