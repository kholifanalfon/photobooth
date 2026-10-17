import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import { FRAME_CONFIGS } from '../src/utils/canvasCompositor.js';
import { audioFx } from '../src/utils/audioEffects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

// Create an isolated temporary test directory in os.tmpdir()
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-components-test-'));

// Ensure the temporary directory is cleaned up after test completion
test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Plugin to rewrite external module specifiers and project utils to absolute file URLs
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

const { default: LandingPage } = await buildAndImportComponent('LandingPage');
const { default: FrameSelector, PALETTES } = await buildAndImportComponent('FrameSelector');

// Helper to render component tree with mock state dispatcher for event handler inspection
function renderComponentTree(Component, props, initialStates = []) {
  const prevDispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
  let stateIndex = 0;
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = {
    useState: (initial) => {
      const value = stateIndex < initialStates.length ? initialStates[stateIndex] : initial;
      stateIndex += 1;
      return [value, () => {}];
    }
  };

  try {
    return Component(props);
  } finally {
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = prevDispatcher;
  }
}

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

test('LandingPage Component Rendering & Markup Structure', async (t) => {
  await t.test('renders heading, description, and CTA button with Lucide icons', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, { onStartSession: () => {} })
    );

    assert.ok(html.includes('Capture The Magic! ✨'), 'Must include main title');
    assert.ok(
      html.includes('Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.'),
      'Must include prompt instruction'
    );
    assert.ok(html.includes('Mulai Sekarang'), 'Must include CTA button text');
    assert.ok(html.includes('lucide-sparkles'), 'Must render Sparkles icon');
    assert.ok(html.includes('lucide-camera'), 'Must render Camera icon');
    assert.ok(html.includes('lucide-gift'), 'Must render Gift icon');
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
    assert.ok(html.includes('tabindex="0"'), 'Gift container must be keyboard focusable');
  });
});

test('LandingPage Interactive Event Contracts', async (t) => {
  await t.test('clicking gift box plays sound effect via audioFx', () => {
    let soundPlayed = false;
    const originalPlayGiftPop = audioFx.playGiftPopSound;
    audioFx.playGiftPopSound = () => {
      soundPlayed = true;
    };

    try {
      const tree = renderComponentTree(LandingPage, { onStartSession: () => {} }, [false]);
      const mainContainer = tree.props.children[2];
      const giftBox = mainContainer.props.children[2];
      assert.strictEqual(typeof giftBox.props.onClick, 'function');
      giftBox.props.onClick();
      assert.strictEqual(soundPlayed, true, 'Gift box click must invoke playGiftPopSound');
    } finally {
      audioFx.playGiftPopSound = originalPlayGiftPop;
    }
  });

  await t.test('clicking CTA button triggers onStartSession after animation timeout', async () => {
    let sessionStarted = false;
    const tree = renderComponentTree(
      LandingPage,
      { onStartSession: () => { sessionStarted = true; } },
      [false]
    );

    const mainContainer = tree.props.children[2];
    const ctaButton = mainContainer.props.children[3];
    assert.strictEqual(typeof ctaButton.props.onClick, 'function');

    ctaButton.props.onClick();
    assert.strictEqual(sessionStarted, false, 'Session must not start synchronously before timeout');

    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.strictEqual(sessionStarted, true, 'Session must start after 800ms animation delay');
  });
});

test('FrameSelector Component Rendering & Markup Structure', async (t) => {
  await t.test('renders title, back button, and confirm CTA', () => {
    const html = renderToStaticMarkup(
      React.createElement(FrameSelector, { onConfirm: () => {}, onBack: () => {} })
    );

    assert.ok(
      html.includes('Pilih Template &amp; Warna Frame') || html.includes('Pilih Template & Warna Frame'),
      'Must render header title'
    );
    assert.ok(html.includes('Kembali'), 'Must include back button text');
    assert.ok(html.includes('Lanjut ke Kamera'), 'Must include confirm CTA text');
    assert.ok(html.includes('lucide-arrow-left'), 'Must render ArrowLeft icon');
    assert.ok(html.includes('lucide-arrow-right'), 'Must render ArrowRight icon');
  });

  await t.test('renders all 4 layout options from FRAME_CONFIGS with valid Tailwind scale syntax', () => {
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

    // Verify valid standard Tailwind class syntax for active zoom
    assert.ok(html.includes('scale-[1.02]'), 'Active card must use scale-[1.02] syntax');
    assert.strictEqual(html.includes('scale-102'), false, 'Must not use non-standard scale-102');
  });

  await t.test('renders all 6 palette color options with checkmark on active choice', () => {
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

    assert.ok(html.includes('lucide-check'), 'Active palette swatch must contain checkmark icon');
  });
});

test('FrameSelector Interactive Event Contracts', async (t) => {
  await t.test('clicking back button invokes onBack callback', () => {
    let backTriggered = false;
    const tree = renderComponentTree(FrameSelector, {
      onBack: () => { backTriggered = true; },
      onConfirm: () => {}
    });

    const topBar = tree.props.children[0];
    const backButton = topBar.props.children[0];
    assert.strictEqual(typeof backButton.props.onClick, 'function');
    backButton.props.onClick();
    assert.strictEqual(backTriggered, true, 'Back button click must invoke onBack');
  });

  await t.test('clicking confirm CTA passes layoutType, palette, and frameColor', () => {
    let confirmedData = null;
    const tree = renderComponentTree(FrameSelector, {
      onBack: () => {},
      onConfirm: (data) => { confirmedData = data; }
    });

    const mainGrid = tree.props.children[1];
    const paletteCard = mainGrid.props.children[1];
    const confirmButton = paletteCard.props.children[1];
    assert.strictEqual(typeof confirmButton.props.onClick, 'function');

    confirmButton.props.onClick();

    assert.ok(confirmedData, 'Confirm callback must be invoked with payload');
    assert.strictEqual(confirmedData.layoutType, 'STRIP_3');
    assert.strictEqual(confirmedData.frameColor, '#FFFFFF');
    assert.deepStrictEqual(confirmedData.palette, PALETTES[0]);
  });

  await t.test("renders grid-cols-2 for GRID_2X2 and reflects selected frame color across thumbnails", () => {
    const htmlWhite = renderToStaticMarkup(
      React.createElement(FrameSelector, { onConfirm: () => {}, onBack: () => {} })
    );

    assert.ok(htmlWhite.includes("data-testid=\"thumbnail-grid-2x2\""), "Must have grid 2x2 thumbnail");
    assert.ok(htmlWhite.includes("grid-cols-2 grid-rows-2"), "GRID_2X2 thumbnail must use 2x2 CSS grid");
    assert.ok(htmlWhite.includes("style=\"background-color:#FFFFFF\""), "Thumbnails should reflect selected frame background");

    const treeBlack = renderComponentTree(FrameSelector, { onConfirm: () => {}, onBack: () => {} }, [
      "STRIP_3",
      PALETTES[1]
    ]);
    const htmlBlack = renderToStaticMarkup(treeBlack);
    assert.ok(htmlBlack.includes("style=\"background-color:#1E1E24\""), "Thumbnails must dynamically reflect #1E1E24 frame color");
  });
});
