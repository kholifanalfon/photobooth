import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const appFile = path.resolve(projectRoot, 'src/App.jsx');

test('App.jsx - Live Mode & /open-lock Route Guard and DOM Isolation', async (t) => {
  const content = fs.readFileSync(appFile, 'utf8');

  await t.test('detects /open-lock on initial load and treats it as Live Mode', () => {
    assert.match(content, /pathname === '\/live' \|\| pathname === '\/kiosk' \|\| pathname === '\/open-lock'/);
  });

  await t.test('enforces /open-lock route guard when in live mode and not unlocked', () => {
    assert.match(content, /const isCurrentlyLive = Boolean\(isLiveMode \|\| landingConfig\?\.isLive \|\| currentPath === '\/open-lock'\);/);
    assert.match(content, /if \(!isBoothUnlocked\) {\s*if \(currentPath !== '\/open-lock'\) {\s*navigateTo\('\/open-lock', true\);/);
  });

  await t.test('redirects from /open-lock to /live when unlocked', () => {
    assert.match(content, /if \(currentPath === '\/open-lock'\) {\s*navigateTo\('\/live', true\);/);
  });

  await t.test('implements strict DOM isolation preventing bypass by element deletion', () => {
    // Verifies that photobooth flow components (LandingPage, FrameSelector, etc.)
    // and admin modals are NOT rendered in DOM when locked in live mode or /open-lock
    assert.match(
      content,
      /\{\(\(isLiveMode \|\| landingConfig\?\.isLive \|\| currentPath === '\/open-lock'\) && !isBoothUnlocked && currentStep !== 'DOWNLOAD'\) \? \(\s*<AdminLockScreen/
    );
    assert.match(content, /<AdminLockScreen\s+onUnlock=\{\(\) => \{\s*adminLastActivityRef\.current = touchAdminSession\(\);\s*setIsBoothUnlocked\(true\);\s*navigateTo\('\/live', true\);/);
  });

  await t.test('navigates to /open-lock upon session expiry or Shift+Escape shortcut', () => {
    assert.match(content, /lockIfExpired = \(\) => \{\s*if \(isAdminSessionExpired\(adminLastActivityRef\.current\)\) \{\s*adminLastActivityRef\.current = 0;\s*clearAdminSession\(\);\s*setIsBoothUnlocked\(false\);\s*navigateTo\('\/open-lock', true\);/);
    assert.match(content, /if \(e\.shiftKey && e\.key === 'Escape'\) \{\s*if \(isLiveMode \|\| landingConfig\?\.isLive\) \{\s*adminLastActivityRef\.current = 0;\s*clearAdminSession\(\);\s*setIsBoothUnlocked\(false\);\s*navigateTo\('\/open-lock', true\);/);
  });
});
