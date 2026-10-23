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
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-app-flow-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Polyfill SVGElement
if (typeof global.SVGElement === 'undefined') {
  global.SVGElement = class SVGElement {};
}

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/utils\/|\.\.\/constants\/)/ }, (args) => {
      const resolved = args.path.startsWith('.')
        ? 'file://' + path.resolve(componentsDir, args.path)
        : import.meta.resolve(args.path);
      return { path: resolved, external: true };
    });
  }
};

async function buildComponent(fileName) {
  const outFile = path.join(tmpDir, `${fileName}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(componentsDir, `${fileName}.jsx`)],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('LandingPage renders Ganti Event button when hasMultipleEvents is true', async () => {
  const { default: LandingPage } = await buildComponent('LandingPage');

  const html = renderToStaticMarkup(
    React.createElement(LandingPage, {
      initialConfig: { title: 'The Wedding' },
      isLiveMode: false,
      hasMultipleEvents: true,
      activeEventName: 'Wedding Kevin & Sheila',
      onRequestSwitchEvent: () => {}
    })
  );

  assert.ok(html.includes('Ganti Event') || html.includes('Pindah Event'), 'LandingPage should render Ganti Event button');
});

test('LandingConfigDrawer renders Kelola Event quick action button', async () => {
  const { default: LandingConfigDrawer } = await buildComponent('LandingConfigDrawer');

  const html = renderToStaticMarkup(
    React.createElement(LandingConfigDrawer, {
      isOpen: true,
      config: { theme: 'general' },
      onOpenEventManager: () => {}
    })
  );

  assert.ok(html.includes('Kelola Event'), 'LandingConfigDrawer should render Kelola Event action');
});

test('SessionManagerModal renders event dropdown filter when events are provided', async () => {
  const { default: SessionManagerModal } = await buildComponent('SessionManagerModal');

  const mockEvents = [
    { id: 'evt-1', name: 'Wedding Kevin & Sheila' },
    { id: 'evt-2', name: 'Corporate Gala 2026' }
  ];

  const html = renderToStaticMarkup(
    React.createElement(SessionManagerModal, {
      isOpen: true,
      events: mockEvents,
      activeEventId: 'evt-1'
    })
  );

  assert.ok(html.includes('Corporate Gala 2026') && html.includes('Wedding Kevin'), 'SessionManagerModal should include event options');
  assert.ok(html.includes('Semua Event') || html.includes('Filter Event'), 'SessionManagerModal should include event filter label');
});
