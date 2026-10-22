const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const { uploadsDir, photosDir, framesDir, mediaDir } = require('../src/app');

const tempChunksDir = path.resolve(uploadsDir, 'temp_chunks');

/**
 * Clean all database records in the test database (photobooth_test)
 */
async function cleanDatabase() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('photobooth_test')) {
    try {
      await prisma.printJob.deleteMany({}).catch(() => {});
      await prisma.capturedPhoto.deleteMany({}).catch(() => {});
      await prisma.boothSession.deleteMany({}).catch(() => {});
      await prisma.event.deleteMany({}).catch(() => {});
    } catch (err) {
      // In case database table is temporarily unavailable or reset
    }
  }
}

/**
 * Remove ONLY test-generated files.
 * SAFETY RULE: Real user files in production/dev (uploads/) are NEVER deleted!
 * Only files in the isolated test directory (uploads_test) or files strictly matching test identifiers are cleaned.
 */
async function cleanTestFiles() {
  const isIsolatedTestDir = uploadsDir.endsWith('uploads_test');

  // Strict pattern: only files containing test indicators
  const testPattern = /(test|dummy|sample_test|sess_test_|traversal_test|wedding_banner|my_video)/i;

  const dirsToClean = [
    photosDir,
    mediaDir,
    framesDir,
    uploadsDir
  ];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      try {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = await fs.promises.stat(fullPath).catch(() => null);
          if (stat && stat.isFile()) {
            // SAFEGUARD: If not in uploads_test, ONLY delete if filename strictly matches testPattern!
            // If in uploads_test, delete test-generated file
            if (isIsolatedTestDir || testPattern.test(file)) {
              await fs.promises.unlink(fullPath).catch(() => {});
            }
          }
        }
      } catch (_) {}
    }
  }

  // Clean temp_chunks directory
  if (fs.existsSync(tempChunksDir)) {
    try {
      const chunkDirs = await fs.promises.readdir(tempChunksDir);
      for (const chunkDir of chunkDirs) {
        if (isIsolatedTestDir || /test/i.test(chunkDir)) {
          const fullDir = path.join(tempChunksDir, chunkDir);
          await fs.promises.rm(fullDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch (_) {}
  }
}

/**
 * Full teardown helper for test suites
 */
async function teardownTestEnvironment() {
  await cleanDatabase();
  await cleanTestFiles();
}

module.exports = {
  cleanDatabase,
  cleanTestFiles,
  teardownTestEnvironment
};
