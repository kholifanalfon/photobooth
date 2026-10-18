/**
 * High-Resolution Canvas Compositor Engine (300 DPI)
 * Assembles captured photos into print-ready photo strips or grid layouts
 * with aspect-ratio centering crop, frame colors, rounded photo corners, and branding text.
 */

export const FRAME_CONFIGS = {
  STRIP_3: {
    name: 'Photo Strip 3 Pose',
    photoCount: 3,
    canvasWidth: 600,
    canvasHeight: 1800,
    slots: [
      { x: 50, y: 100, width: 500, height: 420 },
      { x: 50, y: 560, width: 500, height: 420 },
      { x: 50, y: 1020, width: 500, height: 420 }
    ],
    footerY: 1650
  },
  STRIP_4: {
    name: 'Photo Strip 4 Pose',
    photoCount: 4,
    canvasWidth: 600,
    canvasHeight: 1800,
    slots: [
      { x: 50, y: 70, width: 500, height: 350 },
      { x: 50, y: 450, width: 500, height: 350 },
      { x: 50, y: 830, width: 500, height: 350 },
      { x: 50, y: 1210, width: 500, height: 350 }
    ],
    footerY: 1680
  },
  GRID_2X2: {
    name: 'Grid 2x2 Pose',
    photoCount: 4,
    canvasWidth: 1200,
    canvasHeight: 1800,
    slots: [
      { x: 70, y: 120, width: 510, height: 600 },
      { x: 620, y: 120, width: 510, height: 600 },
      { x: 70, y: 760, width: 510, height: 600 },
      { x: 620, y: 760, width: 510, height: 600 }
    ],
    footerY: 1550
  },
  POLAROID_1: {
    name: 'Polaroid Single Pose',
    photoCount: 1,
    canvasWidth: 1200,
    canvasHeight: 1500,
    slots: [
      { x: 100, y: 100, width: 1000, height: 1000 }
    ],
    footerY: 1300
  }
};

/**
 * Calculates crop dimensions and offsets to center-crop an image while filling the target slot (cover mode).
 *
 * @param {number} srcWidth - Source image width.
 * @param {number} srcHeight - Source image height.
 * @param {number} targetWidth - Destination slot width.
 * @param {number} targetHeight - Destination slot height.
 * @returns {{ cropX: number, cropY: number, cropW: number, cropH: number, scale: number }}
 */
export function calculateCenterCrop(srcWidth, srcHeight, targetWidth, targetHeight) {
  const sW = Number(srcWidth) || 0;
  const sH = Number(srcHeight) || 0;
  const tW = Number(targetWidth) || 0;
  const tH = Number(targetHeight) || 0;

  if (sW <= 0 || sH <= 0 || tW <= 0 || tH <= 0) {
    return { cropX: 0, cropY: 0, cropW: tW, cropH: tH, scale: 1 };
  }
  const scale = Math.max(tW / sW, tH / sH);
  const cropW = tW / scale;
  const cropH = tH / scale;
  const cropX = (sW - cropW) / 2;
  const cropY = (sH - cropH) / 2;
  return { cropX, cropY, cropW, cropH, scale };
}

/**
 * Safely draws a rounded rectangle path on CanvasRenderingContext2D.
 * Fallbacks to arcTo or standard rect when roundRect is not supported.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number|number[]} [radius=0]
 */
export function drawRoundRect(ctx, x, y, width, height, radius = 0) {
  const numX = Number(x) || 0;
  const numY = Number(y) || 0;
  const numW = Number(width) || 0;
  const numH = Number(height) || 0;
  const normRadius = typeof radius === 'number'
    ? radius
    : (Array.isArray(radius) && typeof radius[0] === 'number' ? radius[0] : (Number(radius) || 0));

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(numX, numY, numW, numH, normRadius);
  } else if (typeof ctx.arcTo === 'function') {
    const r = Math.min(Math.max(0, normRadius), numW / 2, numH / 2);
    if (r <= 0) {
      if (typeof ctx.rect === 'function') {
        ctx.rect(numX, numY, numW, numH);
      }
      return;
    }
    ctx.moveTo(numX + r, numY);
    ctx.lineTo(numX + numW - r, numY);
    ctx.arcTo(numX + numW, numY, numX + numW, numY + r, r);
    ctx.lineTo(numX + numW, numY + numH - r);
    ctx.arcTo(numX + numW, numY + numH, numX + numW - r, numY + numH, r);
    ctx.lineTo(numX + r, numY + numH);
    ctx.arcTo(numX, numY + numH, numX, numY + numH - r, r);
    ctx.lineTo(numX, numY + r);
    ctx.arcTo(numX, numY, numX + r, numY, r);
    ctx.closePath();
  } else if (typeof ctx.rect === 'function') {
    ctx.rect(numX, numY, numW, numH);
  }
}

/**
 * Loads an image from a URL or data URI into an HTMLImageElement.
 *
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image constructor is not available in current environment'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${err?.message || 'unknown error'}`));
    img.src = src;
  });
}

/**
 * Assembles captured photos into a 300 DPI composite photo strip or 4R grid layout.
 *
 * @param {Array<string|object>} photos - Image sources (data URLs, URLs, or preloaded Image/Canvas objects)
 * @param {object} [options]
 * @param {string} [options.layoutType='STRIP_3'] - Key in FRAME_CONFIGS
 * @param {string} [options.frameColor='#FFFFFF'] - Background hex or color name
 * @param {string} [options.textColor='#1e293b'] - Font color
 * @param {string} [options.eventTitle='PHOTOBOOTH MEMORY'] - Main branding header
 * @param {string} [options.dateText] - Date subtitle
 * @param {HTMLCanvasElement} [options.customCanvas] - Optional pre-existing canvas element
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export async function composePhotosToFrame(photos = [], options = {}) {
  const {
    layoutType = 'STRIP_3',
    frameColor = '#FFFFFF',
    textColor = '#1e293b',
    eventTitle = 'PHOTOBOOTH MEMORY',
    dateText = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
    customCanvas = null,
    customFrame = null
  } = options;

  const isCustomFrame = Boolean(
    customFrame &&
    customFrame.enabled &&
    Array.isArray(customFrame.slots) &&
    customFrame.slots.length > 0
  );

  const isLandscape = customFrame?.orientation === 'landscape';
  let customWidth = isLandscape ? 1800 : 1200;
  let customHeight = isLandscape ? 1200 : 1800;

  if (Number(customFrame?.width) > 0 && Number(customFrame?.height) > 0) {
    const rawW = Number(customFrame.width);
    const rawH = Number(customFrame.height);
    if (isLandscape) {
      customWidth = rawW >= rawH ? rawW : rawH;
      customHeight = rawW >= rawH ? rawH : rawW;
    } else {
      customWidth = rawH >= rawW ? rawW : rawH;
      customHeight = rawH >= rawW ? rawH : rawW;
    }
  }

  const config = FRAME_CONFIGS[layoutType] || FRAME_CONFIGS.STRIP_3;
  const canvasWidth = isCustomFrame ? customWidth : config.canvasWidth;
  const canvasHeight = isCustomFrame ? customHeight : config.canvasHeight;
  const activeSlots = isCustomFrame ? customFrame.slots : config.slots;

  let canvas = customCanvas;
  if (!canvas) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      canvas = document.createElement('canvas');
    } else {
      throw new Error('Canvas is not available. Please pass customCanvas in non-browser environments.');
    }
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }

  // 1. Draw frame base background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // If customFrame has an image, determine if it should be drawn as BACKGROUND or OVERLAY:
  // JPEGs have NO alpha transparency. Drawing an opaque JPEG on top of photos will ALWAYS cover and hide them.
  // Therefore, JPEGs and any frame where layerMode !== 'overlay' MUST be drawn as background FIRST!
  const isJpeg = Boolean(customFrame?.imageUrl && customFrame.imageUrl.match(/\.(jpe?g)($|\?)/i));
  const isOverlayMode = Boolean(
    isCustomFrame &&
    customFrame.imageUrl &&
    !isJpeg &&
    (customFrame.layerMode === 'overlay' || customFrame.layerMode === 'front')
  );

  let frameImg = null;
  if (isCustomFrame && customFrame.imageUrl) {
    try {
      frameImg = await loadImage(customFrame.imageUrl);
    } catch (overlayErr) {
      console.warn('Failed to load custom frame image:', overlayErr);
    }
  }

  // Helper to draw custom frame image with custom position, scale, and optional mirroring
  const drawCustomFrameImage = (img) => {
    const imgX = Number(customFrame.imageX) || 0;
    const imgY = Number(customFrame.imageY) || 0;
    const imgW = Number(customFrame.imageWidth) > 0
      ? Number(customFrame.imageWidth)
      : (customFrame.imageMirror ? Math.round(canvas.width / 2) : canvas.width);
    const imgH = Number(customFrame.imageHeight) > 0
      ? Number(customFrame.imageHeight)
      : canvas.height;

    // Draw main frame image
    ctx.drawImage(img, imgX, imgY, imgW, imgH);

    // If mirror image is enabled, draw the mirrored frame image
    if (customFrame.imageMirror) {
      const mX = customFrame.mirrorImageX !== undefined && customFrame.mirrorImageX !== null
        ? Number(customFrame.mirrorImageX)
        : Math.round(canvas.width - imgX - imgW);
      const mY = customFrame.mirrorImageY !== undefined && customFrame.mirrorImageY !== null
        ? Number(customFrame.mirrorImageY)
        : imgY;
      const mW = Number(customFrame.mirrorImageWidth) > 0 ? Number(customFrame.mirrorImageWidth) : imgW;
      const mH = Number(customFrame.mirrorImageHeight) > 0 ? Number(customFrame.mirrorImageHeight) : imgH;
      const flip = Boolean(customFrame.mirrorImageFlip);

      ctx.save();
      if (flip) {
        ctx.translate(mX + mW / 2, mY + mH / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -mW / 2, -mH / 2, mW, mH);
      } else {
        ctx.drawImage(img, mX, mY, mW, mH);
      }
      ctx.restore();
    }
  };

  // Draw custom frame image as background if not in overlay mode
  if (isCustomFrame && frameImg && !isOverlayMode) {
    drawCustomFrameImage(frameImg);
  }

  // 2. Draw slots with aspect-ratio centering crop matching exact configured width and height
  for (let i = 0; i < activeSlots.length; i++) {
    const slot = activeSlots[i];
    const slotX = Number(slot.x) || 0;
    const slotY = Number(slot.y) || 0;
    const slotW = Number(slot.width) || 100;
    const slotH = Number(slot.height) || 100;
    const radius = Number(slot.radius) >= 0 ? Number(slot.radius) : (isCustomFrame ? 0 : 12);
    const borderWidth = Number(slot.borderWidth) >= 0 ? Number(slot.borderWidth) : 0;
    const borderColor = slot.borderColor || '#FFFFFF';

    // For custom frames (e.g. double strip / mirror slots), support explicit slot.photoIndex or repeat photos if fewer taken than slots
    const targetPhotoIdx = (slot.photoIndex !== undefined && slot.photoIndex !== null)
      ? Number(slot.photoIndex)
      : (photos.length > 0 ? i % photos.length : i);

    const photoSrc = isCustomFrame
      ? (photos[targetPhotoIdx] || (photos.length > 0 ? photos[targetPhotoIdx % photos.length] : null))
      : photos[i];

    if (photoSrc) {
      const img = (typeof photoSrc === 'object' && photoSrc !== null && 'width' in photoSrc && 'height' in photoSrc)
        ? photoSrc
        : await loadImage(photoSrc);

      // Center crop calculation ensuring photo fills exact slot width and height (cover mode)
      const { cropX, cropY, cropW, cropH } = calculateCenterCrop(
        img.width,
        img.height,
        slotW,
        slotH
      );

      ctx.save();
      // Rounded slot clip using exact slot width and height
      ctx.beginPath();
      drawRoundRect(ctx, slotX, slotY, slotW, slotH, radius);
      ctx.clip();

      ctx.drawImage(img, cropX, cropY, cropW, cropH, slotX, slotY, slotW, slotH);
      ctx.restore();

      // Draw custom border if configured (borderWidth > 0)
      if (isCustomFrame && borderWidth > 0) {
        ctx.save();
        ctx.beginPath();
        drawRoundRect(ctx, slotX, slotY, slotW, slotH, radius);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.stroke();
        ctx.restore();
      } else if (!isCustomFrame) {
        ctx.beginPath();
        drawRoundRect(ctx, slotX, slotY, slotW, slotH, radius);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (isCustomFrame && borderWidth > 0) {
      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, slotX, slotY, slotW, slotH, radius);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. If overlay mode (PNG with transparent cutouts), draw frame on top of photos
  if (isCustomFrame && frameImg && isOverlayMode) {
    drawCustomFrameImage(frameImg);
  } else if (!isCustomFrame) {
    // 4. Draw Branding & Footer for standard presets
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(eventTitle, canvas.width / 2, config.footerY);

    ctx.font = '22px sans-serif';
    ctx.fillStyle = textColor === '#FFFFFF' ? '#e2e8f0' : '#64748b';
    ctx.fillText(dateText, canvas.width / 2, config.footerY + 45);
  }

  const dataUrl = typeof canvas.toDataURL === 'function'
    ? canvas.toDataURL('image/jpeg', 0.95)
    : '';

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}

export default {
  FRAME_CONFIGS,
  calculateCenterCrop,
  drawRoundRect,
  loadImage,
  composePhotosToFrame
};
