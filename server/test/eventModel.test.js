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
