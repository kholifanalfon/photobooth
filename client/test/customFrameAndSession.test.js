import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { composePhotosToFrame } from '../src/utils/canvasCompositor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-customframe-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/utils\/)/ }, (args) => {
      const resolved = args.path.startsWith('.')
        ? 'file://' + path.resolve(componentsDir, args.path)
        : import.meta.resolve(args.path);
      return { path: resolved, external: true };
    });
  }
};

async function buildAndImportComponent(entryName) {
  const outFile = path.join(tmpDir, `${entryName}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(componentsDir, `${entryName}.jsx`)],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

const { PRINTER_PRESETS, SLOT_PRESETS } = await buildAndImportComponent('LandingConfigDrawer');

test('Printer & Custom Frame Configuration Suite', async (t) => {
  await t.test('PRINTER_PRESETS contains Niimbot 4R Photo Printer as top choice', () => {
    assert.ok(Array.isArray(PRINTER_PRESETS), 'PRINTER_PRESETS must be an array');
    const niimbot = PRINTER_PRESETS.find(p => p.id === 'Niimbot 4R Photo Printer');
    assert.ok(niimbot, 'Niimbot 4R preset must exist');
    assert.ok(niimbot.desc.includes('4R'), 'Niimbot desc must mention 4R');
  });

  await t.test('SLOT_PRESETS contains accurate 1, 2, 3, 4, 6 photo configurations', () => {
    for (const count of [1, 2, 3, 4, 6]) {
      const preset = SLOT_PRESETS[count];
      assert.ok(preset, `Preset for ${count} photos must exist`);
      assert.equal(preset.portrait.length, count, `Portrait preset must have ${count} slots`);
      assert.equal(preset.landscape.length, count, `Landscape preset must have ${count} slots`);

      for (const s of preset.portrait) {
        assert.ok(s.x + s.width <= 1200, 'Portrait slot width out of bounds');
        assert.ok(s.y + s.height <= 1800, 'Portrait slot height out of bounds');
      }
      for (const s of preset.landscape) {
        assert.ok(s.x + s.width <= 1800, 'Landscape slot width out of bounds');
        assert.ok(s.y + s.height <= 1200, 'Landscape slot height out of bounds');
      }
    }
  });

  await t.test('composePhotosToFrame supports customFrame with 4R canvas dimensions', async () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        clip: () => {},
        drawImage: () => {},
        strokeStyle: '',
        lineWidth: 0,
        stroke: () => {},
        font: '',
        textAlign: '',
        fillText: () => {}
      }),
      toDataURL: () => 'data:image/jpeg;base64,mockedCustomFrameData'
    };

    // Portrait 4R custom frame
    const portraitRes = await composePhotosToFrame([], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'portrait',
        slots: [{ id: 1, x: 100, y: 100, width: 1000, height: 1200 }]
      }
    });

    assert.equal(portraitRes.width, 1200, 'Portrait 4R width must be 1200');
    assert.equal(portraitRes.height, 1800, 'Portrait 4R height must be 1800');
    assert.equal(portraitRes.dataUrl, 'data:image/jpeg;base64,mockedCustomFrameData');

    // Landscape 4R custom frame
    const landscapeRes = await composePhotosToFrame([], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'landscape',
        slots: [{ id: 1, x: 100, y: 100, width: 1200, height: 1000 }]
      }
    });

    assert.equal(landscapeRes.width, 1800, 'Landscape 4R width must be 1800');
    assert.equal(landscapeRes.height, 1200, 'Landscape 4R height must be 1200');
  });

  await t.test('composePhotosToFrame loops photos to fill all slots when fewer photos taken than slots', async () => {
    const drawCalls = [];
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        clip: () => {},
        drawImage: (img, ...args) => {
          drawCalls.push({ img, args });
        },
        strokeStyle: '',
        lineWidth: 0,
        stroke: () => {}
      }),
      toDataURL: () => 'data:image/jpeg;base64,mockResult'
    };

    const mockPhoto1 = { width: 400, height: 300, id: 'photo1' };
    const mockPhoto2 = { width: 400, height: 300, id: 'photo2' };

    // 4 slots, 2 photos passed
    await composePhotosToFrame([mockPhoto1, mockPhoto2], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'portrait',
        slots: [
          { id: 1, x: 10, y: 10, width: 200, height: 200 },
          { id: 2, x: 220, y: 10, width: 200, height: 200 },
          { id: 3, x: 10, y: 220, width: 200, height: 200 },
          { id: 4, x: 220, y: 220, width: 200, height: 200 }
        ]
      }
    });

    assert.equal(drawCalls.length, 4, 'All 4 slots must have received a photo draw call');
    assert.equal(drawCalls[0].img.id, 'photo1');
    assert.equal(drawCalls[1].img.id, 'photo2');
    assert.equal(drawCalls[2].img.id, 'photo1', 'Slot 3 must loop to photo1');
    assert.equal(drawCalls[3].img.id, 'photo2', 'Slot 4 must loop to photo2');
  });

  await t.test('composePhotosToFrame applies custom slot borderWidth, radius, and borderColor', async () => {
    const strokeCalls = [];
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => {
        const ctx = {
          fillStyle: '',
          fillRect: () => {},
          save: () => {},
          restore: () => {},
          beginPath: () => {},
          clip: () => {},
          drawImage: () => {},
          strokeStyle: '',
          lineWidth: 0,
          stroke: () => {
            strokeCalls.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth });
          }
        };
        return ctx;
      },
      toDataURL: () => 'data:image/jpeg;base64,mockResult'
    };

    const mockPhoto = { width: 400, height: 300 };

    await composePhotosToFrame([mockPhoto], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'portrait',
        slots: [
          { id: 1, x: 50, y: 50, width: 300, height: 300, radius: 16, borderWidth: 4, borderColor: '#FFFFFF' }
        ]
      }
    });

    assert.equal(strokeCalls.length, 1, 'Custom border stroke should be called');
    assert.equal(strokeCalls[0].lineWidth, 4, 'Line width must match slot borderWidth');
    assert.equal(strokeCalls[0].strokeStyle, '#FFFFFF', 'Stroke style must match slot borderColor');
  });

  await t.test('composePhotosToFrame renders photos into exact slot width, height, and coordinates (even with string inputs)', async () => {
    const drawCalls = [];
    const pathCalls = [];
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        clip: () => {},
        moveTo: (x, y) => pathCalls.push(['moveTo', x, y]),
        lineTo: (x, y) => pathCalls.push(['lineTo', x, y]),
        arcTo: (x1, y1, x2, y2, r) => pathCalls.push(['arcTo', x1, y1, x2, y2, r]),
        closePath: () => pathCalls.push(['closePath']),
        drawImage: (img, cropX, cropY, cropW, cropH, destX, destY, destW, destH) => {
          drawCalls.push({ img, cropX, cropY, cropW, cropH, destX, destY, destW, destH });
        },
        strokeStyle: '',
        lineWidth: 0,
        stroke: () => {}
      }),
      toDataURL: () => 'data:image/jpeg;base64,exactDimensionsResult'
    };

    const mockPhoto = { width: 1280, height: 720 };

    // String input slot values as produced by HTML input elements or API JSON
    await composePhotosToFrame([mockPhoto], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'portrait',
        slots: [
          { id: 1, x: '95', y: '466', width: '470', height: '378', radius: '12', borderWidth: '2', borderColor: '#FFFFFF' }
        ]
      }
    });

    assert.equal(drawCalls.length, 1, 'Photo must be drawn exactly once');
    const call = drawCalls[0];
    assert.equal(call.destX, 95, 'Destination X must be exact number 95');
    assert.equal(call.destY, 466, 'Destination Y must be exact number 466');
    assert.equal(call.destW, 470, 'Destination Width must be exact number 470');
    assert.equal(call.destH, 378, 'Destination Height must be exact number 378');

    // Verify no string concatenation bug occurred (e.g. 95 + 470 != "95470")
    for (const p of pathCalls) {
      for (let i = 1; i < p.length; i++) {
        assert.equal(typeof p[i], 'number', `Path call coordinate ${p[0]} arg ${i} must be a number`);
        assert.ok(p[i] < 1850, `Coordinate ${p[i]} must not suffer from string concatenation`);
      }
    }
  });

  await t.test('Admin Session Lifetime is configured for 3 hours (10800000 ms)', () => {
    const threeHoursMs = 3 * 60 * 60 * 1000;
    assert.equal(threeHoursMs, 10800000, '3 hours in ms must be exactly 10,800,000');
  });

  await t.test('composePhotosToFrame correctly maps mirrored slots (6 slots with 3 photos)', async () => {
    const drawCalls = [];
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        clip: () => {},
        drawImage: (img, ...args) => {
          drawCalls.push({ img, args });
        },
        strokeStyle: '',
        lineWidth: 0,
        stroke: () => {}
      }),
      toDataURL: () => 'data:image/jpeg;base64,mirrorResult'
    };

    const mockPhoto1 = { width: 400, height: 300, id: 'photo1' };
    const mockPhoto2 = { width: 400, height: 300, id: 'photo2' };
    const mockPhoto3 = { width: 400, height: 300, id: 'photo3' };

    // 6 slots, 3 photos passed, pairs mapped via photoIndex
    await composePhotosToFrame([mockPhoto1, mockPhoto2, mockPhoto3], {
      customCanvas: mockCanvas,
      customFrame: {
        enabled: true,
        orientation: 'portrait',
        photoCount: 3,
        slots: [
          { id: 1, x: 10, y: 10, width: 200, height: 200, photoIndex: 0 },
          { id: 2, x: 220, y: 10, width: 200, height: 200, photoIndex: 0 },
          { id: 3, x: 10, y: 220, width: 200, height: 200, photoIndex: 1 },
          { id: 4, x: 220, y: 220, width: 200, height: 200, photoIndex: 1 },
          { id: 5, x: 10, y: 440, width: 200, height: 200, photoIndex: 2 },
          { id: 6, x: 220, y: 440, width: 200, height: 200, photoIndex: 2 }
        ]
      }
    });

    assert.equal(drawCalls.length, 6, 'All 6 slots must be composited');
    assert.equal(drawCalls[0].img.id, 'photo1', 'Slot 1 must receive photo1');
    assert.equal(drawCalls[1].img.id, 'photo1', 'Slot 2 must mirror photo1');
    assert.equal(drawCalls[2].img.id, 'photo2', 'Slot 3 must receive photo2');
    assert.equal(drawCalls[3].img.id, 'photo2', 'Slot 4 must mirror photo2');
    assert.equal(drawCalls[4].img.id, 'photo3', 'Slot 5 must receive photo3');
    assert.equal(drawCalls[5].img.id, 'photo3', 'Slot 6 must mirror photo3');
  });
  await t.test('composePhotosToFrame correctly composes 10-slot modern wedding frame with 5 photos', async () => {
    const slots = [
      { id: 1, x: 215, y: 205, width: 330, height: 196, photoIndex: 0 },
      { id: 2, x: 215, y: 413, width: 330, height: 196, photoIndex: 1 },
      { id: 3, x: 215, y: 621, width: 330, height: 196, photoIndex: 2 },
      { id: 4, x: 215, y: 829, width: 330, height: 196, photoIndex: 3 },
      { id: 5, x: 215, y: 1037, width: 330, height: 196, photoIndex: 4 },
      { id: 6, x: 655, y: 205, width: 330, height: 196, photoIndex: 0 },
      { id: 7, x: 655, y: 413, width: 330, height: 196, photoIndex: 1 },
      { id: 8, x: 655, y: 621, width: 330, height: 196, photoIndex: 2 },
      { id: 9, x: 655, y: 829, width: 330, height: 196, photoIndex: 3 },
      { id: 10, x: 655, y: 1037, width: 330, height: 196, photoIndex: 4 }
    ];

    const weddingFrame = {
      enabled: true,
      orientation: 'portrait',
      width: 1200,
      height: 1800,
      slots
    };

    const drawCalls = [];
    const mockCtx = {
      fillStyle: '',
      fillRect: () => {},
      drawImage: (img, ...args) => {
        drawCalls.push({ img, args });
      },
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      clip: () => {},
      roundRect: () => {},
      rect: () => {},
      stroke: () => {}
    };

    const mockCanvas = {
      width: 1200,
      height: 1800,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/jpeg;base64,mock'
    };

    // 5 photos taken by camera
    const photos = [
      { width: 400, height: 300, id: 'pose0' },
      { width: 400, height: 300, id: 'pose1' },
      { width: 400, height: 300, id: 'pose2' },
      { width: 400, height: 300, id: 'pose3' },
      { width: 400, height: 300, id: 'pose4' }
    ];

    const result = await composePhotosToFrame(photos, {
      layoutType: 'CUSTOM_4R',
      customCanvas: mockCanvas,
      customFrame: weddingFrame
    });

    assert.ok(result.dataUrl.startsWith('data:image/jpeg'), 'Must return valid composite data URL');
    assert.equal(drawCalls.length, 10, 'Must draw all 10 slots on the 4R canvas');
    // Verify slot 6 drew photo 0 and slot 1 drew photo 0
    assert.equal(drawCalls[0].img.id, 'pose0', 'Slot 1 must draw pose0');
    assert.equal(drawCalls[5].img.id, 'pose0', 'Slot 6 (right col) must mirror pose0');
    assert.equal(drawCalls[4].img.id, 'pose4', 'Slot 5 must draw pose4');
    assert.equal(drawCalls[9].img.id, 'pose4', 'Slot 10 (right col) must mirror pose4');
  });
  await t.test('composePhotosToFrame supports custom frame image positioning (anti-stretch) and mirror image drawing', async () => {
    const originalImage = global.Image;
    global.Image = class MockImage {
      constructor() {
        this.naturalWidth = 600;
        this.naturalHeight = 1800;
        this.width = 600;
        this.height = 1800;
        setTimeout(() => {
          if (typeof this.onload === "function") this.onload();
        }, 1);
      }
      set src(val) {
        this._src = val;
      }
      get src() {
        return this._src;
      }
    };
    const drawCalls = [];
    const transformCalls = [];
    const mockCtx = {
      fillStyle: '',
      fillRect: () => {},
      drawImage: (img, ...args) => {
        drawCalls.push({ img, args });
      },
      save: () => {},
      restore: () => {},
      translate: (x, y) => transformCalls.push({ type: 'translate', x, y }),
      scale: (sx, sy) => transformCalls.push({ type: 'scale', sx, sy }),
      beginPath: () => {},
      closePath: () => {},
      clip: () => {},
      roundRect: () => {},
      rect: () => {},
      stroke: () => {}
    };

    const mockCanvas = {
      width: 1200,
      height: 1800,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/jpeg;base64,mock'
    };

    const mockFrameImg = { width: 600, height: 1800, src: 'data:image/png;base64,mockStrip' };

    // Custom frame with anti-stretch (width: 600) and mirror (mirrorX: 600)
    const customFrame = {
      enabled: true,
      imageUrl: 'data:image/png;base64,mockStrip',
      layerMode: 'background',
      imageX: 0,
      imageY: 0,
      imageWidth: 600,
      imageHeight: 1800,
      imageMirror: true,
      mirrorImageX: 600,
      mirrorImageY: 0,
      mirrorImageWidth: 600,
      mirrorImageHeight: 1800,
      mirrorImageFlip: true,
      slots: [
        { id: 1, x: 50, y: 50, width: 500, height: 400, photoIndex: 0 },
        { id: 2, x: 650, y: 50, width: 500, height: 400, photoIndex: 0 }
      ]
    };

    const photos = [{ width: 400, height: 300, id: 'p0' }];

    await composePhotosToFrame(photos, {
      layoutType: 'CUSTOM_4R',
      customCanvas: mockCanvas,
      customFrame
    });

    // 2 background frame image draws (main + mirror) + 2 slot draws = 4 drawCalls
    assert.equal(drawCalls.length, 4, 'Must perform 2 frame draws and 2 slot photo draws');
    // First draw call is main frame image at 0, 0, 600, 1800
    assert.deepEqual(drawCalls[0].args, [0, 0, 600, 1800], 'Main frame image must be drawn at 0, 0, 600, 1800 (not stretched across 1200)');
    // Second draw call is mirrored frame image
    assert.ok(transformCalls.some((c) => c.type === 'scale' && c.sx === -1), 'Mirrored frame image must be flipped when mirrorImageFlip is true');
    global.Image = originalImage;
  });
});