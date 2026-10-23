import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-framemgr-event-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Polyfill SVGElement
if (typeof global.SVGElement === 'undefined') {
  global.SVGElement = class SVGElement {};
}
if (typeof global.window !== 'undefined' && typeof global.window.SVGElement === 'undefined') {
  global.window.SVGElement = global.SVGElement;
}

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/)/ }, (args) => {
      const resolved = args.path.startsWith('.')
        ? 'file://' + path.resolve(componentsDir, args.path)
        : import.meta.resolve(args.path);
      return { path: resolved, external: true };
    });
  }
};

async function buildComponent() {
  const outFile = path.join(tmpDir, 'FrameManagerModal.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'FrameManagerModal.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('FrameManagerModal multi-event support', async (t) => {
  const { default: FrameManagerModal } = await buildComponent();

  const dummyFrames = [
    {
      id: 'frame-1',
      name: 'Bingkai Wedding Khusus',
      enabled: true,
      isGlobal: false,
      assignedEventIds: ['ev-1'],
      slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }]
    },
    {
      id: 'frame-2',
      name: 'Bingkai Standard Umum',
      enabled: true,
      isGlobal: true,
      assignedEventIds: [],
      slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }]
    }
  ];

  const dummyEvents = [
    { id: 'ev-1', name: 'Wedding Kevin' },
    { id: 'ev-2', name: 'Gala Night' }
  ];

  await t.test('renders event assignment options and badges on frame cards', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: true,
        onClose: () => {},
        customFrames: dummyFrames,
        events: dummyEvents,
        onSaveFrames: () => {}
      })
    );

    assert.ok(html.includes('Semua Event') || html.includes('Global') || html.includes('Penugasan Event'));
    assert.ok(html.includes('Tersedia untuk Semua Event (Global)'));
    assert.ok(html.includes('1 Event'), 'Should display assigned event badge');
    assert.ok(html.includes('Global'), 'Should display Global badge');
    assert.ok(html.includes('Wedding Kevin'), 'Should display event name in checklist');
    assert.ok(html.includes('Gala Night'), 'Should display second event name in checklist');
  });

  await t.test('supports fallback to config.customFrames when customFrames prop is not provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: true,
        onClose: () => {},
        config: {
          customFrames: dummyFrames,
          events: dummyEvents
        },
        onUpdateConfig: () => {}
      })
    );

    assert.ok(html.includes('Bingkai Wedding Khusus'));
    assert.ok(html.includes('Bingkai Standard Umum'));
    assert.ok(html.includes('Wedding Kevin'));
  });

  await t.test('displays notice when frame is non-global but events list is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameManagerModal, {
        isOpen: true,
        onClose: () => {},
        customFrames: [dummyFrames[0]],
        events: []
      })
    );

    assert.ok(html.includes('Belum ada event terdaftar'));
  });
});
