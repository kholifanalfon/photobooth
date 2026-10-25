import test from 'node:test';
import assert from 'node:assert/strict';
import { bluetoothPrinter, formatCanvasForThermalLabel, ditherCanvasThermal, PRINTER_MODEL_OPTIONS, getPrinterProfile, resolveImageToCanvas } from '../src/utils/bluetoothPrinter.js';

function createMockCanvas(width, height) {
  const operations = [];
  const ctx = {
    fillStyle: '',
    calls: operations,
    fillRect(x, y, w, h) {
      operations.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      operations.push({ type: 'drawImage', img, sx, sy, sw, sh, dx, dy, dw, dh });
    },
    save() {
      operations.push({ type: 'save' });
    },
    restore() {
      operations.push({ type: 'restore' });
    },
    beginPath() {
      operations.push({ type: 'beginPath' });
    },
    rect(x, y, w, h) {
      operations.push({ type: 'rect', x, y, w, h });
    },
    clip() {
      operations.push({ type: 'clip' });
    },
    translate(x, y) {
      operations.push({ type: 'translate', x, y });
    },
    rotate(angle) {
      operations.push({ type: 'rotate', angle });
    },
    getImageData(x, y, w, h) {
      return {
        data: new Uint8ClampedArray(w * h * 4)
      };
    },
    putImageData() {}
  };

  return {
    width,
    height,
    getContext: () => ctx
  };
}

test('formatCanvasForThermalLabel - Node environment safety', () => {
  // When document is undefined, returns sourceCanvas unchanged
  const mock = { width: 1200, height: 1800 };
  const res = formatCanvasForThermalLabel(mock);
  assert.equal(res, mock);
});

test('formatCanvasForThermalLabel - 50x30 mm die-cut sticker with autoRotate and safe margin', () => {
  // Mock browser document.createElement
  globalThis.document = {
    createElement(tag) {
      return createMockCanvas(0, 0);
    }
  };

  try {
    const src = createMockCanvas(1200, 1800); // 2:3 portrait photo
    const formatted = formatCanvasForThermalLabel(src, {
      labelWidthMm: 50,
      labelHeightMm: 30,
      marginMm: 1.5,
      fitMode: 'fit',
      autoRotate: true
    });

    // 50 mm at 8 dots/mm = 384 px width
    assert.equal(formatted.width, 384);
    // 30 mm at 8 dots/mm = 240 px height
    assert.equal(formatted.height, 240);

    const calls = formatted.getContext().calls;
    // Should fill white background
    const fill = calls.find(c => c.type === 'fillRect');
    assert.ok(fill);
    assert.equal(fill.w, 384);
    assert.equal(fill.h, 240);
  } finally {
    delete globalThis.document;
  }
});

test('formatCanvasForThermalLabel - Continuous roll auto-height calculation', () => {
  globalThis.document = {
    createElement(tag) {
      return createMockCanvas(0, 0);
    }
  };

  try {
    const src = createMockCanvas(1200, 1800); // aspect 2:3
    const formatted = formatCanvasForThermalLabel(src, {
      labelWidthMm: 50,
      labelHeightMm: 0, // continuous
      marginMm: 1.5,
      fitMode: 'fit',
      autoRotate: false
    });

    assert.equal(formatted.width, 384);
    // 1800 * (384 / 1200) = 576 dots
    assert.equal(formatted.height, 576);
  } finally {
    delete globalThis.document;
  }
});

test('formatCanvasForThermalLabel - Explicit Landscape and Portrait orientations', () => {
  globalThis.document = {
    createElement(tag) {
      return createMockCanvas(0, 0);
    }
  };

  try {
    const portraitSrc = createMockCanvas(800, 1200); // portrait
    const landscapeRes = formatCanvasForThermalLabel(portraitSrc, {
      labelWidthMm: 50,
      labelHeightMm: 30,
      orientation: 'landscape'
    });
    // Formatted label dimensions
    assert.equal(landscapeRes.width, 384);
    assert.equal(landscapeRes.height, 240);

    const landscapeSrc = createMockCanvas(1200, 800); // landscape
    const portraitRes = formatCanvasForThermalLabel(landscapeSrc, {
      labelWidthMm: 50,
      labelHeightMm: 30,
      orientation: 'portrait'
    });
    assert.equal(portraitRes.width, 384);
    assert.equal(portraitRes.height, 240);
  } finally {
    delete globalThis.document;
  }
});

test("formatCanvasForThermalLabel - Niimbot B1 Pro 300 DPI (567px printhead)", () => {
  globalThis.document = {
    createElement(tag) {
      return createMockCanvas(0, 0);
    }
  };

  try {
    const src = createMockCanvas(1200, 1800); // 2:3 portrait photo
    const dotsPerMm = 300 / 25.4; // ~11.81 dots/mm
    const formatted = formatCanvasForThermalLabel(src, {
      labelWidthMm: 50,
      labelHeightMm: 30,
      marginMm: 1.5,
      fitMode: "fit",
      autoRotate: true,
      maxPrintheadPixels: 567,
      dotsPerMm
    });

    // 50mm * 11.81 dots/mm = 590 clamped to 567 px printhead width
    assert.equal(formatted.width, 567);
    // 30mm * 11.81 dots/mm = 354 px height
    assert.equal(formatted.height, 354);

    const calls = formatted.getContext().calls;
    const fill = calls.find(c => c.type === "fillRect");
    assert.ok(fill);
    assert.equal(fill.w, 567);
    assert.equal(fill.h, 354);
  } finally {
    delete globalThis.document;
  }
});

test('PRINTER_MODEL_OPTIONS & getPrinterProfile resolution', () => {
  assert.ok(Array.isArray(PRINTER_MODEL_OPTIONS));
  assert.ok(PRINTER_MODEL_OPTIONS.length >= 6);

  // Explicit preset selection
  const b1Pro = getPrinterProfile('b1_pro');
  assert.equal(b1Pro.dpi, 300);
  assert.equal(b1Pro.printheadPixels, 567);
  assert.equal(b1Pro.taskType, 'D110M_V4');

  const b1 = getPrinterProfile('b1');
  assert.equal(b1.dpi, 203);
  assert.equal(b1.printheadPixels, 384);
  assert.equal(b1.taskType, 'B1');

  // Niimbot B21 Vintage (V1) uses B21_V1 protocol (total count)
  const b21 = getPrinterProfile('b21');
  assert.equal(b21.dpi, 203);
  assert.equal(b21.printheadPixels, 384);
  assert.equal(b21.taskType, 'B21_V1');
  assert.equal(b21.modelId, 768);

  // Niimbot B21S uses D110 protocol
  const b21s = getPrinterProfile('b21s');
  assert.equal(b21s.dpi, 203);
  assert.equal(b21s.printheadPixels, 384);
  assert.equal(b21s.taskType, 'D110');
  assert.equal(b21s.modelId, 777);

  // Fallback auto-detection from device name
  const detectedPro = getPrinterProfile(null, 'B1 Pro-I708030351');
  assert.equal(detectedPro.id, 'b1_pro');
  assert.equal(detectedPro.dpi, 300);
  assert.equal(detectedPro.printheadPixels, 567);

  const detectedB21S = getPrinterProfile(null, 'Niimbot B21S');
  assert.equal(detectedB21S.id, 'b21s');
  assert.equal(detectedB21S.dpi, 203);
  assert.equal(detectedB21S.taskType, 'D110');

  const detectedB21 = getPrinterProfile(null, 'Niimbot B21');
  assert.equal(detectedB21.id, 'b21');
  assert.equal(detectedB21.dpi, 203);
  assert.equal(detectedB21.taskType, 'B21_V1');
});

test('resolveImageToCanvas - Source validation & canvas resolution', async () => {
  // 1. Rejects on empty input
  await assert.rejects(
    async () => {
      await resolveImageToCanvas(null);
    },
    /Sumber gambar kosong/
  );

  // 2. Returns canvas directly if canvas-like
  const mockCanvas = createMockCanvas(300, 200);
  const resolved = await resolveImageToCanvas(mockCanvas);
  assert.equal(resolved, mockCanvas);

  // 3. Handles non-browser fallback safely for strings
  const strResolved = await resolveImageToCanvas('https://example.com/photo.jpg');
  assert.ok(strResolved);
});

test('WebBluetoothPrinter - B21 / B21_V1 single label feed protection (no duplicate printEnd)', async () => {
  const b21Profile = getPrinterProfile('b21');
  assert.equal(b21Profile.taskType, 'B21_V1');

  let printEndCalledCount = 0;
  let waitForFinishedCalledCount = 0;
  let printPageCalledCount = 0;

  const mockTask = {
    setPrintOptions() {},
    async printInit() {},
    async printPage(encoded, qty) {
      printPageCalledCount++;
      assert.equal(qty, 1);
    },
    async waitForFinished() {
      waitForFinishedCalledCount++;
    }
  };

  const mockProtocol = {
    setPacketTimeout() {},
    newPrintTask(taskType, opts) {
      return mockTask;
    },
    async printEnd() {
      printEndCalledCount++;
    },
    cancelStatusPoll() {}
  };

  const mockNiimbotClient = {
    isConnected: () => true,
    stopHeartbeat() {},
    startHeartbeat() {},
    getPrintTaskType: () => 'B21_V1',
    getModelMetadata: () => ({ printheadPixels: 384, dpi: 203 }),
    protocol: mockProtocol,
    printerInfo: { modelId: 768 }
  };

  bluetoothPrinter.isConnected = true;
  bluetoothPrinter.isNiimbot = true;
  bluetoothPrinter.niimbotClient = mockNiimbotClient;

  const mockCanvas = createMockCanvas(384, 240);

  // 1. Print with B21 preset
  await bluetoothPrinter.printImage(mockCanvas, {
    printerModelPreset: 'b21',
    labelWidthMm: 50,
    labelHeightMm: 30
  });

  // Verify that printPage was called exactly once
  assert.equal(printPageCalledCount, 1);
  // Verify that waitForFinished (which polls printEnd and hangs) was NOT called
  assert.equal(waitForFinishedCalledCount, 0);
  // Verify that protocol.printEnd was NOT called (which causes duplicate print / double label feed on B21)
  assert.equal(printEndCalledCount, 0);

  // 2. Test B1: B1 DOES require protocol.printEnd()
  mockNiimbotClient.getPrintTaskType = () => 'B1';
  await bluetoothPrinter.printImage(mockCanvas, {
    printerModelPreset: 'b1',
    labelWidthMm: 50,
    labelHeightMm: 30
  });
  assert.equal(waitForFinishedCalledCount, 1);
  assert.equal(printEndCalledCount, 1);

  // 3. Test B21S (D110): skips protocol.printEnd()
  mockNiimbotClient.getPrintTaskType = () => 'D110';
  await bluetoothPrinter.printImage(mockCanvas, {
    printerModelPreset: 'b21s',
    labelWidthMm: 50,
    labelHeightMm: 30
  });
  // printEnd should still remain 1 (no extra call)
  assert.equal(printEndCalledCount, 1);

  // Cleanup
  bluetoothPrinter.disconnect();
});
