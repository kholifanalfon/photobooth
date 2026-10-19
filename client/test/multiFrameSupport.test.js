import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MODERN_4R_FRAMES } from '../src/constants/framePresets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-multiframe-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/constants\/|\.\.\/utils\/)/ }, (args) => {
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

test('Multi-Frame Support - FrameSelector renders custom event frames when availableCustomFrames is provided', async () => {
  const { default: FrameSelector } = await buildAndImportComponent('FrameSelector');

  const dummyFrames = [
    {
      id: 'frame-1',
      name: 'Frame 1 (Wedding Elegant)',
      orientation: 'portrait',
      imageUrl: '/uploads/frame1.png',
      enabled: true,
      slots: [
        { id: 1, x: 50, y: 50, width: 500, height: 600 },
        { id: 2, x: 600, y: 50, width: 500, height: 600 }
      ]
    },
    {
      id: 'frame-2',
      name: 'Frame 2 (Vintage Landscape)',
      orientation: 'landscape',
      imageUrl: '/uploads/frame2.png',
      enabled: true,
      slots: [
        { id: 1, x: 50, y: 50, width: 500, height: 500 },
        { id: 2, x: 600, y: 50, width: 500, height: 500 },
        { id: 3, x: 1150, y: 50, width: 500, height: 500 }
      ]
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(FrameSelector, {
      onConfirm: () => {},
      onBack: () => {},
      availableCustomFrames: dummyFrames
    })
  );

  // Check header
  assert.ok(html.includes('Pilih Desain Frame Foto'), 'Should display custom frame selection title');
  // Check tab counter
  assert.ok(html.includes('Desain Acara (2)'), 'Should display count of custom event frames');
  // Check frame names
  assert.ok(html.includes('Frame 1 (Wedding Elegant)'), 'Should render Frame 1 name');
  assert.ok(html.includes('Frame 2 (Vintage Landscape)'), 'Should render Frame 2 name');
  // Check slot & orientation descriptions
  assert.ok(html.includes('4R Portrait • 2 Foto'), 'Should render portrait frame details');
  assert.ok(html.includes('4R Landscape • 3 Foto'), 'Should render landscape frame details');
});

test('Multi-Frame Support - LandingConfigDrawer renders dedicated Kelola Frame summary and trigger', async () => {
  const { default: LandingConfigDrawer } = await buildAndImportComponent('LandingConfigDrawer');

  const config = {
    theme: 'wedding',
    customFrames: [
      {
        id: 'frame-1',
        name: 'Desain Floral',
        enabled: true,
        orientation: 'portrait',
        slots: [{ id: 1, x: 0, y: 0, width: 500, height: 500 }]
      },
      {
        id: 'frame-2',
        name: 'Desain Strip Gold',
        enabled: false,
        orientation: 'landscape',
        slots: [
          { id: 1, x: 0, y: 0, width: 400, height: 400 },
          { id: 2, x: 450, y: 0, width: 400, height: 400 }
        ]
      }
    ]
  };

  const html = renderToStaticMarkup(
    React.createElement(LandingConfigDrawer, {
      isOpen: true,
      onClose: () => {},
      config,
      onUpdateConfig: () => {},
      onGoLive: () => {},
      initialTab: 'printer'
    })
  );

  assert.ok(html.includes('Kelola Desain Frame'), 'Should render Kelola Desain Frame section title');
  assert.ok(html.includes('Buka Kelola Frame (Tampilan Luas)'), 'Should have button to open full frame manager');
  assert.ok(html.includes('1 dari 2 frame aktif untuk tamu'), 'Should display active frame count summary');
  assert.ok(html.includes('2 Desain'), 'Should indicate total 2 designs badge');
  assert.ok(!html.includes('Daftar Desain Frame (2 Frame)'), 'Redundant frame list header should be removed from drawer');
  assert.ok(!html.includes('Mapping Frame'), 'Redundant mapping frame buttons should be removed from drawer');
});

test('Multi-Frame Support - FrameSelector with single frame renders mapped frame and confirms CUSTOM_4R layout', async () => {
  const { default: FrameSelector } = await buildAndImportComponent('FrameSelector');

  const singleFrame = [
    {
      id: 'frame-wedding-1',
      name: 'Frame Wedding Gold (4R)',
      orientation: 'portrait',
      imageUrl: '/uploads/wedding.png',
      enabled: true,
      slots: [
        { id: 1, x: 100, y: 100, width: 400, height: 400 },
        { id: 2, x: 100, y: 600, width: 400, height: 400 },
        { id: 3, x: 100, y: 1100, width: 400, height: 400 }
      ]
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(FrameSelector, {
      onConfirm: () => {},
      onBack: () => {},
      availableCustomFrames: singleFrame
    })
  );

  assert.ok(html.includes('Pilih Desain Frame Foto'), 'Should show custom frame title');
  assert.ok(html.includes('Frame Wedding Gold (4R)'), 'Should show mapped frame name');
  assert.ok(html.includes('4R Portrait • 3 Foto'), 'Should show orientation and slot count');
  assert.ok(html.includes('/uploads/wedding.png'), 'Should render frame image URL');
  assert.ok(html.includes('#1') && html.includes('#2') && html.includes('#3'), 'Should display mapped slot numbers overlay');
});

test('Modern 4R Frames - 4 kiosk frames exist, have valid slots fitting 1200x1800, and render in FrameSelector', async () => {
  assert.strictEqual(MODERN_4R_FRAMES.length, 4, 'Should export exactly 4 modern 4R kiosk frames');

  const [frame1, frame2, frame3, frame4] = MODERN_4R_FRAMES;

  // Frame 1: Bingkai 1 Foto
  assert.strictEqual(frame1.name, 'Bingkai 1 Foto');
  assert.strictEqual(frame1.photoCount, 1);
  assert.strictEqual(frame1.slots.length, 1);
  assert.strictEqual(frame1.width, 1200);
  assert.strictEqual(frame1.height, 1800);

  // Frame 2: Bingkai 2 Foto
  assert.strictEqual(frame2.name, 'Bingkai 2 Foto');
  assert.strictEqual(frame2.photoCount, 2);
  assert.strictEqual(frame2.slots.length, 2);

  // Frame 3: Bingkai 3 Foto
  assert.strictEqual(frame3.name, 'Bingkai 3 Foto');
  assert.strictEqual(frame3.photoCount, 3);
  assert.strictEqual(frame3.slots.length, 3);

  // Frame 4: Bingkai 4 Foto
  assert.strictEqual(frame4.name, 'Bingkai 4 Foto');
  assert.strictEqual(frame4.photoCount, 4);
  assert.strictEqual(frame4.slots.length, 4);

  // Verify all slots fit strictly inside 1200x1800 canvas and above footer
  for (const f of MODERN_4R_FRAMES) {
    for (const s of f.slots) {
      assert.ok(s.x >= 0, `slot x=${s.x} must be non-negative`);
      assert.ok(s.y >= 0, `slot y=${s.y} must be non-negative`);
      assert.ok(s.x + s.width <= 1200, `slot x+w=${s.x + s.width} must fit in width 1200`);
      assert.ok(s.y + s.height <= 1800, `slot y+h=${s.y + s.height} must fit in height 1800`);
    }
  }

  // Render FrameSelector with MODERN_4R_FRAMES
  const { default: FrameSelector } = await buildAndImportComponent('FrameSelector');
  const html = renderToStaticMarkup(
    React.createElement(FrameSelector, {
      onConfirm: () => {},
      onBack: () => {},
      availableCustomFrames: MODERN_4R_FRAMES
    })
  );

  assert.ok(html.includes('Bingkai 1 Foto'), 'Should render Bingkai 1 Foto');
  assert.ok(html.includes('Bingkai 2 Foto'), 'Should render Bingkai 2 Foto');
  assert.ok(html.includes('Bingkai 3 Foto'), 'Should render Bingkai 3 Foto');
  assert.ok(html.includes('Bingkai 4 Foto'), 'Should render Bingkai 4 Foto');
  assert.ok(html.includes('Desain Acara (4)'), 'Should display count of 4 frames');
});

test("Multi-Frame Support - FrameSelector renders custom uploaded image dimensions with dynamic aspectRatio and without 4R label when paperSize is image", async () => {
  const { default: FrameSelector } = await buildAndImportComponent("FrameSelector");

  const customUploadedFrames = [
    {
      id: "frame-custom-img-portrait",
      name: "Bingkai Foto Kustom 709x945",
      paperSize: "image",
      width: 709,
      height: 945,
      orientation: "portrait",
      imageUrl: "/uploads/frames/frame_709x945.jpg",
      enabled: true,
      slots: [
        { id: 1, x: 50, y: 50, width: 600, height: 600 }
      ]
    },
    {
      id: "frame-custom-img-square",
      name: "Bingkai Foto Square 1080x1080",
      paperSize: "image",
      width: 1080,
      height: 1080,
      orientation: "portrait",
      imageUrl: "/uploads/frames/frame_square.jpg",
      enabled: true,
      slots: [
        { id: 1, x: 40, y: 40, width: 1000, height: 1000 }
      ]
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(FrameSelector, {
      onConfirm: () => {},
      onBack: () => {},
      availableCustomFrames: customUploadedFrames
    })
  );

  // Aspect ratio must be dynamic based on exact dimensions
  assert.ok(html.includes("709 / 945"), "Should use dynamic aspect ratio for 709x945 frame");
  assert.ok(html.includes("1080 / 1080"), "Should use dynamic aspect ratio for square frame");

  // Badge must NOT contain 4R when paperSize is image
  assert.ok(html.includes("Ukuran Frame Portrait • 1 Foto"), "Should show Ukuran Frame Portrait badge");
  assert.ok(html.includes("Ukuran Frame (Kotak) • 1 Foto"), "Should show Ukuran Frame (Kotak) badge");
  assert.ok(!html.includes("4R Portrait"), "Should not show 4R Portrait for uploaded image frame");
  assert.ok(!html.includes("4R Landscape"), "Should not show 4R Landscape for uploaded image frame");
});
