import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(clientDir, 'public');

test('PWA & Offline Readiness Contract', async (t) => {
  await t.test('manifest.json exists and contains required PWA fields', () => {
    const manifestPath = path.join(publicDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public directory');

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(content.short_name, 'Photobooth');
    assert.strictEqual(content.start_url, '/');
    assert.strictEqual(content.display, 'standalone');
    assert.ok(content.theme_color, 'Must define theme_color');
    assert.ok(content.background_color, 'Must define background_color');
    assert.ok(Array.isArray(content.icons) && content.icons.length >= 2, 'Must provide multiple icon sizes');

    // Verify icon files physically exist
    for (const icon of content.icons) {
      if (icon.src.startsWith('/icons/')) {
        const iconPath = path.join(publicDir, icon.src);
        assert.ok(fs.existsSync(iconPath), `Icon file ${icon.src} must exist physically`);
      }
    }
  });

  await t.test('sw.js Service Worker exists and implements offline fallback', () => {
    const swPath = path.join(publicDir, 'sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');

    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('addEventListener(\'install\'') || swContent.includes('addEventListener("install"'), 'Must handle install event');
    assert.ok(swContent.includes('addEventListener(\'activate\'') || swContent.includes('addEventListener("activate"'), 'Must handle activate event');
    assert.ok(swContent.includes('addEventListener(\'fetch\'') || swContent.includes('addEventListener("fetch"'), 'Must handle fetch event');
    assert.ok(swContent.includes('skipWaiting'), 'Must claim immediately via skipWaiting');
    assert.ok(swContent.includes('clients.claim'), 'Must claim clients immediately');
    assert.ok(swContent.includes('navigate'), 'Must handle offline SPA navigate requests');
  });

  await t.test('index.html contains PWA meta tags and manifest links', () => {
    const indexPath = path.join(clientDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    assert.ok(indexContent.includes('rel="manifest"'), 'Must include manifest link');
    assert.ok(indexContent.includes('name="theme-color"'), 'Must include theme-color meta tag');
    assert.ok(indexContent.includes('apple-mobile-web-app-capable'), 'Must support iOS standalone mode');
  });
});
