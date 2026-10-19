import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-frame-mgr-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Polyfill SVGElement and basic browser elements if global.window exists
if (typeof global.SVGElement === 'undefined') {
  global.SVGElement = class SVGElement {};
}
if (typeof global.window !== 'undefined' && typeof global.window.SVGElement === 'undefined') {
  global.window.SVGElement = global.SVGElement;
}

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

const { default: FrameManagerModal } = await buildAndImportComponent('FrameManagerModal');
const { default: LandingPage } = await buildAndImportComponent('LandingPage');
const { default: LandingConfigDrawer } = await buildAndImportComponent('LandingConfigDrawer');

test('FrameManagerModal - Lifecycle, UI Markup & Frame Operations', async (t) => {
  const mockConfig = {
    customFrames: [
      {
        id: 'frame-test-1',
        name: 'Frame Vintage Floral',
        enabled: true,
        orientation: 'portrait',
        paperSize: '4R',
        width: 1200,
        height: 1800,
        imageUrl: '/uploads/frames/frame_test_1.png',
        slots: [
          { id: 1, x: 100, y: 100, width: 450, height: 600 },
          { id: 2, x: 600, y: 100, width: 450, height: 600 }
        ]
      },
      {
        id: 'frame-test-2',
        name: 'Frame Strip Classic 3',
        enabled: false,
        orientation: 'landscape',
        paperSize: 'image',
        width: 1600,
        height: 900,
        imageUrl: '',
        slots: [
          { id: 1, x: 50, y: 50, width: 400, height: 400 }
        ]
      }
    ]
  };

  await t.test('returns null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: false,
        onClose: () => {},
        config: mockConfig
      })
    );
    assert.strictEqual(html, '', 'Should return empty markup when closed');
  });

  await t.test('renders modal header, action buttons and frame stats when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: true,
        onClose: () => {},
        config: mockConfig
      })
    );

    assert.ok(html.includes('Kelola Desain Frame Photobooth'), 'Should render modal title');
    assert.ok(html.includes('Upload Gambar Frame'), 'Should render Upload button');
    assert.ok(html.includes('Tambah Frame'), 'Should render Tambah Frame button');
    assert.ok(html.includes('Total 2 Desain'), 'Should render total frame count');
    assert.ok(html.includes('1 Aktif untuk Tamu'), 'Should render active frame count');
  });

  await t.test('renders all frame cards with accurate badges, names and slot controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: true,
        onClose: () => {},
        config: mockConfig
      })
    );

    // Frame 1
    assert.ok(html.includes('Frame Vintage Floral'), 'Should display Frame 1 name');
    assert.ok(html.includes('2 Slot Foto'), 'Should display 2 Slot Foto badge');
    assert.ok(html.includes('4R Portrait'), 'Should display 4R Portrait badge');
    assert.ok(html.includes('1200 × 1800 px'), 'Should display 1200x1800 px dimensions');

    // Frame 2
    assert.ok(html.includes('Frame Strip Classic 3'), 'Should display Frame 2 name');
    assert.ok(html.includes('1 Slot Foto'), 'Should display 1 Slot Foto badge');
    assert.ok(html.includes('Ukuran Frame Landscape'), 'Should display Ukuran Frame Landscape badge');

    // Action buttons
    assert.ok(html.includes('Atur Slot Foto'), 'Should render Atur Slot Foto button');
    assert.ok(html.includes('Aktif untuk Tamu'), 'Should render Aktif untuk Tamu toggle');
    assert.ok(html.includes('Duplikat Frame'), 'Should render duplicate button');
  });
});

test('LandingPage - Opsi B Kelola Frame Quick Button & Drawer Integration', async (t) => {
  await t.test('LandingPage top-left navigation renders Kelola Frame alongside Kelola Sesi and Pengaturan', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, {
        isLiveMode: false,
        onStartSession: () => {}
      })
    );

    assert.ok(html.includes('Kelola Frame'), 'LandingPage must render Kelola Frame button in top-left navigation');
    assert.ok(html.includes('Kelola Sesi'), 'LandingPage must render Kelola Sesi button');
    assert.ok(html.includes('Buka Pengaturan Landing'), 'LandingPage must render Settings button');
  });

  await t.test('LandingConfigDrawer renders Buka Kelola Frame prominent card in printer tab', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingConfigDrawer, {
        isOpen: true,
        initialTab: 'printer',
        onClose: () => {},
        config: {
          customFrames: [
            { id: 'f1', name: 'Frame Kiosk A', enabled: true, slots: [{ id: 1 }] }
          ]
        },
        onUpdateConfig: () => {},
        onGoLive: () => {}
      })
    );

    assert.ok(html.includes('Buka Kelola Frame'), 'Drawer must render Buka Kelola Frame button in printer tab');
    assert.ok(html.includes('1 dari 1 frame aktif untuk tamu'), 'Drawer should render active frame summary');
  });
});
