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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-event-selector-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

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
  const outFile = path.join(tmpDir, 'EventSelectorScreen.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'EventSelectorScreen.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('EventSelectorScreen renders event cards and empty state correctly', async (t) => {
  const { default: EventSelectorScreen } = await buildComponent();

  await t.test('renders event cards with details, badges, and kiosk hero', () => {
    const dummyEvents = [
      {
        id: 'ev-1',
        name: 'Wedding Kevin & Sheila',
        slug: 'wedding-kevin-sheila',
        status: 'ACTIVE',
        config: { eventDate: '24 Oktober 2026', theme: 'wedding' }
      },
      {
        id: 'ev-2',
        name: 'Corporate Annual Dinner',
        slug: 'corp-dinner',
        status: 'ACTIVE',
        config: { eventDate: '15 November 2026', theme: 'modern_dark' }
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(EventSelectorScreen, {
        events: dummyEvents,
        onSelectEvent: () => {},
        onOpenAdmin: () => {}
      })
    );

    assert.ok(html.includes('Wedding Kevin &amp; Sheila') || html.includes('Wedding Kevin & Sheila'), 'Must render first event name');
    assert.ok(html.includes('Corporate Annual Dinner'), 'Must render second event name');
    assert.ok(html.includes('Pilih Event'), 'Must render hero title');
    assert.ok(html.includes('Silakan pilih acara yang sedang berlangsung untuk memulai Photobooth.'), 'Must render hero subtitle');
    assert.ok(html.includes('24 Oktober 2026'), 'Must render first event date');
    assert.ok(html.includes('15 November 2026'), 'Must render second event date');
    assert.ok(html.includes('Masuk ke Booth'), 'Must render Masuk ke Booth action');
    assert.ok(html.includes('wedding'), 'Must render theme badge');
    assert.ok(html.includes('ACTIVE'), 'Must render status badge');
  });

  await t.test('renders empty state when events list is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(EventSelectorScreen, {
        events: [],
        onSelectEvent: () => {},
        onOpenAdmin: () => {}
      })
    );

    assert.ok(html.includes('Pilih Event'), 'Must still render title or header context');
    assert.ok(
      html.includes('Belum ada acara aktif') ||
      html.includes('Tidak ada event') ||
      html.includes('Belum ada event'),
      'Must render friendly empty warning message'
    );
    assert.ok(
      html.includes('Admin') || html.includes('Kelola Event') || html.includes('Pengaturan'),
      'Must render button or link to open Admin settings'
    );
  });

  await t.test('handles default / missing props gracefully', () => {
    const html = renderToStaticMarkup(
      React.createElement(EventSelectorScreen)
    );

    assert.ok(html.includes('Pilih Event'), 'Must render title even without props');
    assert.ok(
      html.includes('Belum ada acara aktif') ||
      html.includes('Tidak ada event') ||
      html.includes('Belum ada event'),
      'Must fallback to empty state cleanly'
    );
  });
});
