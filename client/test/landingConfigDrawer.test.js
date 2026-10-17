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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-config-drawer-test-'));

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

const { default: LandingConfigDrawer, THEME_PRESETS, PRINTER_PRESETS } =
  await buildAndImportComponent('LandingConfigDrawer');

test('LandingConfigDrawer - 2 Tab Architecture & Printer Configuration', async (t) => {
  const baseConfig = {
    title: 'The Wedding Celebration 💍',
    subtitle: 'Abadikan momen bahagia bersama kami',
    eventDate: 'Saturday, 17 October 2026',
    coupleNames: 'Yusron & Diva',
    videoUrl: '',
    enableVideo: false,
    videoRatio: 'auto',
    theme: 'wedding',
    requireSessionCode: false,
    sessionCode: '1234',
    printerName: 'Default System Printer',
    paperSize: '4R',
    printCopies: 2,
    printMethod: 'kiosk',
    autoPrint: false
  };

  await t.test('renders exactly 2 navigation tabs: Media & Tema and Konfigurasi Printer', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingConfigDrawer, {
        isOpen: true,
        onClose: () => {},
        config: baseConfig,
        onUpdateConfig: () => {},
        onGoLive: () => {}
      })
    );

    assert.ok(html.includes('Media &amp; Tema') || html.includes('Media & Tema'), 'Must render Media & Tema tab');
    assert.ok(html.includes('Konfigurasi Printer'), 'Must render Konfigurasi Printer tab');
    assert.ok(!html.includes('<span>Konten &amp; Teks</span>') && !html.includes('<span>Konten & Teks</span>'), 'Old Konten & Teks tab must be gone');
    assert.ok(html.includes('Go Live'), 'Must render Go Live banner/button');
  });

  await t.test('renders Media & Tema sections (Theme presets 1-line, Event text, Video upload, and Session Code)', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingConfigDrawer, {
        isOpen: true,
        onClose: () => {},
        config: baseConfig,
        onUpdateConfig: () => {},
        onGoLive: () => {}
      })
    );

    assert.ok(html.includes('Pilihan Tema Tampilan'), 'Must render theme preset section');
    assert.ok(html.includes('Pernikahan Romantis'), 'Must render wedding theme name');
    assert.ok(html.includes('Umum &amp; Ceria') || html.includes('Umum & Ceria'), 'Must render general theme name');
    assert.ok(html.includes('Teks Pengantar &amp; Informasi Acara') || html.includes('Teks Pengantar & Informasi Acara'), 'Must render text info section');
    assert.ok(html.includes('Tanggal Acara (Frame Atas)'), 'Must render top frame date input');
    assert.ok(html.includes('Nama Pasangan / Acara'), 'Must render bottom frame couple names input');
    assert.ok(html.includes('Tampilkan Video Pengantar'), 'Must render video toggle');
    assert.ok(html.includes('Chunking 1.5MB'), 'Must render chunking badge');
    assert.ok(html.includes('Wajibkan Kode Sesi untuk Mulai'), 'Must render session code toggle');
  });

  await t.test('exports THEME_PRESETS and PRINTER_PRESETS with valid items', () => {
    assert.ok(THEME_PRESETS.wedding, 'Must have wedding preset');
    assert.ok(THEME_PRESETS.general, 'Must have general preset');
    assert.ok(Array.isArray(PRINTER_PRESETS), 'PRINTER_PRESETS must be an array');
    assert.ok(PRINTER_PRESETS.some(p => p.id === 'Default System Printer'), 'Must include Default System Printer');
    assert.ok(PRINTER_PRESETS.some(p => p.id.includes('DNP')), 'Must include DNP DS620');
  });
});
