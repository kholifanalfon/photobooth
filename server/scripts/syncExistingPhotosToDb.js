const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { prisma } = require('../src/db');

function stringToUuid(str) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function run() {
  const defaultEvent = await prisma.event.findFirst({ where: { isDefault: true } })
    || await prisma.event.findFirst();

  if (!defaultEvent) {
    console.error('No event found in DB!');
    return;
  }
  console.log('Using event:', defaultEvent.id, defaultEvent.name);

  const dir = path.resolve(__dirname, '../uploads/photos');
  if (!fs.existsSync(dir)) {
    console.error('Photos dir does not exist:', dir);
    return;
  }
  const files = fs.readdirSync(dir);
  const sessionGroups = {};

  for (const file of files) {
    if (!file.startsWith('photo_') || !/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;
    const raw = file.replace(/^photo_/, '').replace(/\.[a-zA-Z0-9]+$/, '');
    let sessionId = 'legacy';
    let isComposite = false;
    let poseIndex = 1;

    if (raw.includes('_composite_')) {
      sessionId = raw.split('_composite_')[0];
      isComposite = true;
      poseIndex = 0;
    } else if (raw.includes('_pose_')) {
      const parts = raw.split('_pose_');
      sessionId = parts[0];
      poseIndex = parseInt(parts[1].split('_')[0], 10) || 1;
    } else {
      const parts = raw.split('_');
      sessionId = parts.length > 1 ? parts.slice(0, parts.length - 1).join('_') : parts[0];
    }

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (!sessionGroups[sessionId]) {
      sessionGroups[sessionId] = {
        uuid: stringToUuid(sessionId),
        originalId: sessionId,
        createdAt: stat.mtime,
        files: []
      };
    }
    sessionGroups[sessionId].files.push({
      file,
      fullPath,
      isComposite,
      poseIndex,
      size: stat.size,
      mtime: stat.mtime
    });
    if (stat.mtime < sessionGroups[sessionId].createdAt) {
      sessionGroups[sessionId].createdAt = stat.mtime;
    }
  }

  let insertedSessions = 0;
  let insertedPhotos = 0;

  for (const [origId, group] of Object.entries(sessionGroups)) {
    const poseCount = group.files.filter(f => !f.isComposite).length || 1;

    // Check if session exists
    let existingSession = await prisma.boothSession.findUnique({
      where: { id: group.uuid }
    });

    if (!existingSession) {
      existingSession = await prisma.boothSession.create({
        data: {
          id: group.uuid,
          eventId: defaultEvent.id,
          frameTemplate: 'custom',
          photoCount: poseCount,
          frameColor: '#FFFFFF',
          templateConfig: { legacySessionId: origId },
          storageUrl: origId,
          status: 'COMPLETED',
          createdAt: group.createdAt,
          completedAt: group.createdAt
        }
      });
      insertedSessions++;
    } else if (!existingSession.eventId) {
      await prisma.boothSession.update({
        where: { id: group.uuid },
        data: {
          eventId: defaultEvent.id,
          templateConfig: { legacySessionId: origId },
          storageUrl: origId
        }
      });
    }

    // Insert photos
    for (const f of group.files) {
      const existingPhoto = await prisma.capturedPhoto.findFirst({
        where: {
          sessionId: group.uuid,
          poseIndex: f.poseIndex
        }
      });

      if (!existingPhoto) {
        const fileBuf = fs.readFileSync(f.fullPath);
        const base64Prefix = fileBuf.subarray(0, 128).toString('base64');
        const dataUri = 'data:image/jpeg;base64,' + base64Prefix + '...[truncated, size=' + fileBuf.length + ']';

        await prisma.capturedPhoto.create({
          data: {
            sessionId: group.uuid,
            poseIndex: f.poseIndex,
            filePath: f.fullPath,
            imageDataUri: dataUri,
            capturedAt: f.mtime
          }
        });
        insertedPhotos++;
      }
    }
  }

  console.log('Finished inserting sessions into database!');
  console.log('New sessions created:', insertedSessions);
  console.log('New photos created:', insertedPhotos);

  const totalInDb = await prisma.boothSession.count();
  const totalPhotosInDb = await prisma.capturedPhoto.count();
  console.log('Total BoothSessions in DB now:', totalInDb);
  console.log('Total CapturedPhotos in DB now:', totalPhotosInDb);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
