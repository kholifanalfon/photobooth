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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-download-page-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react)/ }, (args) => {
      return { path: import.meta.resolve(args.path), external: true };
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

const { default: DownloadPage } = await buildAndImportComponent('DownloadPage');

test('DownloadPage - Public Photo Download Layout Suite', async (t) => {
  await t.test('renders header, photo container, and both action buttons with safe scrollable layout', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DownloadPage, {
        filename: 'test-session-12345.jpg'
      })
    );

    assert.ok(markup.includes('Moment Captured'), 'Must include header title');
    assert.ok(markup.includes('Unduh Foto Sekarang'), 'Must include Unduh Foto Sekarang button');
    assert.ok(markup.includes('Bagikan Link Foto'), 'Must include Bagikan Link Foto button');
    assert.ok(markup.includes('test-session-12345.jpg'), 'Must link to image source');
    // Ensure scrollable safe-area container is present to avoid mobile cut-off
    assert.ok(markup.includes('overflow-y-auto'), 'Root container must allow smooth vertical scrolling');
    assert.ok(markup.includes('min-h-[100dvh]'), 'Root container must fill min 100dvh');
  });

  await t.test('displays fallback message when no filename is present', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DownloadPage, {
        filename: ''
      })
    );

    assert.ok(markup.includes('Foto tidak ditemukan'), 'Must render not found placeholder');
  });
});
