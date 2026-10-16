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
const srcDir = path.resolve(projectRoot, 'src');

// Isolated temporary directory for bundled test component
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-app-flow-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve(
      { filter: /^(react|react-dom|framer-motion|lucide-react)/ },
      (args) => {
        return { path: import.meta.resolve(args.path), external: true };
      }
    );
  }
};

async function buildApp() {
  const outFile = path.join(tmpDir, 'App.mjs');
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'App.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

const { default: App } = await buildApp();

/**
 * Lightweight test harness simulating React component rendering with useState hooks.
 */
function createTestHarness(Component, props = {}) {
  const stateMap = new Map();
  let stateIndex = 0;

  function render(currentProps = props) {
    stateIndex = 0;
    const prevDispatcher =
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;

    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = {
      useState: (initial) => {
        const idx = stateIndex++;
        if (!stateMap.has(idx)) {
          stateMap.set(idx, typeof initial === 'function' ? initial() : initial);
        }
        const setState = (next) => {
          const current = stateMap.get(idx);
          const val = typeof next === 'function' ? next(current) : next;
          stateMap.set(idx, val);
        };
        return [stateMap.get(idx), setState];
      }
    };

    try {
      return Component(currentProps);
    } finally {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
        prevDispatcher;
    }
  }

  let vdom = render();

  return {
    get vdom() {
      return vdom;
    },
    render: () => {
      vdom = render();
      return vdom;
    },
    getActiveChild: () => {
      const children = Array.isArray(vdom.props.children)
        ? vdom.props.children
        : [vdom.props.children];
      return children.find(Boolean);
    },
    getStep: () => stateMap.get(0),
    getLayoutConfig: () => stateMap.get(1),
    getCapturedPhotos: () => stateMap.get(2),
    states: stateMap
  };
}

// ---------------------------------------------------------
// 1. App Component Initial State & Markup Structure
// ---------------------------------------------------------
test('App Component Initial State & Markup Structure', async (t) => {
  await t.test('initializes with LANDING step, null layout, and empty photos', () => {
    const harness = createTestHarness(App);
    assert.strictEqual(harness.getStep(), 'LANDING');
    assert.strictEqual(harness.getLayoutConfig(), null);
    assert.deepStrictEqual(harness.getCapturedPhotos(), []);
  });

  await t.test('renders top-level container with full viewport styling', () => {
    const harness = createTestHarness(App);
    assert.strictEqual(harness.vdom.type, 'div');
    assert.ok(
      harness.vdom.props.className.includes('w-full'),
      'container should include w-full'
    );
    assert.ok(
      harness.vdom.props.className.includes('min-h-screen'),
      'container should include min-h-screen'
    );
  });

  await t.test('renders LandingPage as the active initial child with onStartSession handler', () => {
    const harness = createTestHarness(App);
    const activeChild = harness.getActiveChild();
    assert.ok(activeChild, 'must have an active child component');
    assert.strictEqual(typeof activeChild.props.onStartSession, 'function');
  });

  await t.test('renders initial LandingPage tree to static markup without error', () => {
    const harness = createTestHarness(App);
    const html = renderToStaticMarkup(harness.vdom);
    assert.ok(html.includes('w-full min-h-screen'), 'should render root container');
    assert.ok(html.includes('Capture The Magic!'), 'should include magic headline in landing view');
    assert.ok(html.includes('Mulai Sekarang'), 'should include CTA button in landing view');
  });
});

// ---------------------------------------------------------
// 2. State Machine Forward Transitions & Data Handoff
// ---------------------------------------------------------
test('State Machine Forward Transitions & Data Handoff', async (t) => {
  await t.test('LANDING -> FRAME_PICKER transition via onStartSession', () => {
    const harness = createTestHarness(App);
    assert.strictEqual(harness.getStep(), 'LANDING');

    const landingChild = harness.getActiveChild();
    landingChild.props.onStartSession();
    harness.render();

    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');
    const framePickerChild = harness.getActiveChild();
    assert.ok(framePickerChild, 'FrameSelector must be active');
    assert.strictEqual(typeof framePickerChild.props.onConfirm, 'function');
    assert.strictEqual(typeof framePickerChild.props.onBack, 'function');
  });

  await t.test('FRAME_PICKER -> CAMERA transition and layoutConfig handoff via onConfirm', () => {
    const harness = createTestHarness(App);
    harness.getActiveChild().props.onStartSession();
    harness.render();

    const selectedConfig = {
      layoutType: 'STRIP_4',
      palette: { name: 'Pastel Pink', hex: '#FFE4E6', text: '#881337' },
      frameColor: '#FFE4E6'
    };

    const framePickerChild = harness.getActiveChild();
    framePickerChild.props.onConfirm(selectedConfig);
    harness.render();

    assert.strictEqual(harness.getStep(), 'CAMERA');
    assert.deepStrictEqual(harness.getLayoutConfig(), selectedConfig);

    const cameraChild = harness.getActiveChild();
    assert.ok(cameraChild, 'CameraSession must be active');
    assert.deepStrictEqual(cameraChild.props.layoutConfig, selectedConfig);
    assert.strictEqual(typeof cameraChild.props.onComplete, 'function');
    assert.strictEqual(typeof cameraChild.props.onCancel, 'function');
  });

  await t.test('CAMERA -> PREVIEW transition and photos handoff via onComplete', () => {
    const harness = createTestHarness(App);
    harness.getActiveChild().props.onStartSession();
    harness.render();

    const selectedConfig = {
      layoutType: 'GRID_2X2',
      palette: { name: 'Midnight Black', hex: '#1E1E24', text: '#FFFFFF' },
      frameColor: '#1E1E24'
    };
    harness.getActiveChild().props.onConfirm(selectedConfig);
    harness.render();

    const mockPhotos = [
      'data:image/jpeg;base64,frame1_data',
      'data:image/jpeg;base64,frame2_data',
      'data:image/jpeg;base64,frame3_data',
      'data:image/jpeg;base64,frame4_data'
    ];

    const cameraChild = harness.getActiveChild();
    cameraChild.props.onComplete(mockPhotos);
    harness.render();

    assert.strictEqual(harness.getStep(), 'PREVIEW');
    assert.deepStrictEqual(harness.getCapturedPhotos(), mockPhotos);

    const previewChild = harness.getActiveChild();
    assert.ok(previewChild, 'PreviewResult must be active');
    assert.deepStrictEqual(previewChild.props.photos, mockPhotos);
    assert.deepStrictEqual(previewChild.props.layoutConfig, selectedConfig);
    assert.strictEqual(typeof previewChild.props.onResetSession, 'function');
  });
});

// ---------------------------------------------------------
// 3. State Machine Backward Navigation & Cancellation
// ---------------------------------------------------------
test('State Machine Backward Navigation & Cancellation Transitions', async (t) => {
  await t.test('FRAME_PICKER -> LANDING transition via onBack', () => {
    const harness = createTestHarness(App);
    harness.getActiveChild().props.onStartSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');

    const framePickerChild = harness.getActiveChild();
    framePickerChild.props.onBack();
    harness.render();

    assert.strictEqual(harness.getStep(), 'LANDING');
    assert.strictEqual(typeof harness.getActiveChild().props.onStartSession, 'function');
  });

  await t.test('CAMERA -> FRAME_PICKER transition via onCancel preserves layoutConfig', () => {
    const harness = createTestHarness(App);
    harness.getActiveChild().props.onStartSession();
    harness.render();

    const chosenConfig = {
      layoutType: 'POLAROID_1',
      palette: { name: 'Mint Soft', hex: '#D1FAE5', text: '#064E3B' },
      frameColor: '#D1FAE5'
    };
    harness.getActiveChild().props.onConfirm(chosenConfig);
    harness.render();
    assert.strictEqual(harness.getStep(), 'CAMERA');

    const cameraChild = harness.getActiveChild();
    cameraChild.props.onCancel();
    harness.render();

    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');
    // layoutConfig is still stored from previous confirmation
    assert.deepStrictEqual(harness.getLayoutConfig(), chosenConfig);
  });
});

// ---------------------------------------------------------
// 4. Ephemeral State Purge & Session Reset Lifecycle
// ---------------------------------------------------------
test('Ephemeral State Purge & Session Reset Lifecycle', async (t) => {
  await t.test('purges volatile photo data, layoutConfig, and resets to LANDING step', () => {
    const harness = createTestHarness(App);

    // 1. Move LANDING -> FRAME_PICKER
    harness.getActiveChild().props.onStartSession();
    harness.render();

    // 2. Select layout
    const config = {
      layoutType: 'STRIP_3',
      palette: { name: 'Warm Cream', hex: '#FEF3C7', text: '#78350F' },
      frameColor: '#FEF3C7'
    };
    harness.getActiveChild().props.onConfirm(config);
    harness.render();

    // 3. Complete photo capture
    const sensitivePhotoPayload = [
      'data:image/jpeg;base64,camera_capture_raw_1',
      'data:image/jpeg;base64,camera_capture_raw_2',
      'data:image/jpeg;base64,camera_capture_raw_3'
    ];
    harness.getActiveChild().props.onComplete(sensitivePhotoPayload);
    harness.render();

    assert.strictEqual(harness.getStep(), 'PREVIEW');
    assert.strictEqual(harness.getCapturedPhotos().length, 3);
    assert.notStrictEqual(harness.getLayoutConfig(), null);

    // 4. Trigger reset
    const previewChild = harness.getActiveChild();
    previewChild.props.onResetSession();
    harness.render();

    // 5. Verify complete wipe of ephemeral state
    assert.strictEqual(
      harness.getStep(),
      'LANDING',
      'currentStep must be reset to LANDING'
    );
    assert.deepStrictEqual(
      harness.getCapturedPhotos(),
      [],
      'capturedPhotos array must be purged to empty array []'
    );
    assert.strictEqual(
      harness.getLayoutConfig(),
      null,
      'layoutConfig must be wiped to null'
    );

    // Verify LandingPage is rendered with no active traces of previous session
    const landingChild = harness.getActiveChild();
    assert.ok(landingChild, 'LandingPage is active again');
    assert.strictEqual(typeof landingChild.props.onStartSession, 'function');
  });
});

// ---------------------------------------------------------
// 5. Complete Multi-Cycle End-to-End Simulation
// ---------------------------------------------------------
test('Complete Multi-Cycle End-to-End State Machine Flow', async (t) => {
  await t.test('simulates back-and-forth navigation and multiple complete user sessions', () => {
    const harness = createTestHarness(App);

    // --- Cycle 1: Explore and abort ---
    assert.strictEqual(harness.getStep(), 'LANDING');

    harness.getActiveChild().props.onStartSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');

    // User backs out to landing
    harness.getActiveChild().props.onBack();
    harness.render();
    assert.strictEqual(harness.getStep(), 'LANDING');

    // Re-enter and choose STRIP_3
    harness.getActiveChild().props.onStartSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');

    harness.getActiveChild().props.onConfirm({
      layoutType: 'STRIP_3',
      frameColor: '#FFFFFF'
    });
    harness.render();
    assert.strictEqual(harness.getStep(), 'CAMERA');

    // User cancels camera session to change layout
    harness.getActiveChild().props.onCancel();
    harness.render();
    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');

    // Switch to GRID_2X2 and proceed
    const cycle1Config = {
      layoutType: 'GRID_2X2',
      frameColor: '#1E1E24'
    };
    harness.getActiveChild().props.onConfirm(cycle1Config);
    harness.render();
    assert.strictEqual(harness.getStep(), 'CAMERA');
    assert.deepStrictEqual(harness.getLayoutConfig(), cycle1Config);

    // Complete camera poses
    const cycle1Photos = ['photo_a', 'photo_b', 'photo_c', 'photo_d'];
    harness.getActiveChild().props.onComplete(cycle1Photos);
    harness.render();
    assert.strictEqual(harness.getStep(), 'PREVIEW');
    assert.deepStrictEqual(harness.getActiveChild().props.photos, cycle1Photos);

    // Finish session -> reset
    harness.getActiveChild().props.onResetSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'LANDING');
    assert.deepStrictEqual(harness.getCapturedPhotos(), []);
    assert.strictEqual(harness.getLayoutConfig(), null);

    // --- Cycle 2: Brand new session ---
    harness.getActiveChild().props.onStartSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'FRAME_PICKER');

    const cycle2Config = {
      layoutType: 'POLAROID_1',
      frameColor: '#D1FAE5'
    };
    harness.getActiveChild().props.onConfirm(cycle2Config);
    harness.render();
    assert.strictEqual(harness.getStep(), 'CAMERA');
    assert.deepStrictEqual(harness.getLayoutConfig(), cycle2Config);

    const cycle2Photos = ['polaroid_solo'];
    harness.getActiveChild().props.onComplete(cycle2Photos);
    harness.render();
    assert.strictEqual(harness.getStep(), 'PREVIEW');
    assert.deepStrictEqual(harness.getActiveChild().props.photos, cycle2Photos);
    assert.deepStrictEqual(harness.getActiveChild().props.layoutConfig, cycle2Config);

    // Final reset
    harness.getActiveChild().props.onResetSession();
    harness.render();
    assert.strictEqual(harness.getStep(), 'LANDING');
    assert.deepStrictEqual(harness.getCapturedPhotos(), []);
    assert.strictEqual(harness.getLayoutConfig(), null);
  });
});
