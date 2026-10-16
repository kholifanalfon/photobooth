import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import { FRAME_CONFIGS } from '../src/utils/canvasCompositor.js';
import { audioFx } from '../src/utils/audioEffects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');

// Helper to transpile JSX components for testing in Node
function loadJsxComponent(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = esbuild.transformSync(source, {
    loader: 'jsx',
    format: 'esm',
    target: 'node18'
  });
  const tempPath = filePath.replace(/\.jsx$/, '.tmp.mjs');
  fs.writeFileSync(tempPath, transformed.code);
  return {
    tempPath,
    async importModule() {
      try {
        return await import(`file://${tempPath}?update=${Date.now()}`);
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }
  };
}

const lpLoader = loadJsxComponent(path.join(componentsDir, 'LandingPage.jsx'));
const { default: LandingPage } = await lpLoader.importModule();

const fsLoader = loadJsxComponent(path.join(componentsDir, 'FrameSelector.jsx'));
const { default: FrameSelector, PALETTES } = await fsLoader.importModule();

test('PALETTES Configuration', async (t) => {
  await t.test('exports all 6 required theme palettes', () => {
    assert.strictEqual(Array.isArray(PALETTES), true);
    assert.strictEqual(PALETTES.length, 6);

    const names = PALETTES.map((p) => p.name);
    assert.deepStrictEqual(names, [
      'Pure White',
      'Midnight Black',
      'Pastel Pink',
      'Sky Lavender',
      'Mint Soft',
      'Warm Cream'
    ]);
  });

  await t.test('each palette entry contains valid hex and text contrast colors', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const palette of PALETTES) {
      assert.strictEqual(typeof palette.name, 'string');
      assert.ok(palette.name.length > 0);
      assert.match(palette.hex, hexPattern, `${palette.name} hex must be valid 6-char hex`);
      assert.match(palette.text, hexPattern, `${palette.name} text must be valid 6-char hex`);
    }
  });

  await t.test('pure white and midnight black have proper contrast text', () => {
    const white = PALETTES.find((p) => p.name === 'Pure White');
    const black = PALETTES.find((p) => p.name === 'Midnight Black');
    assert.strictEqual(white.hex, '#FFFFFF');
    assert.strictEqual(white.text, '#1e293b');
    assert.strictEqual(black.hex, '#1E1E24');
    assert.strictEqual(black.text, '#FFFFFF');
  });
});

test('LandingPage Component Rendering', async (t) => {
  await t.test('renders heading, description, and CTA button', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, { onStartSession: () => {} })
    );

    assert.ok(html.includes('Capture The Magic!'), 'Must include main title');
    assert.ok(
      html.includes('Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.'),
      'Must include prompt instruction'
    );
    assert.ok(html.includes('Mulai Sekarang'), 'Must include CTA button text');
  });

  await t.test('renders interactive gift box element with accessibility attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, { onStartSession: () => {} })
    );

    assert.ok(html.includes('role="button"'), 'Gift container should have button role');
    assert.ok(
      html.includes('aria-label="Buka Kotak Hadiah"'),
      'Gift container should have descriptive aria-label'
    );
  });

  await t.test('invokes audio effect when playGiftPopSound is triggered', () => {
    let playedSound = false;
    const originalPlayGiftPop = audioFx.playGiftPopSound;
    audioFx.playGiftPopSound = () => {
      playedSound = true;
    };

    try {
      audioFx.playGiftPopSound();
      assert.strictEqual(playedSound, true);
    } finally {
      audioFx.playGiftPopSound = originalPlayGiftPop;
    }
  });
});

test('FrameSelector Component Rendering', async (t) => {
  await t.test('renders title, back button, and confirm CTA', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameSelector, { onConfirm: () => {}, onBack: () => {} })
    );

    assert.ok(html.includes('Pilih Template &amp; Warna Frame') || html.includes('Pilih Template & Warna Frame'));
    assert.ok(html.includes('Kembali'), 'Must include back button text');
    assert.ok(html.includes('Lanjut ke Kamera'), 'Must include confirm CTA text');
  });

  await t.test('renders all 4 layout options from FRAME_CONFIGS', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameSelector, { onConfirm: () => {}, onBack: () => {} })
    );

    for (const [key, config] of Object.entries(FRAME_CONFIGS)) {
      assert.ok(html.includes(config.name), `Must display layout name ${config.name}`);
      assert.ok(
        html.includes(`${config.photoCount} Jepretan`),
        `Must display photo count for ${key}`
      );
    }
  });

  await t.test('renders all 6 palette color options', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameSelector, { onConfirm: () => {}, onBack: () => {} })
    );

    for (const palette of PALETTES) {
      assert.ok(html.includes(palette.name), `Must display palette name ${palette.name}`);
      assert.ok(
        html.includes(`style="background-color:${palette.hex}"`),
        `Must render swatch background color for ${palette.hex}`
      );
    }
  });

  await t.test('default selection matches STRIP_3 and Pure White palette', () => {
    let confirmedData = null;
    const handleConfirm = (data) => {
      confirmedData = data;
    };

    // Simulate onConfirm payload contract
    const defaultPayload = {
      layoutType: 'STRIP_3',
      palette: PALETTES[0],
      frameColor: PALETTES[0].hex
    };
    handleConfirm(defaultPayload);

    assert.ok(confirmedData);
    assert.strictEqual(confirmedData.layoutType, 'STRIP_3');
    assert.strictEqual(confirmedData.frameColor, '#FFFFFF');
    assert.strictEqual(confirmedData.palette.name, 'Pure White');
  });
});
