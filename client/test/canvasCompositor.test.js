import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_CONFIGS,
  calculateCenterCrop,
  drawRoundRect,
  loadImage,
  composePhotosToFrame,
  renderPhotoToPaper
} from '../src/utils/canvasCompositor.js';

function createMockCanvas(hasRoundRect = true) {
  const operations = [];

  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '',
    font: '',
    calls: operations,
    fillRect(x, y, w, h) {
      operations.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    },
    strokeRect(x, y, w, h) {
      operations.push({ type: 'strokeRect', x, y, w, h, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
    stroke() {
      operations.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
    fillText(text, x, y) {
      operations.push({ type: 'fillText', text, x, y, fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign });
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
    clip() {
      operations.push({ type: 'clip' });
    },
    moveTo(x, y) {
      operations.push({ type: 'moveTo', x, y });
    },
    lineTo(x, y) {
      operations.push({ type: 'lineTo', x, y });
    },
    arcTo(x1, y1, x2, y2, radius) {
      operations.push({ type: 'arcTo', x1, y1, x2, y2, radius });
    },
    closePath() {
      operations.push({ type: 'closePath' });
    },
    rect(x, y, w, h) {
      operations.push({ type: 'rect', x, y, w, h });
    }
  };

  if (hasRoundRect) {
    ctx.roundRect = function (x, y, w, h, radius) {
      operations.push({ type: 'roundRect', x, y, w, h, radius });
    };
  }

  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      if (type === '2d') return ctx;
      return null;
    },
    toDataURL(format, quality) {
      operations.push({ type: 'toDataURL', format, quality });
      return `data:${format};base64,mockCanvasDataUri`;
    }
  };

  return { canvas, ctx, operations };
}

test('FRAME_CONFIGS - Layout Specifications & Dimensions', async (t) => {
  await t.test('exports all 4 required layout definitions', () => {
    assert.ok(FRAME_CONFIGS.STRIP_3, 'STRIP_3 should exist');
    assert.ok(FRAME_CONFIGS.STRIP_4, 'STRIP_4 should exist');
    assert.ok(FRAME_CONFIGS.GRID_2X2, 'GRID_2X2 should exist');
    assert.ok(FRAME_CONFIGS.POLAROID_1, 'POLAROID_1 should exist');
  });

  await t.test('STRIP_3 matches 300 DPI specifications', () => {
    const config = FRAME_CONFIGS.STRIP_3;
    assert.strictEqual(config.name, 'Photo Strip 3 Pose');
    assert.strictEqual(config.photoCount, 3);
    assert.strictEqual(config.canvasWidth, 600);
    assert.strictEqual(config.canvasHeight, 1800);
    assert.strictEqual(config.footerY, 1650);
    assert.strictEqual(config.slots.length, 3);

    assert.deepStrictEqual(config.slots, [
      { x: 50, y: 100, width: 500, height: 420 },
      { x: 50, y: 560, width: 500, height: 420 },
      { x: 50, y: 1020, width: 500, height: 420 }
    ]);
  });

  await t.test('STRIP_4 matches 300 DPI specifications', () => {
    const config = FRAME_CONFIGS.STRIP_4;
    assert.strictEqual(config.name, 'Photo Strip 4 Pose');
    assert.strictEqual(config.photoCount, 4);
    assert.strictEqual(config.canvasWidth, 600);
    assert.strictEqual(config.canvasHeight, 1800);
    assert.strictEqual(config.footerY, 1680);
    assert.strictEqual(config.slots.length, 4);

    assert.deepStrictEqual(config.slots, [
      { x: 50, y: 70, width: 500, height: 350 },
      { x: 50, y: 450, width: 500, height: 350 },
      { x: 50, y: 830, width: 500, height: 350 },
      { x: 50, y: 1210, width: 500, height: 350 }
    ]);
  });

  await t.test('GRID_2X2 matches 4R 300 DPI specifications', () => {
    const config = FRAME_CONFIGS.GRID_2X2;
    assert.strictEqual(config.name, 'Grid 2x2 Pose');
    assert.strictEqual(config.photoCount, 4);
    assert.strictEqual(config.canvasWidth, 1200);
    assert.strictEqual(config.canvasHeight, 1800);
    assert.strictEqual(config.footerY, 1550);
    assert.strictEqual(config.slots.length, 4);

    assert.deepStrictEqual(config.slots, [
      { x: 70, y: 120, width: 510, height: 600 },
      { x: 620, y: 120, width: 510, height: 600 },
      { x: 70, y: 760, width: 510, height: 600 },
      { x: 620, y: 760, width: 510, height: 600 }
    ]);
  });

  await t.test('POLAROID_1 matches single pose specifications', () => {
    const config = FRAME_CONFIGS.POLAROID_1;
    assert.strictEqual(config.name, 'Polaroid Single Pose');
    assert.strictEqual(config.photoCount, 1);
    assert.strictEqual(config.canvasWidth, 1200);
    assert.strictEqual(config.canvasHeight, 1500);
    assert.strictEqual(config.footerY, 1300);
    assert.strictEqual(config.slots.length, 1);
    assert.deepStrictEqual(config.slots[0], { x: 100, y: 100, width: 1000, height: 1000 });
  });

  await t.test('all slots fit strictly within canvas bounds and above footer', () => {
    for (const [layoutKey, config] of Object.entries(FRAME_CONFIGS)) {
      assert.strictEqual(config.slots.length, config.photoCount, `Slot count mismatch in ${layoutKey}`);
      for (let i = 0; i < config.slots.length; i++) {
        const slot = config.slots[i];
        assert.ok(slot.x >= 0, `Slot ${i} in ${layoutKey} x must be >= 0`);
        assert.ok(slot.y >= 0, `Slot ${i} in ${layoutKey} y must be >= 0`);
        assert.ok(slot.x + slot.width <= config.canvasWidth, `Slot ${i} in ${layoutKey} exceeds canvas width`);
        assert.ok(slot.y + slot.height <= config.footerY, `Slot ${i} in ${layoutKey} overlaps footer`);
        assert.ok(config.footerY < config.canvasHeight, `Footer in ${layoutKey} must be within canvas height`);
      }
    }
  });
});

test('calculateCenterCrop - Aspect Ratio & Cover Crop Math', async (t) => {
  await t.test('exact matching aspect ratio crops entire image with no offset', () => {
    const res = calculateCenterCrop(1000, 1000, 500, 500);
    assert.strictEqual(res.scale, 0.5);
    assert.strictEqual(res.cropW, 1000);
    assert.strictEqual(res.cropH, 1000);
    assert.strictEqual(res.cropX, 0);
    assert.strictEqual(res.cropY, 0);
  });

  await t.test('landscape source into square slot crops left and right equally', () => {
    // 16:9 source (1920x1080) into 1000x1000 target
    const res = calculateCenterCrop(1920, 1080, 1000, 1000);
    // scale is determined by height: 1000 / 1080
    assert.strictEqual(res.scale, 1000 / 1080);
    assert.strictEqual(res.cropH, 1080);
    assert.strictEqual(res.cropW, 1080);
    assert.strictEqual(res.cropX, (1920 - 1080) / 2); // 420
    assert.strictEqual(res.cropY, 0);
  });

  await t.test('portrait source into landscape slot crops top and bottom equally', () => {
    // 9:16 source (1080x1920) into 1000x500 target
    const res = calculateCenterCrop(1080, 1920, 1000, 500);
    // scale is determined by width: 1000 / 1080
    assert.strictEqual(res.scale, 1000 / 1080);
    assert.strictEqual(res.cropW, 1080);
    assert.strictEqual(res.cropH, 500 / (1000 / 1080)); // 540
    assert.strictEqual(res.cropX, 0);
    assert.strictEqual(res.cropY, (1920 - 540) / 2); // 690
  });

  await t.test('webcam capture into STRIP_3 slot calculates valid crop coordinates', () => {
    // 1280x960 (4:3) into STRIP_3 slot (500x420)
    const res = calculateCenterCrop(1280, 960, 500, 420);
    assert.ok(res.scale > 0);
    assert.ok(res.cropW <= 1280);
    assert.ok(res.cropH <= 960);
    assert.ok(res.cropX >= 0);
    assert.ok(res.cropY >= 0);
    // Aspect ratio of crop must match target slot aspect ratio (500/420)
    const targetAspect = 500 / 420;
    const cropAspect = res.cropW / res.cropH;
    assert.ok(Math.abs(targetAspect - cropAspect) < 1e-6);
  });

  await t.test('handles zero or negative dimensions gracefully without NaN', () => {
    const res = calculateCenterCrop(0, 0, 500, 420);
    assert.strictEqual(res.cropX, 0);
    assert.strictEqual(res.cropY, 0);
    assert.strictEqual(res.cropW, 500);
    assert.strictEqual(res.cropH, 420);
    assert.strictEqual(res.scale, 1);
  });
});

test('drawRoundRect - Browser Compatibility & Fallbacks', async (t) => {
  await t.test('invokes native ctx.roundRect when available', () => {
    const { ctx, operations } = createMockCanvas(true);
    drawRoundRect(ctx, 10, 20, 300, 200, 15);

    const roundRectCalls = operations.filter((op) => op.type === 'roundRect');
    assert.strictEqual(roundRectCalls.length, 1);
    assert.deepStrictEqual(roundRectCalls[0], {
      type: 'roundRect',
      x: 10,
      y: 20,
      w: 300,
      h: 200,
      radius: 15
    });
  });

  await t.test('falls back to arcTo path construction when ctx.roundRect is missing', () => {
    const { ctx, operations } = createMockCanvas(false);
    assert.strictEqual(typeof ctx.roundRect, 'undefined');

    drawRoundRect(ctx, 10, 20, 300, 200, 15);

    const arcToCalls = operations.filter((op) => op.type === 'arcTo');
    const lineToCalls = operations.filter((op) => op.type === 'lineTo');
    const moveToCalls = operations.filter((op) => op.type === 'moveTo');
    const closeCalls = operations.filter((op) => op.type === 'closePath');

    assert.strictEqual(arcToCalls.length, 4, 'Should construct 4 corner arcs');
    assert.strictEqual(lineToCalls.length, 4, 'Should connect 4 side lines');
    assert.strictEqual(moveToCalls.length, 1, 'Should start with moveTo');
    assert.strictEqual(closeCalls.length, 1, 'Should close path');
  });

  await t.test('falls back to ctx.rect when radius is zero or negative', () => {
    const { ctx, operations } = createMockCanvas(false);
    drawRoundRect(ctx, 5, 10, 100, 100, 0);

    const rectCalls = operations.filter((op) => op.type === 'rect');
    assert.strictEqual(rectCalls.length, 1);
    assert.deepStrictEqual(rectCalls[0], { type: 'rect', x: 5, y: 10, w: 100, h: 100 });
  });

  await t.test('falls back to ctx.rect when neither roundRect nor arcTo is available', () => {
    const operations = [];
    const bareCtx = {
      rect(x, y, w, h) {
        operations.push({ type: 'rect', x, y, w, h });
      }
    };

    drawRoundRect(bareCtx, 15, 25, 200, 150, 12);
    assert.strictEqual(operations.length, 1);
    assert.deepStrictEqual(operations[0], { type: 'rect', x: 15, y: 25, w: 200, h: 150 });
  });

  await t.test('handles radius specified as array [12] gracefully', () => {
    const { ctx, operations } = createMockCanvas(false);
    drawRoundRect(ctx, 10, 20, 200, 100, [12]);
    const arcToCalls = operations.filter((op) => op.type === 'arcTo');
    assert.strictEqual(arcToCalls.length, 4);
    assert.strictEqual(arcToCalls[0].radius, 12);
  });
});

test('loadImage - Image Loading & Error Handling', async (t) => {
  const originalImage = global.Image;

  await t.test('rejects with descriptive error when Image is unavailable', async () => {
    delete global.Image;
    try {
      await assert.rejects(
        () => loadImage('test.png'),
        /Image constructor is not available/
      );
    } finally {
      if (originalImage) global.Image = originalImage;
    }
  });

  await t.test('resolves when image loads successfully', async () => {
    class MockImage {
      constructor() {
        this.crossOrigin = '';
        this.src = '';
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 5);
      }
    }
    global.Image = MockImage;

    try {
      const img = await loadImage('data:image/png;base64,mock');
      assert.ok(img instanceof MockImage);
      assert.strictEqual(img.crossOrigin, 'anonymous');
    } finally {
      if (originalImage) global.Image = originalImage;
      else delete global.Image;
    }
  });

  await t.test('rejects when image load triggers error', async () => {
    class FailingImage {
      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Corrupt image data'));
        }, 5);
      }
    }
    global.Image = FailingImage;

    try {
      await assert.rejects(
        () => loadImage('invalid.jpg'),
        /Failed to load image/
      );
    } finally {
      if (originalImage) global.Image = originalImage;
      else delete global.Image;
    }
  });
});

test('composePhotosToFrame - Compositing Pipeline & Mock Canvas', async (t) => {
  await t.test('assembles STRIP_3 layout correctly on canvas', async () => {
    const { canvas, operations } = createMockCanvas(true);
    const mockPhotos = [
      { width: 1280, height: 960 },
      { width: 1920, height: 1080 },
      { width: 800, height: 800 }
    ];

    const result = await composePhotosToFrame(mockPhotos, {
      layoutType: 'STRIP_3',
      frameColor: '#FFE4E6',
      textColor: '#881337',
      eventTitle: 'BIRTHDAY BASH 2026',
      dateText: '17 Oktober 2026',
      customCanvas: canvas
    });

    assert.strictEqual(result.width, 600);
    assert.strictEqual(result.height, 1800);
    assert.strictEqual(canvas.width, 600);
    assert.strictEqual(canvas.height, 1800);
    assert.ok(result.dataUrl.startsWith('data:image/jpeg;base64,'));

    // Check background fill
    const bgFill = operations.find((op) => op.type === 'fillRect');
    assert.ok(bgFill);
    assert.strictEqual(bgFill.fillStyle, '#FFE4E6');
    assert.strictEqual(bgFill.w, 600);
    assert.strictEqual(bgFill.h, 1800);

    // Check drawImage calls
    const drawCalls = operations.filter((op) => op.type === 'drawImage');
    assert.strictEqual(drawCalls.length, 3, 'Should draw 3 photos');

    const strip3Slots = FRAME_CONFIGS.STRIP_3.slots;
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(drawCalls[i].dx, strip3Slots[i].x);
      assert.strictEqual(drawCalls[i].dy, strip3Slots[i].y);
      assert.strictEqual(drawCalls[i].dw, strip3Slots[i].width);
      assert.strictEqual(drawCalls[i].dh, strip3Slots[i].height);
    }

    // Check borders drawn
    const strokeCalls = operations.filter((op) => op.type === 'stroke');
    assert.strictEqual(strokeCalls.length, 3, 'Should stroke rounded border around 3 photos');

    // Check branding text
    const textCalls = operations.filter((op) => op.type === 'fillText');
    assert.strictEqual(textCalls.length, 2, 'Should draw title and date');
    assert.strictEqual(textCalls[0].text, 'BIRTHDAY BASH 2026');
    assert.strictEqual(textCalls[0].x, 300); // canvas.width / 2
    assert.strictEqual(textCalls[0].y, 1650); // footerY
    assert.strictEqual(textCalls[0].fillStyle, '#881337');

    assert.strictEqual(textCalls[1].text, '17 Oktober 2026');
    assert.strictEqual(textCalls[1].x, 300);
    assert.strictEqual(textCalls[1].y, 1695); // footerY + 45
  });

  await t.test('assembles GRID_2X2 layout (1200x1800) with 4 photos', async () => {
    const { canvas, operations } = createMockCanvas(true);
    const mockPhotos = [
      { width: 1000, height: 1000 },
      { width: 1000, height: 1000 },
      { width: 1000, height: 1000 },
      { width: 1000, height: 1000 }
    ];

    const result = await composePhotosToFrame(mockPhotos, {
      layoutType: 'GRID_2X2',
      customCanvas: canvas
    });

    assert.strictEqual(result.width, 1200);
    assert.strictEqual(result.height, 1800);

    const drawCalls = operations.filter((op) => op.type === 'drawImage');
    assert.strictEqual(drawCalls.length, 4);

    const gridSlots = FRAME_CONFIGS.GRID_2X2.slots;
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(drawCalls[i].dx, gridSlots[i].x);
      assert.strictEqual(drawCalls[i].dy, gridSlots[i].y);
      assert.strictEqual(drawCalls[i].dw, gridSlots[i].width);
      assert.strictEqual(drawCalls[i].dh, gridSlots[i].height);
    }
  });

  await t.test('assembles POLAROID_1 layout (1200x1500) with 1 photo', async () => {
    const { canvas, operations } = createMockCanvas(true);
    const mockPhotos = [{ width: 1080, height: 1080 }];

    const result = await composePhotosToFrame(mockPhotos, {
      layoutType: 'POLAROID_1',
      customCanvas: canvas
    });

    assert.strictEqual(result.width, 1200);
    assert.strictEqual(result.height, 1500);

    const drawCalls = operations.filter((op) => op.type === 'drawImage');
    assert.strictEqual(drawCalls.length, 1);
    assert.strictEqual(drawCalls[0].dx, 100);
    assert.strictEqual(drawCalls[0].dy, 100);
    assert.strictEqual(drawCalls[0].dw, 1000);
    assert.strictEqual(drawCalls[0].dh, 1000);
  });

  await t.test('handles partial photo arrays without throwing', async () => {
    const { canvas, operations } = createMockCanvas(true);
    // Only 2 photos for 4-pose STRIP_4
    const mockPhotos = [
      { width: 1280, height: 720 },
      { width: 1280, height: 720 }
    ];

    const result = await composePhotosToFrame(mockPhotos, {
      layoutType: 'STRIP_4',
      customCanvas: canvas
    });

    assert.strictEqual(result.width, 600);
    assert.strictEqual(result.height, 1800);
    const drawCalls = operations.filter((op) => op.type === 'drawImage');
    assert.strictEqual(drawCalls.length, 2);
  });

  await t.test('falls back to STRIP_3 when unknown layout is specified', async () => {
    const { canvas } = createMockCanvas(true);
    const result = await composePhotosToFrame([], {
      layoutType: 'NON_EXISTENT_LAYOUT',
      customCanvas: canvas
    });
    assert.strictEqual(result.width, 600);
    assert.strictEqual(result.height, 1800);
  });

  await t.test('uses fallback date color when textColor is #FFFFFF', async () => {
    const { canvas, operations } = createMockCanvas(true);
    await composePhotosToFrame([], {
      textColor: '#FFFFFF',
      customCanvas: canvas
    });

    const textCalls = operations.filter((op) => op.type === 'fillText');
    assert.strictEqual(textCalls.length, 2);
    assert.strictEqual(textCalls[0].fillStyle, '#FFFFFF');
    assert.strictEqual(textCalls[1].fillStyle, '#e2e8f0'); // lighter slate for white text
  });

  await t.test('uses fallback canvas creation via document.createElement when available', async () => {
    const originalDocument = global.document;
    const { canvas } = createMockCanvas(true);
    global.document = {
      createElement(tag) {
        if (tag === 'canvas') return canvas;
        return null;
      }
    };

    try {
      const result = await composePhotosToFrame([], { layoutType: 'STRIP_3' });
      assert.strictEqual(result.width, 600);
      assert.strictEqual(result.height, 1800);
    } finally {
      if (originalDocument) global.document = originalDocument;
      else delete global.document;
    }
  });

  await t.test('throws clear error when canvas cannot be created in environment', async () => {
    const originalDocument = global.document;
    delete global.document;

    try {
      await assert.rejects(
        () => composePhotosToFrame([], { layoutType: 'STRIP_3' }),
        /Canvas is not available/
      );
    } finally {
      if (originalDocument) global.document = originalDocument;
    }
  });
});

test('renderPhotoToPaper - Clean Raw Photo Paper Rendering Suite', async (t) => {
  await t.test('renders photo to 4R portrait (1200 x 1800) and landscape (1800 x 1200)', async () => {
    const { canvas: canvasP } = createMockCanvas(true);
    const resP = await renderPhotoToPaper(null, {
      paperSize: '4R',
      orientation: 'portrait',
      customCanvas: canvasP
    });
    assert.strictEqual(resP.width, 1200);
    assert.strictEqual(resP.height, 1800);

    const { canvas: canvasL } = createMockCanvas(true);
    const resL = await renderPhotoToPaper(null, {
      paperSize: '4R',
      orientation: 'landscape',
      customCanvas: canvasL
    });
    assert.strictEqual(resL.width, 1800);
    assert.strictEqual(resL.height, 1200);
  });

  await t.test('renders photo to 3x5cm (354 x 591) and 5x5cm square (591 x 591)', async () => {
    const { canvas: canvas3x5 } = createMockCanvas(true);
    const res3x5 = await renderPhotoToPaper(null, {
      paperSize: '3x5cm',
      orientation: 'portrait',
      customCanvas: canvas3x5
    });
    assert.strictEqual(res3x5.width, 354);
    assert.strictEqual(res3x5.height, 591);

    const { canvas: canvas5x5 } = createMockCanvas(true);
    const res5x5 = await renderPhotoToPaper(null, {
      paperSize: '5x5cm',
      customCanvas: canvas5x5
    });
    assert.strictEqual(res5x5.width, 591);
    assert.strictEqual(res5x5.height, 591);
  });
});
