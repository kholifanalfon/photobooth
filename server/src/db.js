const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Auto-load .env.test if NODE_ENV === 'test'
if (process.env.NODE_ENV === 'test') {
  const envTestPath = path.resolve(__dirname, '../.env.test');
  if (fs.existsSync(envTestPath)) {
    try {
      require('dotenv').config({ path: envTestPath, override: true });
    } catch (_) {}
  }
}

function getTestDatabaseUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('_test')) return process.env.DATABASE_URL;
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/\/photobooth(\?|$)/, '/photobooth_test$1');
  }
  return 'postgresql://postgres:P%40ssw0rd@localhost:5432/photobooth_test?schema=public';
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else if (process.env.NODE_ENV === 'test') {
  const testUrl = getTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      datasources: {
        db: { url: testUrl }
      }
    });
  }
  prisma = global.__prisma;
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = { prisma, getTestDatabaseUrl };
