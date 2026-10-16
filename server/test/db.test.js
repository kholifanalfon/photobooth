const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/db');

test('db module exports singleton PrismaClient instance', () => {
  assert.ok(prisma, 'prisma instance should be exported');
  assert.strictEqual(typeof prisma, 'object', 'prisma should be an object');
});

test('prisma client has defined models configured', () => {
  assert.ok(prisma.boothSession, 'prisma.boothSession should be defined');
  assert.strictEqual(typeof prisma.boothSession.findMany, 'function', 'boothSession should expose findMany');

  assert.ok(prisma.capturedPhoto, 'prisma.capturedPhoto should be defined');
  assert.strictEqual(typeof prisma.capturedPhoto.findMany, 'function', 'capturedPhoto should expose findMany');

  assert.ok(prisma.printJob, 'prisma.printJob should be defined');
  assert.strictEqual(typeof prisma.printJob.findMany, 'function', 'printJob should expose findMany');
});

test('db module maintains singleton across requires in development/test', () => {
  const { prisma: prismaSecondImport } = require('../src/db');
  assert.strictEqual(prisma, prismaSecondImport, 'should export identical singleton instance');
  assert.strictEqual(global.__prisma, prisma, 'global.__prisma should hold the singleton in non-prod');
});
