import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-camerasession-test-'));

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

async function buildAndImportComponent(componentName) {
  const outfile = path.join(tmpDir, `${componentName}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(componentsDir, `${componentName}.jsx`)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    outfile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outfile}`);
}

test('CameraSession - Viewfinder matches exact slot dimensions from mapping frame configuration', async () => {
  const { default: CameraSession } = await buildAndImportComponent('CameraSession');

  const layoutConfig = {
    layoutType: 'CUSTOM_4R',
    customFrame: {
      id: 'frame-test-1',
      name: 'Frame Event 4R',
      orientation: 'portrait',
      width: 1200,
      height: 1800,
      slots: [
        { id: 1, x: 100, y: 150, width: 444, height: 364, radius: 16 },
        { id: 2, x: 600, y: 150, width: 500, height: 600, radius: 24 }
      ]
    },
    photoCount: 2
  };

  const html = renderToStaticMarkup(
    React.createElement(CameraSession, {
      layoutConfig,
      countdownDuration: 3,
      onComplete: () => {},
      onCancel: () => {}
    })
  );

  // Assert viewfinder aspect ratio matches slot 1 (444 / 364)
  assert.ok(
    html.includes('aspect-ratio:444 / 364') || html.includes('aspect-ratio: 444 / 364') || html.includes('444 / 364'),
    'Viewfinder must reflect slot 1 aspect ratio (444 / 364)'
  );

  // Assert slot dimension indicator
  assert.ok(
    html.includes('Slot #1: 444×364px') || html.includes('444×364px'),
    'Viewfinder should display slot dimensions indicator'
  );
  // Assert Upload Image is removed
  assert.ok(
    !html.includes("Upload Image"),
    "Top navigation bar must NOT contain Upload Image button"
  );

  // Assert timer is rendered as a badge, NOT a select dropdown
  assert.ok(
    !html.includes("aria-label='Set Timer'") && !html.includes("aria-label=\"Set Timer\""),
    "Timer must NOT be rendered as a select dropdown"
  );
  assert.ok(
    html.includes('aria-label="Timer Badge"'),
    "Timer must be rendered as a badge button"
  );
  assert.ok(
    html.includes("3s"),
    "Timer badge must display current timer duration (3s)"
  );

  // Assert Flash when not supported displays with disabled state and icon
  assert.ok(
    html.includes('aria-label="Flash Disabled"') && html.includes('disabled'),
    "Flash button must be disabled with disabled icon when flash is not supported"
  );
});
