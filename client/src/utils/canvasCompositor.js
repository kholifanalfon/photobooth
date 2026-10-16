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
  if (!srcWidth || !srcHeight || srcWidth <= 0 || srcHeight <= 0) {
    return { cropX: 0, cropY: 0, cropW: targetWidth, cropH: targetHeight, scale: 1 };
  }
  const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
  const cropW = targetWidth / scale;
  const cropH = targetHeight / scale;
  const cropX = (srcWidth - cropW) / 2;
  const cropY = (srcHeight - cropH) / 2;
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
  const normRadius = typeof radius === 'number'
    ? radius
    : (Array.isArray(radius) && typeof radius[0] === 'number' ? radius[0] : 0);

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else if (typeof ctx.arcTo === 'function') {
    const r = Math.min(Math.max(0, normRadius), width / 2, height / 2);
    if (r <= 0) {
      if (typeof ctx.rect === 'function') {
        ctx.rect(x, y, width, height);
      }
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  } else if (typeof ctx.rect === 'function') {
    ctx.rect(x, y, width, height);
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
    customCanvas = null
  } = options;

  const config = FRAME_CONFIGS[layoutType] || FRAME_CONFIGS.STRIP_3;

  let canvas = customCanvas;
  if (!canvas) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      canvas = document.createElement('canvas');
    } else {
      throw new Error('Canvas is not available. Please pass customCanvas in non-browser environments.');
    }
  }

  canvas.width = config.canvasWidth;
  canvas.height = config.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }

  // 1. Draw frame background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw slots with aspect-ratio centering crop
  const radius = 12;
  for (let i = 0; i < config.slots.length; i++) {
    const slot = config.slots[i];
    const photoSrc = photos[i];

    if (photoSrc) {
      const img = (typeof photoSrc === 'object' && photoSrc !== null && 'width' in photoSrc && 'height' in photoSrc)
        ? photoSrc
        : await loadImage(photoSrc);

      // Center crop calculation
      const { cropX, cropY, cropW, cropH } = calculateCenterCrop(
        img.width,
        img.height,
        slot.width,
        slot.height
      );

      ctx.save();
      // Rounded slot clip
      ctx.beginPath();
      drawRoundRect(ctx, slot.x, slot.y, slot.width, slot.height, radius);
      ctx.clip();

      ctx.drawImage(img, cropX, cropY, cropW, cropH, slot.x, slot.y, slot.width, slot.height);
      ctx.restore();

      // Border around photo
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
    }
  }

  // 3. Draw Branding & Footer
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(eventTitle, canvas.width / 2, config.footerY);

  ctx.font = '22px sans-serif';
  ctx.fillStyle = textColor === '#FFFFFF' ? '#e2e8f0' : '#64748b';
  ctx.fillText(dateText, canvas.width / 2, config.footerY + 45);

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
