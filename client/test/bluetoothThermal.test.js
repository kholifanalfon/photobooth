import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCanvasForThermalLabel, ditherCanvasThermal } from '../src/utils/bluetoothPrinter.js';

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
