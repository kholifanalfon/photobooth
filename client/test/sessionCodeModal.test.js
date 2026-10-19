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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-session-code-test-'));

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

const { default: SessionCodeModal } = await buildAndImportComponent('SessionCodeModal');
const { default: LandingPage } = await buildAndImportComponent('LandingPage');

test('SessionCodeModal - Dialog Rendering & Keypad Structure', async (t) => {
  await t.test('renders modal when isOpen is true with PIN keypad', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionCodeModal, {
        isOpen: true,
        onClose: () => {},
        onSuccess: () => {},
        expectedCode: '1234',
        theme: 'wedding'
      })
    );

    assert.ok(html.includes('Masukkan Kode Sesi'), 'Must render title');
    assert.ok(html.includes('Silakan masukkan kode akses'), 'Must render description');
    assert.ok(html.includes('Mulai Foto'), 'Must render submit button');
    assert.ok(html.includes('Batal'), 'Must render cancel button');
    // Numeric keypad
    for (let i = 0; i <= 9; i++) {
      assert.ok(html.includes(`>${i}<`), `Must render keypad digit ${i}`);
    }
  });

  await t.test('returns empty markup when isOpen is false under AnimatePresence', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionCodeModal, {
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
        expectedCode: '1234'
      })
    );
    assert.strictEqual(html, '');
  });
});

test('LandingPage - Mode Live vs Mode Konfigurasi Separation', async (t) => {
  await t.test('in configuration mode (isLiveMode=false), shows settings button', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, {
        onStartSession: () => {},
        isLiveMode: false
      })
    );

    assert.ok(html.includes('aria-label="Buka Pengaturan Landing"'), 'Config mode must have settings button');
  });

  await t.test('in live mode (isLiveMode=true), hides settings button', () => {
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, {
        onStartSession: () => {},
        isLiveMode: true
      })
    );

    assert.ok(!html.includes('aria-label="Buka Pengaturan Landing"'), 'Live mode MUST NOT have settings button');
  });
});
