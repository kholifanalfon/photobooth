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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-session-mgr-test-'));

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

const { default: SessionManagerModal } = await buildAndImportComponent('SessionManagerModal');

test('SessionManagerModal - Lifecycle, UI Markup & 5 Core Admin Actions', async (t) => {
  await t.test('returns null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionManagerModal, {
        isOpen: false,
        onClose: () => {}
      })
    );
    assert.equal(html, '', 'Modal should not render markup when isOpen is false');
  });

  await t.test('renders modal header, search, filter and storage indicator when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionManagerModal, {
        isOpen: true,
        onClose: () => {}
      })
    );

    assert.ok(html.includes('Kelola Sesi Foto'), 'Must render title Kelola Sesi Foto');
    assert.ok(html.includes('Cari ID sesi atau nama file...'), 'Must render search input');
    assert.ok(html.includes('Semua') && html.includes('Hari Ini'), 'Must render filter period buttons');
    assert.ok(html.includes('server/uploads/photos/'), 'Must render functional storage folder badge');
    assert.ok(html.includes('aria-label="Tutup Kelola Sesi"'), 'Must render close button');
  });

  await t.test('contains all 5 core administrative capability buttons in structure', () => {
    const fileContent = fs.readFileSync(path.join(componentsDir, 'SessionManagerModal.jsx'), 'utf8');
    
    // 1. Preview Ulang
    assert.ok(fileContent.includes('Preview Ulang Resolusi Penuh'), 'Must support Preview Ulang');
    assert.ok(fileContent.includes('setPreviewPhoto'), 'Must set state for lightbox preview');
    
    // 2. Print Ulang
    assert.ok(fileContent.includes('handleReprint'), 'Must handle re-print');
    assert.ok(fileContent.includes('/api/print'), 'Must dispatch to /api/print');
    
    // 3. Download Ulang
    assert.ok(fileContent.includes('handleDownload'), 'Must handle direct photo download');
    
    // 4. Kirim Link QR Ulang
    assert.ok(fileContent.includes('handleOpenQr'), 'Must handle opening QR link dialog');
    assert.ok(fileContent.includes('qr-generate'), 'Must support QR code generation');
    
    // 5. Hapus Foto
    assert.ok(fileContent.includes('handleDeleteSession'), 'Must handle permanent deletion');
    assert.ok(fileContent.includes('DELETE'), 'Must call DELETE API endpoint');
    assert.ok(fileContent.includes('Hapus Sesi &amp; File Foto?') || fileContent.includes('Hapus Sesi & File Foto?'), 'Must contain delete confirmation dialog');
  });
});
