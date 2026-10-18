import { resolveSlotsPhotoMapping } from '../src/constants/framePresets.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-precision-modal-test-'));

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

const { default: PrecisionFrameEditorModal } = await buildAndImportComponent('PrecisionFrameEditorModal');

test('PrecisionFrameEditorModal - Precision Mapping Frame Suite', async (t) => {
  const mockFrame = {
    enabled: true,
    imageUrl: '/uploads/custom_frame.png',
    orientation: 'portrait',
    width: 1200,
    height: 1800,
    slots: [
      { id: 1, x: 70, y: 120, width: 510, height: 600, radius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
      { id: 2, x: 620, y: 120, width: 510, height: 600, radius: 16, borderWidth: 2, borderColor: '#FFFFFF' }
    ]
  };

  await t.test('returns null / empty markup when isOpen is false', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: false,
        onClose: () => {},
        customFrame: mockFrame,
        onUpdateFrame: () => {}
      })
    );
    assert.equal(markup, '', 'Modal should not render when isOpen is false');
  });

  await t.test('renders high precision editor markup with zoom and slot controls when isOpen is true', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: true,
        onClose: () => {},
        customFrame: mockFrame,
        onUpdateFrame: () => {}
      })
    );

    assert.ok(markup.includes('Editor Presisi Frame &amp; Mapping Slot'), 'Must render title');
    assert.ok(markup.includes('4R Portrait (1200 × 1800 px)'), 'Must render 4R portrait resolution badge');
    assert.ok(markup.includes('100%'), 'Must render zoom level indicator');
    assert.ok(!markup.includes('100% Fit'), 'Must NOT render removed 100% Fit button');
    assert.ok(markup.includes('Grid: 50px'), 'Must render grid dropdown with 50px option');
    assert.ok(markup.includes('Grid: 20px'), 'Must render grid dropdown with 20px option');
    assert.ok(markup.includes('Grid: 3×3'), 'Must render grid dropdown with 3x3 option');
    assert.ok(markup.includes('Contoh Foto Tamu'), 'Must render placeholder toggle with tooltip');
    assert.ok(markup.includes('Selesai &amp; Simpan'), 'Must render save CTA');
    assert.ok(markup.includes('aria-label="Undo"'), 'Must render Undo button in header toolbar');
    assert.ok(markup.includes('aria-label="Redo"'), 'Must render Redo button in header toolbar');
    assert.ok(markup.includes('Ctrl + Z'), 'Must display Ctrl + Z shortcut');
    assert.ok(markup.includes('Ctrl + Shift + Z'), 'Must display Ctrl + Shift + Z shortcut');
    assert.ok(markup.includes('Ctrl + Scroll'), 'Must display Ctrl + Scroll shortcut');
    assert.ok(markup.includes('Slot #1'), 'Must render Slot 1 badge');
    assert.ok(markup.includes('Slot #2'), 'Must render Slot 2 badge');
    assert.ok(markup.includes('Tengah Horizontal (X)'), 'Must render horizontal alignment helper');
    assert.ok(markup.includes('Tengah Vertikal (Y)'), 'Must render vertical alignment helper');
    assert.ok(markup.includes('Lebar / Width'), 'Must render Lebar / Width control');
    assert.ok(markup.includes('Tinggi / Height'), 'Must render Tinggi / Height control');
    assert.ok(markup.includes('Posisi X (Kiri)'), 'Must render Posisi X control');
    assert.ok(markup.includes('Posisi Y (Atas)'), 'Must render Posisi Y control');
    assert.ok(markup.includes('grid grid-cols-2'), 'Must arrange controls in 2 columns');
    assert.ok(markup.includes('Portrait (Tegak)'), 'Must render Portrait orientation toggle');
    assert.ok(markup.includes('Landscape (Mendatar)'), 'Must render Landscape orientation toggle');
    assert.ok(markup.includes('File Desain Frame'), 'Must render File Desain Frame section');
    assert.ok(markup.includes('cursor-nwse-resize'), 'Must render direct resize corner handles');
    assert.ok(markup.includes('cursor-ew-resize'), 'Must render direct resize width handles');
    assert.ok(markup.includes('cursor-ns-resize'), 'Must render direct resize height handles');
  });

  await t.test('supports landscape orientation with 1800 x 1200 dimensions', () => {
    const landscapeFrame = {
      ...mockFrame,
      orientation: 'landscape',
      width: 1800,
      height: 1200
    };

    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: true,
        onClose: () => {},
        customFrame: landscapeFrame,
        onUpdateFrame: () => {}
      })
    );

    assert.ok(markup.includes('4R Landscape (1800 × 1200 px)'), 'Must render 4R landscape resolution badge');
  });

  await t.test('renders mirror slot controls and displays mirror pose mapping', () => {
    const sixSlotFrame = {
      ...mockFrame,
      slots: [
        { id: 1, x: 100, y: 100, width: 400, height: 400, photoIndex: 0 },
        { id: 2, x: 600, y: 100, width: 400, height: 400, photoIndex: 0 },
        { id: 3, x: 100, y: 600, width: 400, height: 400, photoIndex: 1 },
        { id: 4, x: 600, y: 600, width: 400, height: 400, photoIndex: 1 },
        { id: 5, x: 100, y: 1100, width: 400, height: 400, photoIndex: 2 },
        { id: 6, x: 600, y: 1100, width: 400, height: 400, photoIndex: 2 }
      ],
      photoCount: 3
    };

    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: true,
        onClose: () => {},
        customFrame: sixSlotFrame,
        onUpdateFrame: () => {}
      })
    );

    // Assert Gambar 1 feature is removed
    assert.ok(!markup.includes('Fitur Mirror Slot (Duplikasi Foto)'), 'Must NOT render removed Gambar 1 mirror section');
    assert.ok(!markup.includes('Mirror Kolom (Kiri = Kanan)'), 'Must NOT render removed Column Mirror button');
    assert.ok(!markup.includes('Mirror Pasangan (1=2, 3=4)'), 'Must NOT render removed Pair Mirror button');

    // Assert Redesigned slot list, Copy/Paste buttons, and shortcuts
    assert.ok(markup.includes('Daftar Slot Foto'), 'Must render redesigned slot list title');
    assert.ok(markup.includes('Salin'), 'Must render Salin / Copy button');
    assert.ok(markup.includes('Tempel'), 'Must render Tempel / Paste button');
    assert.ok(markup.includes('Ctrl + C'), 'Must render Ctrl+C shortcut cheat sheet');
    assert.ok(markup.includes('Ctrl + V'), 'Must render Ctrl+V shortcut cheat sheet');
    assert.ok(markup.includes('Ctrl + D'), 'Must render Ctrl+D shortcut cheat sheet');
    assert.ok(markup.includes('Mirror (3 Pose)'), 'Must render active mirror status in header');
    assert.ok(markup.includes('Foto #1') || markup.includes('Foto 1'), 'Must render photo mapping badge');
    assert.ok(markup.includes('Sumber Pose Kamera / Foto:'), 'Must render camera pose source selector');
    assert.ok(markup.includes('Buat Slot Baru (Mirror dari Slot #'), 'Must render create mirror slot action');
  });
  await t.test('resolveSlotsPhotoMapping correctly handles Slot 4 mirroring Slot 1', () => {
    const slots = [
      { id: 1, mirrorFromSlot: null },
      { id: 2, mirrorFromSlot: null },
      { id: 3, mirrorFromSlot: null },
      { id: 4, mirrorFromSlot: 0 } // mirrors Slot 1
    ];

    const { slotPhotoIndices, uniquePhotoCount } = resolveSlotsPhotoMapping(slots);
    assert.deepEqual(slotPhotoIndices, [0, 1, 2, 0], 'Slot 4 must mirror Slot 1 pose 0');
    assert.equal(uniquePhotoCount, 3, 'Camera must only take 3 photos for 4 slots');
  });
  await t.test("renders anti-stretch layout controls, image drag mode, and mirror frame image controls", () => {
    const frameWithImage = {
      ...mockFrame,
      imageUrl: "/uploads/photostrip.png",
      imageX: 0,
      imageY: 0,
      imageWidth: 600,
      imageHeight: 1800,
      imageMirror: true,
      mirrorImageX: 600,
      mirrorImageY: 0,
      mirrorImageWidth: 600,
      mirrorImageHeight: 1800,
      mirrorImageFlip: false
    };

    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: true,
        onClose: () => {},
        customFrame: frameWithImage,
        onUpdateFrame: () => {}
      })
    );

    assert.ok(markup.includes("Geser &amp; Mirror Desain"), "Must render Mode Switcher button for image editing");
    assert.ok(markup.includes("Tata Letak Desain Frame (Anti-Stretch):"), "Must render Anti-Stretch layout section");
    assert.ok(markup.includes("2 Strip (600 × 1800)"), "Must render 2-Strip anti-stretch preset button");
    assert.ok(markup.includes("Penuh 4R (1200 × 1800)"), "Must render full 4R preset button");
    assert.ok(markup.includes("Posisi Desain Utama:"), "Must render Main frame image position label");
    assert.ok(markup.includes("Fitur Mirror Gambar Frame (Duplikat Strip):"), "Must render Mirror Frame Image toggle");
    assert.ok(markup.includes("Posisi &amp; Geser Mirror:"), "Must render Mirror position controls");
    assert.ok(markup.includes("Simetris Kanan"), "Must render quick Symmetrical Right button");
    assert.ok(markup.includes("Flip Horiz"), "Must render Flip Horizontal toggle button");
  });
  await t.test("renders redesigned slot cards and Copy-Paste slot actions with shortcuts", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrecisionFrameEditorModal, {
        isOpen: true,
        onClose: () => {},
        customFrame: mockFrame,
        onUpdateFrame: () => {}
      })
    );

    assert.ok(markup.includes("Salin"), "Must render Copy slot button");
    assert.ok(markup.includes("Tempel"), "Must render Paste slot button");
    assert.ok(markup.includes("Ctrl + C"), "Must display Ctrl+C shortcut tooltip");
    assert.ok(markup.includes("Ctrl + V"), "Must display Ctrl+V shortcut tooltip");
    assert.ok(markup.includes("Ctrl + D"), "Must display Ctrl+D shortcut tooltip");
    assert.ok(markup.includes("Daftar Slot Foto"), "Must render redesigned slot list");
    assert.ok(markup.includes("Slot #1"), "Must render clean Slot #1 button");
    assert.ok(markup.includes("|"), "Must render separator pipe");
  });
});