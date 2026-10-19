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

// Isolated temporary directory for bundled test components
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-preview-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve(
      { filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/utils\/)/ },
      (args) => {
        const resolved = args.path.startsWith('.')
          ? 'file://' + path.resolve(componentsDir, args.path)
          : import.meta.resolve(args.path);
        return { path: resolved, external: true };
      }
    );
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

const { default: QrModal } = await buildAndImportComponent('QrModal');
const { default: ResetConfirmModal } = await buildAndImportComponent('ResetConfirmModal');
const { default: PreviewResult, resolveApiUrl } = await buildAndImportComponent('PreviewResult');

// Test Harness to simulate component rendering with controllable hooks
function createTestHarness(Component, props) {
  const stateMap = new Map();
  const refMap = new Map();
  const effectCleanups = new Map();
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let isMounted = false;

  function render(currentProps = props) {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    const prevDispatcher =
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;

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
        const idx = effectIndex++;
        if (!isMounted) {
          const cleanup = effect();
          if (typeof cleanup === 'function') {
            effectCleanups.set(idx, cleanup);
          }
        }
      }
    };

    try {
      return Component(currentProps);
    } finally {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
        prevDispatcher;
    }
  }

  const vdom = render();
  isMounted = true;

  return {
    vdom,
    render,
    refs: refMap,
    states: stateMap,
    unmount: () => {
      for (const cleanup of effectCleanups.values()) {
        cleanup();
      }
      effectCleanups.clear();
    }
  };
}

// ---------------------------------------------------------
// 1. resolveApiUrl Unit Tests
// ---------------------------------------------------------
test('resolveApiUrl - Configuration and Fallback Resolution', async (t) => {
  await t.test('resolves absolute URL with provided custom base', () => {
    const url = resolveApiUrl('/api/photos/upload', 'http://192.168.1.100:5000');
    assert.strictEqual(url, 'http://192.168.1.100:5000/api/photos/upload');
  });

  await t.test('strips trailing slashes from custom base URL', () => {
    const url = resolveApiUrl('/api/print', 'http://kiosk-server.local:5000///');
    assert.strictEqual(url, 'http://kiosk-server.local:5000/api/print');
  });

  await t.test('handles paths without leading slash properly', () => {
    const url = resolveApiUrl('api/sessions/sess_123', 'http://localhost:5000');
    assert.strictEqual(url, 'http://localhost:5000/api/sessions/sess_123');
  });

  await t.test('returns relative path when custom base is empty string for proxied setups', () => {
    const url = resolveApiUrl('/api/photos/upload', '');
    assert.strictEqual(url, '/api/photos/upload');
  });

  await t.test('falls back to default http://localhost:5000 when base is undefined', () => {
    const url = resolveApiUrl('/api/print', undefined);
    assert.ok(url.endsWith('/api/print'));
    assert.ok(url.startsWith('http://localhost:5000') || url.startsWith('/api'));
  });

  await t.test('safely handles undefined, null, non-string, or empty paths without throwing', () => {
    assert.strictEqual(resolveApiUrl(undefined), '');
    assert.strictEqual(resolveApiUrl(null), '');
    assert.strictEqual(resolveApiUrl(''), '');
    assert.strictEqual(resolveApiUrl(12345), '');
  });

  await t.test('preserves absolute http/https/blob/data URLs', () => {
    assert.strictEqual(resolveApiUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
    assert.strictEqual(resolveApiUrl('blob:http://localhost:5125/uuid'), 'blob:http://localhost:5125/uuid');
    assert.strictEqual(resolveApiUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
  });
});

// ---------------------------------------------------------
// 2. QrModal Component Tests
// ---------------------------------------------------------
test('QrModal - Markup, Accessibility, and State Rendering', async (t) => {
  await t.test('returns empty markup when isOpen is false under AnimatePresence', () => {
    const html = renderToStaticMarkup(
      React.createElement(QrModal, { isOpen: false, onClose: () => {} })
    );
    assert.strictEqual(html, '');
  });

  await t.test('renders modal with dialog role and accessibility attributes when open', () => {
    const html = renderToStaticMarkup(
      React.createElement(QrModal, {
        isOpen: true,
        onClose: () => {},
        qrCodeDataUri: null,
        downloadUrl: null
      })
    );

    assert.ok(html.includes('role=\"dialog\"'), 'Modal container must have dialog role');
    assert.ok(html.includes('aria-modal=\"true\"'), 'Modal must have aria-modal=\"true\"');
    assert.ok(html.includes('aria-labelledby=\"qr-modal-title\"'), 'Modal must link title');
    assert.ok(html.includes('id=\"qr-modal-title\"'), 'Heading must have title id');
    assert.ok(html.includes('Scan QR Code'), 'Must render title text');
    assert.ok(html.includes('aria-label=\"Tutup\"'), 'Close button must have descriptive label');
    assert.ok(html.includes('Membuat QR...'), 'Must render loading placeholder when no QR yet');
  });

  await t.test('renders QR image when qrCodeDataUri is provided', () => {
    const testQrData = 'data:image/png;base64,mockQrCodeBytes';
    const html = renderToStaticMarkup(
      React.createElement(QrModal, {
        isOpen: true,
        onClose: () => {},
        qrCodeDataUri: testQrData,
        downloadUrl: 'http://localhost:5000/uploads/photo_123.jpg'
      })
    );

    assert.ok(html.includes(`src=\"${testQrData}\"`), 'Must render img with qrCodeDataUri');
    assert.ok(html.includes('alt=\"QR Code Download\"'), 'QR img must have descriptive alt');
    assert.ok(
      html.includes('href=\"http://localhost:5000/uploads/photo_123.jpg\"'),
      'Must render direct download link'
    );
    assert.ok(html.includes('target=\"_blank\"'), 'Download link must open in new tab');
    assert.ok(html.includes('rel=\"noreferrer\"'), 'Download link must include rel=\"noreferrer\"');
    assert.ok(html.includes('Buka Link Langsung'), 'Must render link label');
  });

  await t.test('clicking close button and backdrop invokes onClose callback', () => {
    let closeCount = 0;
    const harness = createTestHarness(QrModal, {
      isOpen: true,
      onClose: () => {
        closeCount++;
      }
    });

    const backdrop = harness.vdom.props.children || harness.vdom;
    assert.strictEqual(typeof backdrop.props.onClick, 'function');
    backdrop.props.onClick();
    assert.strictEqual(closeCount, 1, 'Backdrop click must invoke onClose');

    const modalContent = backdrop.props.children;
    const closeButton = modalContent.props.children[0];
    assert.strictEqual(typeof closeButton.props.onClick, 'function');
    closeButton.props.onClick();
    assert.strictEqual(closeCount, 2, 'Close button click must invoke onClose');
  });

  await t.test('registers Escape key listener on window and unregisters on unmount', () => {
    let closedWithEsc = false;
    let registeredHandler = null;

    const mockWindow = {
      addEventListener: (type, handler) => {
        if (type === 'keydown') registeredHandler = handler;
      },
      removeEventListener: (type, handler) => {
        if (type === 'keydown' && registeredHandler === handler) {
          registeredHandler = null;
        }
      }
    };

    const originalWindow = global.window;
    global.window = mockWindow;

    try {
      const harness = createTestHarness(QrModal, {
        isOpen: true,
        onClose: () => {
          closedWithEsc = true;
        }
      });

      assert.strictEqual(typeof registeredHandler, 'function', 'Must register keydown handler');

      // Trigger Escape key
      registeredHandler({ key: 'Escape' });
      assert.strictEqual(closedWithEsc, true, 'Escape key must trigger onClose');

      // Other keys should not trigger close
      closedWithEsc = false;
      registeredHandler({ key: 'Enter' });
      assert.strictEqual(closedWithEsc, false, 'Non-Escape key must not trigger onClose');

      // Unmount
      harness.unmount();
      assert.strictEqual(registeredHandler, null, 'Must unregister keydown handler on unmount');
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });
});

// ---------------------------------------------------------
// 3. ResetConfirmModal Component Tests
// ---------------------------------------------------------
test('ResetConfirmModal - Markup, Accessibility, and Actions', async (t) => {
  await t.test('returns empty markup when isOpen is false under AnimatePresence', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResetConfirmModal, {
        isOpen: false,
        onCancel: () => {},
        onConfirm: () => {}
      })
    );
    assert.strictEqual(html, '');
  });

  await t.test('renders modal with alertdialog role and warning contents when open', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResetConfirmModal, {
        isOpen: true,
        onCancel: () => {},
        onConfirm: () => {}
      })
    );

    assert.ok(html.includes('role=\"alertdialog\"'), 'Must have alertdialog role');
    assert.ok(html.includes('aria-modal=\"true\"'), 'Must have aria-modal=\"true\"');
    assert.ok(html.includes('aria-labelledby=\"reset-modal-title\"'), 'Must link title id');
    assert.ok(html.includes('aria-describedby=\"reset-modal-desc\"'), 'Must link description id');
    assert.ok(html.includes('Mulai Sesi Baru?'), 'Must render modal title');
    assert.ok(
      html.includes('tersimpan dengan aman'),
      'Must inform visitor that photos are safely saved'
    );
    assert.ok(html.includes('Kembali') || html.includes('Batal'), 'Must render cancel/back button');
    assert.ok(
      html.includes('Ya, Mulai Sesi Baru'),
      'Must render confirm button'
    );
    assert.ok(
      html.includes('lucide-rotate-ccw'),
      'Must render rotate/reset icon'
    );
  });

  await t.test('invokes onCancel and onConfirm callbacks on button clicks', () => {
    let cancelCalled = false;
    let confirmCalled = false;

    const harness = createTestHarness(ResetConfirmModal, {
      isOpen: true,
      onCancel: () => {
        cancelCalled = true;
      },
      onConfirm: () => {
        confirmCalled = true;
      }
    });

    const backdrop = harness.vdom.props.children || harness.vdom;
    const modalContent = backdrop.props.children;
    const buttonGroup = modalContent.props.children[3];
    const cancelButton = buttonGroup.props.children[0];
    const confirmButton = buttonGroup.props.children[1];

    assert.strictEqual(typeof cancelButton.props.onClick, 'function');
    cancelButton.props.onClick();
    assert.strictEqual(cancelCalled, true, 'Cancel button must invoke onCancel');

    assert.strictEqual(typeof confirmButton.props.onClick, 'function');
    confirmButton.props.onClick();
    assert.strictEqual(confirmCalled, true, 'Confirm button must invoke onConfirm');
  });

  await t.test('registers Escape key listener on window and dismisses via onCancel', () => {
    let cancelCalled = false;
    let registeredHandler = null;

    const mockWindow = {
      addEventListener: (type, handler) => {
        if (type === 'keydown') registeredHandler = handler;
      },
      removeEventListener: (type, handler) => {
        if (type === 'keydown' && registeredHandler === handler) {
          registeredHandler = null;
        }
      }
    };

    const originalWindow = global.window;
    global.window = mockWindow;

    try {
      const harness = createTestHarness(ResetConfirmModal, {
        isOpen: true,
        onCancel: () => {
          cancelCalled = true;
        },
        onConfirm: () => {}
      });

      assert.strictEqual(typeof registeredHandler, 'function');
      registeredHandler({ key: 'Escape' });
      assert.strictEqual(cancelCalled, true, 'Escape must invoke onCancel');

      harness.unmount();
      assert.strictEqual(registeredHandler, null, 'Must unregister listener on unmount');
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });
});

// ---------------------------------------------------------
// 4. PreviewResult Component Tests
// ---------------------------------------------------------
test('PreviewResult - Markup and Structure', async (t) => {
  await t.test('renders heading, preview card, and action buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        onResetSession: () => {},
        initialCompositeUrl: 'data:image/jpeg;base64,mockPreviewBytes'
      })
    );

    assert.ok(html.includes('Hasil Fotomu Siap! 🎉'), 'Must render celebration header');
    assert.ok(html.includes('Print Foto'), 'Must render print button');
    assert.ok(html.includes('Download (QR)'), 'Must render QR download button');
    assert.ok(html.includes('Mulai Sesi Baru'), 'Must render reset button');
    assert.ok(html.includes('data:image/jpeg;base64,mockPreviewBytes'), 'Must display composite image');
  });

  await t.test('renders placeholder message and disables Print & Download buttons when composite is not ready', () => {
    const html = renderToStaticMarkup(
      React.createElement(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        onResetSession: () => {},
        initialCompositeUrl: null
      })
    );

    assert.ok(html.includes('Merender komposit...'), 'Must render composite loading text');

    // Both Print and Download buttons must have disabled attribute
    const harness = createTestHarness(PreviewResult, {
      photos: [],
      layoutConfig: { layoutType: 'STRIP_3' },
      onResetSession: () => {},
      initialCompositeUrl: null
    });

    const actionGroup = harness.vdom.props.children[3];
    const printBtn = actionGroup.props.children[0];
    const downloadQrBtn = actionGroup.props.children[1];
    const resetBtn = actionGroup.props.children[2];

    assert.strictEqual(printBtn.props.disabled, true, 'Print button must be disabled when composite is not ready');
    assert.strictEqual(downloadQrBtn.props.disabled, true, 'Download (QR) button must be disabled when composite is not ready');
    assert.strictEqual(resetBtn.props.disabled, undefined, 'Reset button should remain enabled');
  });

  await t.test('enables Print and Download buttons when composite is ready', () => {
    const harness = createTestHarness(PreviewResult, {
      photos: [],
      layoutConfig: { layoutType: 'STRIP_3' },
      onResetSession: () => {},
      initialCompositeUrl: 'data:image/jpeg;base64,readyPhoto'
    });

    const actionGroup = harness.vdom.props.children[3];
    const printBtn = actionGroup.props.children[0];
    const downloadQrBtn = actionGroup.props.children[1];

    assert.strictEqual(printBtn.props.disabled, false, 'Print button must be enabled when composite is ready');
    assert.strictEqual(downloadQrBtn.props.disabled, false, 'Download (QR) button must be enabled when composite is ready');
  });

  await t.test('clicking Print Foto opens Print Choice dialog with Full Frame and Foto Saja options', () => {
    const samplePhotos = ['data:image/jpeg;base64,pose1', 'data:image/jpeg;base64,pose2', 'data:image/jpeg;base64,pose3'];
    const harness = createTestHarness(PreviewResult, {
      photos: samplePhotos,
      layoutConfig: { layoutType: 'STRIP_3' },
      onResetSession: () => {},
      initialCompositeUrl: 'data:image/jpeg;base64,fullFrame'
    });

    const actionGroup = harness.vdom.props.children[3];
    const printBtn = actionGroup.props.children[0];
    assert.strictEqual(typeof printBtn.props.onClick, 'function');

    // Click Print Foto to open dialog
    printBtn.props.onClick();

    const updatedVdom = harness.render();
    const modal = updatedVdom.props.children[6];
    assert.ok(modal, 'Print Choice modal must be open');

    const modalMarkup = renderToStaticMarkup(modal);
    assert.ok(modalMarkup.includes('Pilihan Cetak Foto'), 'Must render dialog title');
    assert.ok(modalMarkup.includes('Full Frame'), 'Must render Full Frame choice');
    assert.ok(modalMarkup.includes('Foto Saja'), 'Must render Foto Saja choice');
  });

  await t.test('Foto Saja mode in Print Choice dialog defaults to selecting all poses with checkboxes', () => {
    const samplePhotos = ['data:image/jpeg;base64,pose1', 'data:image/jpeg;base64,pose2', 'data:image/jpeg;base64,pose3'];
    const harness = createTestHarness(PreviewResult, {
      photos: samplePhotos,
      layoutConfig: { layoutType: 'STRIP_3' },
      onResetSession: () => {},
      initialCompositeUrl: 'data:image/jpeg;base64,fullFrame'
    });

    // Click Print Foto to open dialog
    const actionGroup = harness.vdom.props.children[3];
    const printBtn = actionGroup.props.children[0];
    printBtn.props.onClick();

    let modalVdom = harness.render();
    let choiceModal = modalVdom.props.children[6];
    const card = choiceModal.props.children;
    const modalBody = card.props.children[1];
    const modeCards = modalBody.props.children[0];
    const rawModeCard = modeCards.props.children[1];
    assert.strictEqual(typeof rawModeCard.props.onClick, 'function');

    // Switch to Foto Saja
    rawModeCard.props.onClick();

    modalVdom = harness.render();
    choiceModal = modalVdom.props.children[6];
    const updatedCard = choiceModal.props.children;
    const footer = updatedCard.props.children[2];
    const executeBtn = footer.props.children[1];
    const executeBtnText = executeBtn.props.children[1].props.children;

    // Must default to all 3 poses selected
    assert.strictEqual(executeBtnText, 'Cetak Foto (3 Lembar)', 'Dialog print CTA must default to all 3 selected poses');

    const updatedMarkup = renderToStaticMarkup(choiceModal);
    assert.ok(updatedMarkup.includes('Foto #1'), 'Must render thumbnail for pose 1');
    assert.ok(updatedMarkup.includes('Foto #2'), 'Must render thumbnail for pose 2');
    assert.ok(updatedMarkup.includes('Foto #3'), 'Must render thumbnail for pose 3');
  });

});

test('PreviewResult - Interactive Actions & Modals Lifecycle', async (t) => {
  await t.test('clicking Mulai Sesi Baru opens ResetConfirmModal and confirmation triggers onResetSession', async () => {
    let sessionResetCalled = false;
    let deleteApiCalledWith = null;

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (opts?.method === 'DELETE') {
        deleteApiCalledWith = url;
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    };

    try {
      const harness = createTestHarness(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        sessionId: 'test_session_xyz',
        apiBaseUrl: 'http://localhost:5000',
        initialCompositeUrl: 'data:image/jpeg;base64,sampleComposite',
        onResetSession: () => {
          sessionResetCalled = true;
        }
      });

      // Initial state: reset modal is closed (state idx 2 = isResetOpen)
      assert.strictEqual(harness.states.get(2), false);

      // Find Mulai Sesi Baru button (3rd button in action group)
      const actionGroup = harness.vdom.props.children[3];
      const resetBtn = actionGroup.props.children[2];
      assert.strictEqual(typeof resetBtn.props.onClick, 'function');

      // Click "Mulai Sesi Baru"
      resetBtn.props.onClick();
      assert.strictEqual(harness.states.get(2), true, 'isResetOpen state must be true');

      // Re-render and inspect ResetConfirmModal
      const updatedVdom = harness.render();
      const resetModal = updatedVdom.props.children[5]; // ResetConfirmModal
      assert.strictEqual(resetModal.props.isOpen, true);

      // Trigger confirm on ResetConfirmModal
      await resetModal.props.onConfirm();

      assert.strictEqual(deleteApiCalledWith, null, 'DELETE API must NOT be called when starting a new session so photos are preserved');
      assert.strictEqual(sessionResetCalled, true, 'onResetSession must be invoked on confirm');
      assert.strictEqual(harness.states.get(2), false, 'isResetOpen must be reset to false');
      assert.strictEqual(harness.states.get(0), null, 'compositeUrl volatile state must be purged');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('clicking Download (QR) triggers /api/photos/upload and updates QR data', async () => {
    let uploadPayload = null;
    let uploadEndpoint = null;

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      uploadEndpoint = url;
      uploadPayload = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          downloadUrl: 'http://localhost:5000/uploads/photo_test.jpg',
          qrCodeDataUri: 'data:image/png;base64,returnedQrCode'
        })
      };
    };

    try {
      const harness = createTestHarness(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        sessionId: 'test_session_123',
        apiBaseUrl: 'http://localhost:5000',
        initialCompositeUrl: 'data:image/jpeg;base64,myHighResComposite',
        onResetSession: () => {}
      });

      // Initially QR modal is closed (state idx 1 = isQrOpen)
      assert.strictEqual(harness.states.get(1), false);

      const actionGroup = harness.vdom.props.children[3];
      const downloadQrBtn = actionGroup.props.children[1]; // Download (QR)
      assert.strictEqual(typeof downloadQrBtn.props.onClick, 'function');

      // Click Download (QR)
      await downloadQrBtn.props.onClick();

      assert.strictEqual(uploadEndpoint, 'http://localhost:5000/api/photos/upload');
      assert.strictEqual(uploadPayload.imageBase64, 'data:image/jpeg;base64,myHighResComposite');
      assert.strictEqual(uploadPayload.sessionId, 'test_session_123');

      // States updated: isQrOpen, qrCodeDataUri, downloadUrl
      assert.strictEqual(harness.states.get(1), true, 'isQrOpen must be true');
      assert.strictEqual(harness.states.get(3), 'data:image/png;base64,returnedQrCode');
      assert.strictEqual(harness.states.get(4), 'http://localhost:5000/uploads/photo_test.jpg');

      // Inspect updated QrModal
      const updatedVdom = harness.render();
      const qrModal = updatedVdom.props.children[4];
      assert.strictEqual(qrModal.props.isOpen, true);
      assert.strictEqual(qrModal.props.qrCodeDataUri, 'data:image/png;base64,returnedQrCode');
      assert.strictEqual(qrModal.props.downloadUrl, 'http://localhost:5000/uploads/photo_test.jpg');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('upload failure falls back gracefully to compositeUrl for direct download', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error('Network error');
    };

    try {
      const harness = createTestHarness(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        initialCompositeUrl: 'data:image/jpeg;base64,fallbackComposite',
        onResetSession: () => {}
      });

      const actionGroup = harness.vdom.props.children[3];
      const downloadQrBtn = actionGroup.props.children[1];

      await downloadQrBtn.props.onClick();

      // State idx 4 (downloadUrl) falls back to compositeUrl
      assert.strictEqual(harness.states.get(1), true, 'isQrOpen must be true');
      assert.strictEqual(harness.states.get(4), 'data:image/jpeg;base64,fallbackComposite');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('clicking Print Foto calls /api/print and manages reset timer cleanly on unmount', async () => {
    let printEndpoint = null;
    let printPayload = null;

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      printEndpoint = url;
      printPayload = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ success: true, jobId: 'print_456' })
      };
    };

    try {
      const harness = createTestHarness(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        sessionId: 'print_session',
        initialCompositeUrl: 'data:image/jpeg;base64,printTest',
        onResetSession: () => {}
      });

      const actionGroup = harness.vdom.props.children[3];
      const printBtn = actionGroup.props.children[0];

      await printBtn.props.onClick();

      assert.strictEqual(printEndpoint, 'http://localhost:5000/api/print');
      assert.strictEqual(printPayload.copies, 1);
      assert.strictEqual(printPayload.sessionId, 'print_session');
      assert.strictEqual(harness.states.get(5), 'Terkirim ke antrean cetak!');

      // Verify timer ref was assigned
      const timerRef = harness.refs.get(0);
      assert.ok(timerRef && timerRef.current, 'Timer ref must be active');

      // Verify unmount cleans up timer without errors
      assert.doesNotThrow(() => harness.unmount());
      assert.strictEqual(timerRef.current, null, 'Timer ref must be cleared on unmount');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('print API failure triggers fallback window.print()', async () => {
    let windowPrintTriggered = false;

    const originalFetch = global.fetch;
    const originalWindow = global.window;

    global.fetch = async () => {
      throw new Error('Kiosk print service offline');
    };
    global.window = {
      print: () => {
        windowPrintTriggered = true;
      }
    };

    try {
      const harness = createTestHarness(PreviewResult, {
        photos: [],
        layoutConfig: { layoutType: 'STRIP_3' },
        initialCompositeUrl: 'data:image/jpeg;base64,printTest',
        onResetSession: () => {}
      });

      const actionGroup = harness.vdom.props.children[3];
      const printBtn = actionGroup.props.children[0];

      await printBtn.props.onClick();

      assert.strictEqual(windowPrintTriggered, true, 'Must fall back to window.print() on failure');
      assert.strictEqual(harness.states.get(5), null, 'printStatus must be cleared');
    } finally {
      global.fetch = originalFetch;
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    }
  });
});
