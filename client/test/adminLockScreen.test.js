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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-admin-lock-test-'));

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
  const module = await import(`file://${outFile}`);
  return module.default;
}

test('AdminLockScreen - Markup, Security and Accessibility', async (t) => {
  const AdminLockScreen = await buildAndImportComponent('AdminLockScreen');

  await t.test('renders modal dialog with lock title, keypad, and unlock CTA', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminLockScreen, {
        onUnlock: () => {},
        expectedCode: '9999'
      })
    );

    assert.ok(html.includes('Photobooth Terkunci'), 'Must render Photobooth Terkunci title');
    assert.ok(html.includes('Mode Live Kiosk'), 'Must indicate live kiosk mode');
    assert.ok(html.includes('Buka Kunci Photobooth'), 'Must have unlock CTA button');
    assert.ok(html.includes('placeholder="KODE ADMIN"'), 'Must have admin code input');

    // Check digits 0 through 9 on touch keypad
    for (let i = 0; i <= 9; i++) {
      assert.ok(html.includes(`>${i}<`), `Must contain keypad button for ${i}`);
    }
  });
});
