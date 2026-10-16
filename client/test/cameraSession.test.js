import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import { audioFx } from '../src/utils/audioEffects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.resolve(projectRoot, 'src/components');

// Isolated temporary directory for bundled test component
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-camerasession-test-'));

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

const { default: CameraSession } = await buildAndImportComponent('CameraSession');

function mockMediaDevices(mockImpl) {
  const orig = Object.getOwnPropertyDescriptor(globalThis.navigator, 'mediaDevices');
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: mockImpl,
    configurable: true,
    writable: true
  });
  return () => {
    if (orig) {
      Object.defineProperty(globalThis.navigator, 'mediaDevices', orig);
    } else {
      delete globalThis.navigator.mediaDevices;
    }
  };
}

// Helper to simulate component render with controllable useState and useRef
function createHarness(Component, props) {
  const stateMap = new Map();
  const refMap = new Map();
  const effectCleanups = [];
  let stateIndex = 0;
  let refIndex = 0;

  function render() {
    stateIndex = 0;
    refIndex = 0;
    const prevDispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = {
      useRef: (initial) => {
        const idx = refIndex++;
        if (!refMap.has(idx)) {
          refMap.set(idx, { current: initial });
        }
        return refMap.get(idx);
      },
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
      },
      useEffect: (effect) => {
        if (effectCleanups.length === 0) {
          const cleanup = effect();
          if (typeof cleanup === 'function') {
            effectCleanups.push(cleanup);
          }
        }
      }
    };

    try {
      return Component(props);
    } finally {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = prevDispatcher;
    }
  }

  const vdom = render();
  return {
    vdom,
    render,
    refs: refMap,
    states: stateMap,
    unmount: () => {
      effectCleanups.forEach((cleanup) => cleanup());
      effectCleanups.length = 0;
    }
  };
}

test('CameraSession Markup & Configuration Resolution', async (t) => {
  await t.test('resolves totalPhotos correctly across layoutConfig variants', () => {
    // 1. Explicit photoCount in layoutConfig
    const htmlWithExplicit = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { photoCount: 4 } })
    );
    assert.ok(htmlWithExplicit.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 4'));

    // 2. Resolved via layoutType: STRIP_4 (4 poses)
    const htmlWithStrip4 = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { layoutType: 'STRIP_4' } })
    );
    assert.ok(htmlWithStrip4.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 4'));

    // 3. Resolved via layoutType: GRID_2X2 (4 poses)
    const htmlWithGrid = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { layoutType: 'GRID_2X2' } })
    );
    assert.ok(htmlWithGrid.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 4'));

    // 4. Resolved via layoutType: POLAROID_1 (1 pose)
    const htmlWithPolaroid = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { layoutType: 'POLAROID_1' } })
    );
    assert.ok(htmlWithPolaroid.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 1'));

    // 5. Default fallback to 3 photos when missing or empty
    const htmlDefault = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: {} })
    );
    assert.ok(htmlDefault.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 3'));

    const htmlNull = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: null })
    );
    assert.ok(htmlNull.includes('Pose ke <span class=\"text-pink-400 text-base\">1</span> dari 3'));
  });

  await t.test('renders video viewfinder with horizontal mirror css transformation', () => {
    const html = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { photoCount: 3 } })
    );

    assert.ok(html.includes('<video'), 'Must render video element');
    assert.ok(html.includes('scale-x-[-1]'), 'Video must have scale-x-[-1] class to mirror horizontally');
    assert.ok(html.includes('autoplay'), 'Video must have autoplay');
    assert.ok(html.includes('playsinline'), 'Video must have playsinline');
    assert.ok(html.includes('muted'), 'Video must be muted');
  });

  await t.test('renders Batalkan Sesi and Ambil Gambar controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(CameraSession, { layoutConfig: { photoCount: 3 } })
    );

    assert.ok(html.includes('Batalkan Sesi'), 'Must render Batalkan Sesi button');
    assert.ok(html.includes('Ambil Gambar'), 'Must render Ambil Gambar button');
    assert.ok(html.includes('lucide-camera'), 'Must render Camera icon in trigger button');
  });
});

test('CameraSession Error Handling', async (t) => {
  await t.test('renders error state and invokes onCancel when Kembali ke Menu is clicked', async () => {
    let cancelCalled = false;

    // Simulate rejection during camera acquisition
    const restoreNavigator = mockMediaDevices({
      getUserMedia: async () => {
        throw new Error('Permission denied');
      }
    });

    try {
      const harness = createHarness(CameraSession, {
        layoutConfig: { photoCount: 3 },
        onCancel: () => { cancelCalled = true; }
      });

      // Allow async startCamera to reject and set error state
      await new Promise((resolve) => setTimeout(resolve, 20));

      const vdom = harness.render();
      const html = renderToStaticMarkup(vdom);

      assert.ok(html.includes('Gagal mengakses kamera'), 'Must display camera error message');
      assert.ok(html.includes('Kembali ke Menu'), 'Must render Kembali ke Menu button');

      // Click the Kembali ke Menu button
      const backButton = vdom.props.children[1];
      assert.strictEqual(typeof backButton.props.onClick, 'function');
      backButton.props.onClick();

      assert.strictEqual(cancelCalled, true, 'Clicking Kembali ke Menu must invoke onCancel');
    } finally {
      restoreNavigator();
    }
  });
});

test('CameraSession WebRTC Camera Feed & Track Lifecycle', async (t) => {
  await t.test('initializes getUserMedia with ideal 1080p, triggers video play, and stops tracks on unmount', async () => {
    let tracksStopped = 0;
    const mockTrack = {
      stop: () => { tracksStopped += 1; }
    };
    const mockStream = {
      getTracks: () => [mockTrack, mockTrack]
    };

    let requestedConstraints = null;
    let videoPlayCalled = false;

    const restoreNavigator = mockMediaDevices({
      getUserMedia: async (constraints) => {
        requestedConstraints = constraints;
        return mockStream;
      }
    });

    try {
      const harness = createHarness(CameraSession, {
        layoutConfig: { photoCount: 3 },
        onCancel: () => {}
      });

      // Mock videoRef with play() method to verify video playback defense
      const videoRef = harness.refs.get(0);
      videoRef.current = {
        play: async () => {
          videoPlayCalled = true;
        }
      };

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Check stream was acquired with correct constraints
      assert.ok(requestedConstraints, 'getUserMedia should be called');
      assert.strictEqual(requestedConstraints.audio, false);
      assert.strictEqual(requestedConstraints.video.facingMode, 'user');
      assert.strictEqual(requestedConstraints.video.width.ideal, 1920);
      assert.strictEqual(requestedConstraints.video.height.ideal, 1080);

      // Verify streamRef holds the active stream and video play was attempted
      const streamRef = harness.refs.get(1); // streamRef is second ref
      assert.strictEqual(streamRef.current, mockStream);
      assert.strictEqual(videoPlayCalled, true, 'video.play() should be called defensively');

      // Unmount should stop all tracks
      harness.unmount();
      assert.strictEqual(tracksStopped, 2, 'Unmounting must stop all media stream tracks');
    } finally {
      restoreNavigator();
    }
  });
});

test('CameraSession Countdown, Shutter, and Multi-Pose Capture Loop', async (t) => {
  await t.test('executes 3s countdown sequence with audio beeps and captures photo', async () => {
    const beeps = [];
    let shutterSoundPlayed = false;

    const origCountdownBeep = audioFx.playCountdownBeep;
    const origShutterSound = audioFx.playShutterSound;

    audioFx.playCountdownBeep = (isFinal) => { beeps.push(isFinal); };
    audioFx.playShutterSound = () => { shutterSoundPlayed = true; };

    const mockStream = {
      getTracks: () => [{ stop: () => {} }]
    };
    const restoreNavigator = mockMediaDevices({
      getUserMedia: async () => mockStream
    });

    // Mock document.createElement for canvas capture
    let translateArgs = null;
    let scaleArgs = null;
    let drawImageCalled = false;

    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              translate: (x, y) => { translateArgs = [x, y]; },
              scale: (x, y) => { scaleArgs = [x, y]; },
              drawImage: () => { drawImageCalled = true; }
            }),
            toDataURL: (format, quality) => `data:${format};base64,mock-photo`
          };
        }
        return {};
      }
    };

    let completedPhotos = null;

    try {
      const harness = createHarness(CameraSession, {
        layoutConfig: { photoCount: 1 }, // 1 pose for single capture completion
        onComplete: (photos) => { completedPhotos = photos; },
        onCancel: () => {}
      });

      // Video ref mock
      const videoRef = harness.refs.get(0);
      videoRef.current = {
        videoWidth: 1920,
        videoHeight: 1080
      };

      // Bottom controls container -> button is first child
      const vdom = harness.vdom;
      const bottomControls = vdom.props.children[3];
      const captureButton = bottomControls.props.children;

      assert.strictEqual(typeof captureButton.props.onClick, 'function');

      // Trigger capture sequence
      captureButton.props.onClick();

      // State index 2 is countdown (state 0: currentPose, 1: capturedPhotos, 2: countdown, 3: isFlashing, 4: cameraError)
      assert.strictEqual(harness.states.get(2), 3, 'Countdown starts at 3');
      assert.strictEqual(beeps.length, 1);
      assert.strictEqual(beeps[0], false, 'Initial countdown beep should not be final');

      // Advance interval ticks (countdown 2, 1, 0)
      await new Promise((resolve) => setTimeout(resolve, 3600));

      assert.strictEqual(shutterSoundPlayed, true, 'Shutter sound must play upon countdown 0');
      assert.ok(beeps.includes(true), 'Final countdown beep (isFinal=true) must play');
      assert.ok(drawImageCalled, 'Canvas drawImage must be called with video element');
      assert.deepStrictEqual(translateArgs, [1920, 0], 'Canvas must translate by width for mirror');
      assert.deepStrictEqual(scaleArgs, [-1, 1], 'Canvas must scale(-1, 1) to mirror horizontally');

      assert.ok(completedPhotos, 'onComplete callback must be invoked with photos array');
      assert.strictEqual(completedPhotos.length, 1);
      assert.strictEqual(completedPhotos[0], 'data:image/jpeg;base64,mock-photo');

      harness.unmount();
    } finally {
      audioFx.playCountdownBeep = origCountdownBeep;
      audioFx.playShutterSound = origShutterSound;
      global.document = originalDocument;
      restoreNavigator();
    }
  });

  await t.test('supports configurable countdown timer duration via prop and layoutConfig', async () => {
    const mockStream = { getTracks: () => [{ stop: () => {} }] };
    const restoreNavigator = mockMediaDevices({ getUserMedia: async () => mockStream });

    try {
      // 1. Configured via countdownDuration prop = 5
      const harnessProp = createHarness(CameraSession, {
        countdownDuration: 5,
        layoutConfig: { photoCount: 1 }
      });
      const buttonProp = harnessProp.vdom.props.children[3].props.children;
      buttonProp.props.onClick();
      assert.strictEqual(harnessProp.states.get(2), 5, 'Countdown must initialize to 5s from prop');
      harnessProp.unmount();

      // 2. Configured via layoutConfig.countdownDuration = 2
      const harnessConfig = createHarness(CameraSession, {
        countdownDuration: 5,
        layoutConfig: { countdownDuration: 2, photoCount: 1 }
      });
      const buttonConfig = harnessConfig.vdom.props.children[3].props.children;
      buttonConfig.props.onClick();
      assert.strictEqual(harnessConfig.states.get(2), 2, 'Countdown must prioritize layoutConfig.countdownDuration');
      harnessConfig.unmount();
    } finally {
      restoreNavigator();
    }
  });

  await t.test('multi-pose capture loop advances currentPose until totalPhotos is reached', async () => {
    let completedPhotos = null;

    const mockStream = {
      getTracks: () => [{ stop: () => {} }]
    };
    const restoreNavigator = mockMediaDevices({
      getUserMedia: async () => mockStream
    });

    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              translate: () => {},
              scale: () => {},
              drawImage: () => {}
            }),
            toDataURL: (format) => `data:${format};base64,pose-photo`
          };
        }
        return {};
      }
    };

    try {
      // Using countdownDuration = 1 for fast test iteration
      const harness = createHarness(CameraSession, {
        countdownDuration: 1,
        layoutConfig: { photoCount: 2 }, // 2 poses
        onComplete: (photos) => { completedPhotos = photos; },
        onCancel: () => {}
      });

      const videoRef = harness.refs.get(0);
      videoRef.current = { videoWidth: 1280, videoHeight: 720 };

      // Trigger pose 1
      let currentVdom = harness.render();
      let captureButton = currentVdom.props.children[3].props.children;
      captureButton.props.onClick();

      // Wait for pose 1 to finish (1s timer + 300ms shutter)
      await new Promise((resolve) => setTimeout(resolve, 1450));

      // First pose done, completedPhotos should still be null
      assert.strictEqual(completedPhotos, null, 'Should not complete after pose 1 of 2');
      assert.strictEqual(harness.states.get(0), 1, 'currentPose should now be 1 (0-indexed)');
      assert.strictEqual(harness.states.get(1).length, 1, 'capturedPhotos should have 1 photo');

      // Pose 2 trigger
      currentVdom = harness.render();
      captureButton = currentVdom.props.children[3].props.children;
      assert.strictEqual(captureButton.props.disabled, false, 'Capture button should be enabled for next pose');
      captureButton.props.onClick();

      // Wait for pose 2 to finish
      await new Promise((resolve) => setTimeout(resolve, 1450));

      assert.ok(completedPhotos, 'Should call onComplete after 2nd pose is captured');
      assert.strictEqual(completedPhotos.length, 2);
      assert.strictEqual(harness.states.get(1).length, 2);

      harness.unmount();
    } finally {
      global.document = originalDocument;
      restoreNavigator();
    }
  });

  await t.test('cancellation clears timers, purges volatile memory, and stops camera stream', async () => {
    let cancelCalled = false;
    let trackStopped = false;
    let confirmPromptShown = false;

    const mockStream = {
      getTracks: () => [
        { stop: () => { trackStopped = true; } }
      ]
    };

    const restoreNavigator = mockMediaDevices({
      getUserMedia: async () => mockStream
    });

    const originalWindow = global.window;
    global.window = {
      confirm: (msg) => {
        confirmPromptShown = true;
        return true;
      }
    };

    const harness = createHarness(CameraSession, {
      layoutConfig: { photoCount: 3 },
      onCancel: () => { cancelCalled = true; }
    });

    const streamRef = harness.refs.get(1);
    streamRef.current = mockStream;

    // Simulate 1 captured photo in volatile memory
    const capturedPhotosRef = harness.refs.get(4);
    capturedPhotosRef.current = ['data:image/jpeg;base64,volatile-frame'];
    harness.states.set(1, ['data:image/jpeg;base64,volatile-frame']);

    // Trigger Batalkan Sesi
    const header = harness.vdom.props.children[1];
    const cancelButton = header.props.children[0];
    assert.strictEqual(typeof cancelButton.props.onClick, 'function');

    cancelButton.props.onClick();

    assert.strictEqual(confirmPromptShown, true, 'Confirmation prompt must display when volatile frames exist');
    assert.strictEqual(cancelCalled, true, 'onCancel must be invoked');
    assert.strictEqual(trackStopped, true, 'Active camera stream tracks must be stopped');
    assert.strictEqual(streamRef.current, null, 'streamRef must be cleared');
    assert.deepStrictEqual(capturedPhotosRef.current, [], 'Volatile photos ref must be purged on cancel');
    assert.deepStrictEqual(harness.states.get(1), [], 'Captured photos state must be purged on cancel');

    global.window = originalWindow;
    restoreNavigator();
    harness.unmount();
  });
});
