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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-printer-modal-test-'));

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

const { default: PrinterConfigModal } = await buildAndImportComponent('PrinterConfigModal');

test('PrinterConfigModal - Thermal Label & Printer Suite', async (t) => {
  const mockConfig = {
    printMethod: 'bluetooth',
    bluetoothDeviceName: 'Niimbot B21S',
    bluetoothLabelSize: '50x30',
    bluetoothLabelWidthMm: 50,
    bluetoothLabelHeightMm: 30,
    bluetoothMarginMm: 1.5,
    bluetoothFitMode: 'fit',
    bluetoothAutoRotate: true,
    printOrientation: 'auto',
    bluetoothDensity: 2,
    bluetoothBrightnessPreset: 'terang',
    bluetoothBrightness: 22,
    bluetoothGamma: 1.75,
    bluetoothDither: 'atkinson',
    bluetoothSharpen: true
  };

  await t.test('returns null when isOpen is false', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrinterConfigModal, {
        isOpen: false,
        onClose: () => {},
        config: mockConfig,
        onUpdateConfig: () => {}
      })
    );
    assert.equal(markup, '');
  });

  await t.test('renders modal layout with live preview canvas, safe margin and controls when isOpen is true', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrinterConfigModal, {
        isOpen: true,
        onClose: () => {},
        config: mockConfig,
        onUpdateConfig: () => {}
      })
    );

    // Title & Header specs
    assert.ok(markup.includes('Konfigurasi Printer &amp; Label Stiker') || markup.includes('Konfigurasi Printer & Label Stiker'));
    assert.ok(markup.includes('Niimbot B21S'));
    assert.ok(markup.includes('50 × 30 mm'));
    assert.ok(markup.includes('203 DPI'));

    // Safe Margin Controls
    assert.ok(markup.includes('Margin Aman (Safe Margin):'));
    assert.ok(markup.includes('1.5 mm ✨'));
    assert.ok(markup.includes('Batas Aman 1.5 mm'));

    // Orientation Controls
    assert.ok(markup.includes('Orientasi Cetak Stiker:'));
    assert.ok(markup.includes('Portrait (Tegak)') || markup.includes('Portrait'));
    assert.ok(markup.includes('Landscape (Mendatar)') || markup.includes('Landscape'));

    // Fit & Auto-Rotate Controls
    assert.ok(markup.includes('Penyesuaian Stiker:'));
    assert.ok(markup.includes('Muat Utuh ✨'));
    assert.ok(markup.includes('Rotasi Otomatis (90°)'));

    // Thermal Quality Controls
    assert.ok(markup.includes('Kualitas Foto Thermal (Anti-Gelap)'));
    assert.ok(markup.includes('Atkinson Tone Mapping'));
    assert.ok(markup.includes('Cerah / Kiosk ✨ (+22)'));
    assert.ok(markup.includes('2 - Sedang ✨ (Rekomendasi)'));

    // Printer Model Selection Controls
    assert.ok(markup.includes('Model &amp; Tipe Printer:') || markup.includes('Model & Tipe Printer:'));
    assert.ok(markup.includes('Niimbot B1 Pro'));
    assert.ok(markup.includes('Niimbot B1'));
    assert.ok(markup.includes('Niimbot B21 Pro'));
    assert.ok(markup.includes('Niimbot B21 / B21S'));
    assert.ok(markup.includes('Niimbot D110'));
    assert.ok(markup.includes('Generic ESC/POS'));
  });

  await t.test('renders 300 DPI header badge when printerModelPreset is b1_pro', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PrinterConfigModal, {
        isOpen: true,
        onClose: () => {},
        config: {
          ...mockConfig,
          printerModelPreset: 'b1_pro'
        },
        onUpdateConfig: () => {}
      })
    );
    assert.ok(markup.includes('300 DPI'));
  });
});
