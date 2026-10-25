/**
 * bluetoothPrinter.js
 * Web Bluetooth API Manager for Photobooth Direct Kiosk Printing
 *
 * Supports:
 * - Native NIIMBOT Bluetooth Printers (B1 Pro, B1, B21 Pro, B21, B21S, D11, D110, B3S, etc.) via @mmote/niimbluelib
 * - Accurate protocol selection: B21 V1 (model 768, B21_V1 task, total byte count), B21S (model 777, D110 task)
 * - Label type support: WithGaps (1), Transparent Film (5), BlackMark (2), Continuous (3)
 * - Hardware gap positioning and calibration
 * - Generic ESC/POS / BLE Serial Thermal Printers as fallback
 * - High-detail Floyd-Steinberg and Atkinson error diffusion dithering for photographic thermal printing
 */

import { NiimbotBluetoothClient, ImageEncoder, PageColorType, PacketGenerator } from '@mmote/niimbluelib';

/**
 * Formats, scales, crops, rotates and adds safe margins to any source canvas
 * to match the exact physical die-cut label sticker or continuous roll of a thermal printer.
 *
 * Supports orientation: 'auto' | 'portrait' | 'landscape'
 */
export function formatCanvasForThermalLabel(sourceCanvas, options = {}) {
  if (typeof document === 'undefined') return sourceCanvas;

  const {
    labelWidthMm = 50,
    labelHeightMm = 30,
    marginMm = 1.5,
    fitMode = 'fit',
    autoRotate = true,
    orientation = 'auto',
    maxPrintheadPixels = 384,
    dotsPerMm = 8
  } = options;

  const targetWidth = Math.min(maxPrintheadPixels, Math.round((Number(labelWidthMm) || 50) * dotsPerMm) || maxPrintheadPixels);
  const isContinuous = !labelHeightMm || Number(labelHeightMm) <= 0;

  let srcW = sourceCanvas.width;
  let srcH = sourceCanvas.height;

  // Determine rotation based on requested orientation preference:
  let shouldRotate = false;
  if (!isContinuous) {
    if (orientation === 'landscape') {
      // User explicitly requested Landscape:
      // If source image is vertical/portrait (srcH > srcW), rotate 90° so it lays across the wide label
      if (srcH > srcW) {
        shouldRotate = true;
      }
    } else if (orientation === 'portrait') {
      // User explicitly requested Portrait:
      // If source image is horizontal/landscape (srcW > srcH), rotate 90° so it stands vertical
      if (srcW > srcH) {
        shouldRotate = true;
      }
    } else {
      // 'auto': Automatically rotate if aspect ratio orientation is mismatched with label orientation
      if (autoRotate !== false) {
        const isSrcPortrait = srcH > srcW;
        const isDstLandscape = targetWidth > (Number(labelHeightMm) * dotsPerMm);
        if ((isSrcPortrait && isDstLandscape) || (!isSrcPortrait && !isDstLandscape)) {
          shouldRotate = true;
        }
      }
    }
  }

  let preparedSource = sourceCanvas;
  if (shouldRotate) {
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = srcH;
    rotCanvas.height = srcW;
    const rCtx = rotCanvas.getContext('2d');
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate((90 * Math.PI) / 180);
    rCtx.drawImage(sourceCanvas, -srcW / 2, -srcH / 2);
    preparedSource = rotCanvas;
    srcW = rotCanvas.width;
    srcH = rotCanvas.height;
  }

  let targetHeight;
  if (isContinuous) {
    targetHeight = Math.max(1, Math.round(srcH * (targetWidth / srcW)));
  } else {
    targetHeight = Math.max(1, Math.round(Number(labelHeightMm) * dotsPerMm));
  }

  // Margin calculation - minimum 1.5mm recommended for die-cut label gap clearance
  const marginPx = Math.max(0, Math.round((Number(marginMm) || 0) * dotsPerMm));
  const printableW = Math.max(1, targetWidth - marginPx * 2);
  const printableH = Math.max(1, targetHeight - marginPx * 2);

  const srcAspect = srcW / srcH;
  const dstAspect = printableW / printableH;

  let drawW, drawH;
  if (fitMode === 'cover') {
    if (srcAspect > dstAspect) {
      drawH = printableH;
      drawW = Math.round(printableH * srcAspect);
    } else {
      drawW = printableW;
      drawH = Math.round(printableW / srcAspect);
    }
  } else {
    // fit (letterbox)
    if (srcAspect > dstAspect) {
      drawW = printableW;
      drawH = Math.round(printableW / srcAspect);
    } else {
      drawH = printableH;
      drawW = Math.round(printableH * srcAspect);
    }
  }

  const drawX = marginPx + Math.round((printableW - drawW) / 2);
  const drawY = marginPx + Math.round((printableH - drawH) / 2);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const fCtx = finalCanvas.getContext('2d');

  // Fill crisp white background so margins and empty areas are pure white
  fCtx.fillStyle = '#FFFFFF';
  fCtx.fillRect(0, 0, targetWidth, targetHeight);

  if (fitMode === 'cover') {
    fCtx.save();
    fCtx.beginPath();
    fCtx.rect(marginPx, marginPx, printableW, printableH);
    fCtx.clip();
    fCtx.drawImage(preparedSource, drawX, drawY, drawW, drawH);
    fCtx.restore();
  } else {
    fCtx.drawImage(preparedSource, drawX, drawY, drawW, drawH);
  }

  return finalCanvas;
}

export function ditherCanvasThermal(sourceCanvas, targetWidth = 384, options = {}) {
  if (typeof document === 'undefined') return sourceCanvas;

  const {
    algorithm = 'atkinson', // 'atkinson' | 'floyd_steinberg'
    brightness = 22,        // Thermal brightness lift for indoor portraits (+22)
    contrast = 1.15,        // Subtle contrast separation
    gamma = 1.75,          // Inverse gamma curve for thermal dot-gain compensation
    sharpen = true,         // Edge enhancement for facial features & textures
    sharpenAmount = 0.5,
    autoLevel = true
  } = options;

  let canvas = sourceCanvas;
  if (sourceCanvas.width !== targetWidth) {
    const scale = targetWidth / sourceCanvas.width;
    const targetHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
    const scaled = document.createElement('canvas');
    scaled.width = targetWidth;
    scaled.height = targetHeight;
    const sCtx = scaled.getContext('2d');
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    canvas = scaled;
  }

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Luminance grayscale buffer
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    gray[p] = a < 128 ? 255 : (0.299 * r + 0.587 * g + 0.114 * b);
  }

  // 2. Auto-level dynamic range & tone curve (Gamma + Brightness + Contrast)
  let minLum = 255;
  let maxLum = 0;
  if (autoLevel) {
    const step = Math.max(1, Math.floor(gray.length / 500));
    for (let i = 0; i < gray.length; i += step) {
      if (gray[i] < minLum) minLum = gray[i];
      if (gray[i] > maxLum) maxLum = gray[i];
    }
  }

  const diff = maxLum - minLum;
  const useAutoLevel = autoLevel && diff > 40;
  const scale = useAutoLevel ? (255 / diff) : 1;

  for (let i = 0; i < gray.length; i++) {
    let val = useAutoLevel ? (gray[i] - minLum) * scale : gray[i];
    val = (val - 128) * contrast + 128 + brightness;
    val = val < 0 ? 0 : (val > 255 ? 255 : val);
    gray[i] = Math.pow(val / 255, 1 / gamma) * 255;
  }

  // 3. 4-Neighbor Laplacian Unsharp Masking for crisp contours
  if (sharpen) {
    const sharpBuf = new Float32Array(gray.length);
    for (let y = 0; y < h; y++) {
      const yOffset = y * w;
      const prevY = y > 0 ? (y - 1) * w : yOffset;
      const nextY = y + 1 < h ? (y + 1) * w : yOffset;
      for (let x = 0; x < w; x++) {
        const prevX = x > 0 ? x - 1 : x;
        const nextX = x + 1 < w ? x + 1 : x;
        const center = gray[yOffset + x];
        const neighbors = (gray[prevY + x] + gray[nextY + x] + gray[yOffset + prevX] + gray[yOffset + nextX]) * 0.25;
        const val = center + (center - neighbors) * sharpenAmount;
        sharpBuf[yOffset + x] = val < 0 ? 0 : (val > 255 ? 255 : val);
      }
    }
    gray.set(sharpBuf);
  }

  // 4. Halftoning / Error diffusion (Atkinson or Floyd-Steinberg)
  if (algorithm === 'atkinson') {
    // Bill Atkinson dithering (diffuses 6/8 = 75% error, keeping highlights clean and shadows open)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = gray[idx];
        const newVal = oldVal < 128 ? 0 : 255;
        gray[idx] = newVal;
        const err = (oldVal - newVal) >> 3; // err / 8

        if (err !== 0) {
          if (x + 1 < w) gray[idx + 1] += err;
          if (x + 2 < w) gray[idx + 2] += err;
          if (y + 1 < h) {
            if (x - 1 >= 0) gray[(y + 1) * w + (x - 1)] += err;
            gray[(y + 1) * w + x] += err;
            if (x + 1 < w) gray[(y + 1) * w + (x + 1)] += err;
          }
          if (y + 2 < h) {
            gray[(y + 2) * w + x] += err;
          }
        }
      }
    }
  } else {
    // Floyd-Steinberg error diffusion
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = gray[idx];
        const newVal = oldVal < 128 ? 0 : 255;
        gray[idx] = newVal;
        const err = oldVal - newVal;

        if (x + 1 < w) {
          gray[idx + 1] += err * (7 / 16);
        }
        if (y + 1 < h) {
          if (x - 1 >= 0) {
            gray[(y + 1) * w + (x - 1)] += err * (3 / 16);
          }
          gray[(y + 1) * w + x] += err * (5 / 16);
          if (x + 1 < w) {
            gray[(y + 1) * w + (x + 1)] += err * (1 / 16);
          }
        }
      }
    }
  }

  // 5. Write pure monochrome pixels (0 or 255) back to canvas
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = gray[p] < 128 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function ditherCanvasFloydSteinberg(sourceCanvas, targetWidth = 384, options = {}) {
  return ditherCanvasThermal(sourceCanvas, targetWidth, options);
}

export const PRINTER_MODEL_PROFILES = {
  b1_pro: {
    id: 'b1_pro',
    label: 'Niimbot B1 Pro ✨',
    desc: '300 DPI • 567 px • Protocol V4',
    modelId: 4097,
    dpi: 300,
    printheadPixels: 567,
    taskType: 'D110M_V4',
    printDirection: 'top',
    defaultLabelWidthMm: 50,
    defaultLabelHeightMm: 30
  },
  b1: {
    id: 'b1',
    label: 'Niimbot B1',
    desc: '203 DPI • 384 px • Standar',
    modelId: 4096,
    dpi: 203,
    printheadPixels: 384,
    taskType: 'B1',
    printDirection: 'top',
    defaultLabelWidthMm: 50,
    defaultLabelHeightMm: 30
  },
  b21_pro: {
    id: 'b21_pro',
    label: 'Niimbot B21 Pro',
    desc: '300 DPI • 591 px • Protocol V4',
    modelId: 785,
    dpi: 300,
    printheadPixels: 591,
    taskType: 'D110M_V4',
    printDirection: 'top',
    defaultLabelWidthMm: 50,
    defaultLabelHeightMm: 30
  },
  b21: {
    id: 'b21',
    label: 'Niimbot B21 / B21S (V1)',
    desc: '203 DPI • 384 px • Protocol V1',
    modelId: 768,
    dpi: 203,
    printheadPixels: 384,
    taskType: 'B21_V1',
    printDirection: 'top',
    defaultLabelWidthMm: 50,
    defaultLabelHeightMm: 30
  },
  b21s: {
    id: 'b21s',
    label: 'Niimbot B21S',
    desc: '203 DPI • 384 px • Protocol D110',
    modelId: 777,
    dpi: 203,
    printheadPixels: 384,
    taskType: 'D110',
    printDirection: 'top',
    defaultLabelWidthMm: 50,
    defaultLabelHeightMm: 30
  },
  d110: {
    id: 'd110',
    label: 'Niimbot D110 / D11',
    desc: '203 DPI • 384 px • Pocket',
    modelId: 4,
    dpi: 203,
    printheadPixels: 384,
    taskType: 'D110',
    printDirection: 'left',
    defaultLabelWidthMm: 15,
    defaultLabelHeightMm: 30
  },
  escpos: {
    id: 'escpos',
    label: 'Generic ESC/POS',
    desc: '203 DPI • 384 px • POS 58mm',
    modelId: 0,
    dpi: 203,
    printheadPixels: 384,
    taskType: 'escpos',
    printDirection: 'top',
    defaultLabelWidthMm: 58,
    defaultLabelHeightMm: 0
  }
};

export const PRINTER_MODEL_OPTIONS = Object.values(PRINTER_MODEL_PROFILES);

export function getPrinterProfile(presetKey, fallbackDeviceName = '') {
  const upper = (fallbackDeviceName || '').toUpperCase();

  // If specific preset requested
  if (presetKey && PRINTER_MODEL_PROFILES[presetKey]) {
    // If user requested generic b21 preset but device specifically identifies as B21S
    if (presetKey === 'b21' && upper.includes('B21S')) {
      return PRINTER_MODEL_PROFILES.b21s;
    }
    return PRINTER_MODEL_PROFILES[presetKey];
  }

  // Auto-detect from device name
  if (upper.includes('B1 PRO') || upper.includes('B1PRO') || upper.includes('B1_PRO')) {
    return PRINTER_MODEL_PROFILES.b1_pro;
  }
  if (upper.includes('B21 PRO') || upper.includes('B21PRO') || upper.includes('B21_PRO')) {
    return PRINTER_MODEL_PROFILES.b21_pro;
  }
  if (upper.includes('B21S')) {
    return PRINTER_MODEL_PROFILES.b21s;
  }
  if (upper.includes('B21')) {
    return PRINTER_MODEL_PROFILES.b21;
  }
  if (upper.includes('B1')) {
    return PRINTER_MODEL_PROFILES.b1;
  }
  if (upper.includes('D110') || upper.includes('D11')) {
    return PRINTER_MODEL_PROFILES.d110;
  }
  return PRINTER_MODEL_PROFILES.b1_pro;
}

/**
 * Converts any image source (HTMLCanvasElement, HTMLImageElement, Image URL string, Data URI, Blob)
 * into a valid HTMLCanvasElement ready for thermal rendering.
 */
export async function resolveImageToCanvas(imageSource) {
  if (!imageSource) {
    throw new Error('Sumber gambar kosong (tidak ada foto yang akan dicetak).');
  }

  // 1. Already a Canvas or canvas-like object with 2D context
  if (
    (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) ||
    (imageSource && typeof imageSource.getContext === 'function' && typeof imageSource.width === 'number')
  ) {
    return imageSource;
  }

  // Non-browser / Node test environment fallback
  if (typeof document === 'undefined') {
    return imageSource;
  }

  // 2. Already an HTMLImageElement
  if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
    if (!imageSource.complete || !imageSource.naturalWidth) {
      await new Promise((resolve, reject) => {
        imageSource.onload = () => resolve(imageSource);
        imageSource.onerror = () => reject(new Error('Gagal memuat elemen gambar'));
      });
    }
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.naturalWidth || imageSource.width || 384;
    canvas.height = imageSource.naturalHeight || imageSource.height || 384;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  // 3. Blob / File
  if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
    const objectUrl = URL.createObjectURL(imageSource);
    try {
      return await resolveImageToCanvas(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // 4. String (URL / base64 Data URI / Blob URL)
  if (typeof imageSource === 'string') {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        const mockCanvas = document.createElement ? document.createElement('canvas') : { width: 384, height: 384, getContext: () => ({ drawImage: () => {} }) };
        return resolve(mockCanvas);
      }
      const img = new Image();
      if (!imageSource.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 384;
          canvas.height = img.naturalHeight || img.height || 384;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        } catch (err) {
          reject(new Error(`Gagal menggambar citra ke canvas: ${err.message}`));
        }
      };
      img.onerror = () => {
        reject(new Error(`Gagal memuat file gambar dari URL: ${imageSource.slice(0, 80)}...`));
      };
      img.src = imageSource;
    });
  }

  // 5. Duck-typed object with width/height
  if (typeof imageSource === 'object' && (imageSource.width || imageSource.naturalWidth)) {
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.naturalWidth || imageSource.width || 384;
    canvas.height = imageSource.naturalHeight || imageSource.height || 384;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  throw new Error(`Format sumber gambar tidak didukung: ${typeof imageSource}`);
}

export class WebBluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.isConnected = false;
    this.printerName = null;
    this.printerModel = null;
    this.printerModelPreset = 'b1_pro';
    this.printerDpi = 300;
    this.isNiimbot = false;
    this.niimbotClient = null;
    this.printheadPixels = 567;
    this.printTaskType = 'D110M_V4';
  }

  setPrinterModel(presetKey) {
    this.printerModelPreset = presetKey;
    const profile = getPrinterProfile(presetKey, this.printerName);
    this.printerDpi = profile.dpi;
    this.printheadPixels = profile.printheadPixels;
    this.printTaskType = profile.taskType;
    if (this.niimbotClient?.printerInfo && profile.modelId) {
      this.niimbotClient.printerInfo.modelId = profile.modelId;
    }
    return profile;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Request Bluetooth Device and establish GATT / Niimbot connection
   */
  async connect(preferredPreset = null) {
    if (!this.isSupported()) {
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
      if (isIOS) {
        throw new Error('iOS Safari tidak mendukung Web Bluetooth bawaan. Gunakan browser "Bluefy" di iPhone/iPad, atau gunakan mode Browser/Kiosk Print.');
      }
      throw new Error('Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome atau Microsoft Edge via HTTPS.');
    }

    try {
      this.disconnect();
      if (preferredPreset) {
        this.printerModelPreset = preferredPreset;
      }

      // Request device with all required service UUIDs in optionalServices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Niimbot Primary Service
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print Service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
          '0000ff00-0000-1000-8000-00805f9b34fb', // Custom Thermal BLE Service
          '0000fee7-0000-1000-8000-00805f9b34fb'  // Alternative BLE Serial
        ]
      });

      this.device = device;
      this.printerName = device.name || 'Bluetooth Thermal Printer';

      device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.isNiimbot = false;
        this.writeCharacteristic = null;
        this.server = null;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Bluetooth printer disconnected.');
        }
      });

      // 1. Attempt handshake via official Niimbot protocol client
      let niimbotConnected = false;
      try {
        const nbClient = new NiimbotBluetoothClient();
        nbClient.on('error', (err) => {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot background event error:', err);
          }
        });

        await nbClient.connect({ authorizedDevice: device });
        this.niimbotClient = nbClient;
        this.isNiimbot = true;
        this.isConnected = true;
        niimbotConnected = true;

        // Auto-detect profile from preset or device name
        const activeProfile = getPrinterProfile(this.printerModelPreset, this.printerName);

        // Never overwrite modelId if hardware returned a valid positive modelId during initial GATT negotiate
        const hardwareModelId = nbClient.printerInfo?.modelId;
        if (!hardwareModelId || hardwareModelId <= 0) {
          if (activeProfile.modelId) {
            nbClient.printerInfo.modelId = activeProfile.modelId;
          }
        }

        const taskType = nbClient.getPrintTaskType() || activeProfile.taskType || 'B21_V1';
        this.printTaskType = taskType;
        const meta = nbClient.getModelMetadata();
        this.printerModel = meta?.model || activeProfile.label || device.name;
        this.printheadPixels = meta?.printheadPixels || activeProfile.printheadPixels || 384;
        this.printerDpi = meta?.dpi || activeProfile.dpi || 203;
      } catch (nbErr) {
        if (typeof console !== 'undefined' && console.log) {
          console.log('Niimbot handshake skipped/failed, checking generic GATT:', nbErr?.message || nbErr);
        }
      }

      // 2. Fallback to generic ESC/POS characteristic if not a Niimbot
      if (!niimbotConnected) {
        const server = await device.gatt.connect();
        this.server = server;

        const services = await server.getPrimaryServices();
        let targetCharacteristic = null;

        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                targetCharacteristic = char;
                break;
              }
            }
          } catch (_) {}
          if (targetCharacteristic) break;
        }

        if (!targetCharacteristic) {
          throw new Error('GATT write characteristic tidak ditemukan pada perangkat Bluetooth ini.');
        }

        this.writeCharacteristic = targetCharacteristic;
        this.isNiimbot = false;
        this.isConnected = true;
        this.printheadPixels = 384;
        this.printerDpi = 203;
      }

      return {
        success: true,
        name: this.printerName,
        model: this.printerModel,
        type: this.isNiimbot ? 'niimbot' : 'escpos',
        id: device.id,
        dpi: this.printerDpi,
        printheadPixels: this.printheadPixels
      };
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  disconnect() {
    try {
      if (this.niimbotClient) {
        this.niimbotClient.disconnect();
      }
    } catch (_) {}
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (_) {}
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.isConnected = false;
    this.isNiimbot = false;
    this.niimbotClient = null;
  }

  /**
   * Send raw byte buffer to generic thermal printer characteristic with chunking
   */
  async sendData(buffer, chunkSize = 128) {
    if (!this.writeCharacteristic) {
      throw new Error('Printer tidak terhubung atau write characteristic tidak tersedia.');
    }

    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    for (let offset = 0; offset < uint8.length; offset += chunkSize) {
      const chunk = uint8.subarray(offset, Math.min(offset + chunkSize, uint8.length));
      if (this.writeCharacteristic.properties.writeWithoutResponse) {
        await this.writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.writeCharacteristic.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  /**
   * Calibrate / feed paper to the exact die-cut label gap or tear bar
   * Niimbot sends LabelPositioningCalibration command (0x2F / 47)
   */
  async calibrateGap() {
    if (!this.isConnected) {
      throw new Error('Printer Bluetooth belum terhubung. Silakan hubungkan terlebih dahulu.');
    }
    if (this.isNiimbot && this.niimbotClient?.protocol) {
      try {
        await this.niimbotClient.protocol.labelPositioningCalibration(1);
        return { success: true, message: 'Kertas berhasil diposisikan ke celah gap!' };
      } catch (e) {
        try {
          await this.niimbotClient.protocol.printEnd();
          return { success: true, message: 'Kertas berhasil diposisikan ke gap!' };
        } catch (err) {
          throw new Error(`Gagal kalibrasi gap: ${e?.message || err?.message}`);
        }
      }
    }
    return { success: false, message: 'Fitur kalibrasi hanya tersedia untuk printer Niimbot.' };
  }

  /**
   * Print Image Canvas or Image Element directly
   */

    async printImage(imageSource, options = {}, onProgress = null) {
    if (!this.isConnected) {
      throw new Error('Printer Bluetooth belum terhubung.');
    }

    const {
      density = 2,
      brightness = 22,
      contrast = 1.15,
      gamma = 1.75,
      ditherMethod = 'atkinson',
      sharpen = true,
      labelWidthMm = 50,
      labelHeightMm = 30,
      marginMm = 1.5,
      fitMode = 'fit',
      autoRotate = true,
      orientation = 'auto'
    } = options;

    const canvas = await resolveImageToCanvas(imageSource);

    if (this.isNiimbot && this.niimbotClient) {
      try {
        // 1. Pause background heartbeat timer to prevent BLE GATT characteristic collisions
        try {
          this.niimbotClient.stopHeartbeat();
        } catch (_) {}

        // 2. Set generous packet timeout for BLE transmission (5000ms instead of 1000ms default)
        if (this.niimbotClient.protocol) {
          this.niimbotClient.protocol.setPacketTimeout(5000);
        }

        // 3. Resolve active printer profile without destroying genuine hardware modelId
        const activeProfile = getPrinterProfile(options.printerModelPreset || this.printerModelPreset, this.printerName);
        if ((!this.niimbotClient.printerInfo?.modelId || this.niimbotClient.printerInfo?.modelId <= 0) && activeProfile.modelId) {
          this.niimbotClient.printerInfo.modelId = activeProfile.modelId;
        }

        const meta = this.niimbotClient.getModelMetadata();
        const targetPixels = activeProfile.printheadPixels || meta?.printheadPixels || this.printheadPixels || 384;
        const printerDpi = activeProfile.dpi || meta?.dpi || this.printerDpi || 203;
        const dotsPerMm = printerDpi / 25.4;

        // 4. Format canvas to exact label dimensions, orientation & safe margin
        const formattedCanvas = formatCanvasForThermalLabel(canvas, {
          labelWidthMm,
          labelHeightMm,
          marginMm,
          fitMode,
          autoRotate,
          orientation,
          maxPrintheadPixels: targetPixels,
          dotsPerMm
        });

        // 5. Determine effective label type:
        // 1: WithGaps (Label stiker berjarak putih standar)
        // 2: Black (Tanda garis hitam / Black mark)
        // 3: Continuous (Kertas kasir / struk roll)
        // 5: Transparent (Label plastik bening / transparan)
        let effectiveLabelType = Number(options.labelType || 0);
        if (!effectiveLabelType || effectiveLabelType <= 0) {
          const rfidPaperType = this.niimbotClient.rfidInfo?.paperInfo?.paperType;
          if (rfidPaperType) {
            effectiveLabelType = rfidPaperType;
          } else if (Number(labelHeightMm) <= 0) {
            effectiveLabelType = 3;
          } else {
            effectiveLabelType = 1;
          }
        }

        // For transparent stickers (labelType 5), transparent thermal coating requires higher heat
        // Ensure density is at least 3 for transparent stickers to avoid faint/transparent output
        let effectiveDensity = density;
        if (effectiveLabelType === 5 && effectiveDensity < 3) {
          effectiveDensity = 3;
        }

        // 6. Process thermal halftoning
        if (onProgress) onProgress(ditherMethod === 'atkinson' ? 'Memproses rasterisasi foto (Atkinson Halftone)...' : 'Memproses rasterisasi foto (Floyd-Steinberg)...');
        const dithered = ditherCanvasThermal(formattedCanvas, formattedCanvas.width, {
          algorithm: ditherMethod,
          brightness,
          contrast,
          gamma,
          sharpen
        });

        // 7. Initialize Niimbot print task
        const taskType = this.niimbotClient.getPrintTaskType() || activeProfile.taskType || this.printTaskType || 'B21_V1';

        const printTaskOptions = {
          totalPages: 1,
          density: effectiveDensity,
          labelType: effectiveLabelType,
          pageColor: PageColorType.SingleColor,
          statusTimeoutMs: 8000,
          pageTimeoutMs: 25000
        };

        const task = this.niimbotClient.protocol.newPrintTask(taskType, printTaskOptions);

        if (onProgress) onProgress('Menginisialisasi printer Niimbot...');

        // Clean task initialization via task.printInit()
        try {
          await task.printInit();
        } catch (initErr) {
          // Fallback if individual firmware requires direct packets
          try {
            await this.niimbotClient.protocol.send(PacketGenerator.setDensity(effectiveDensity), 2500);
          } catch (_) {}
          try {
            await this.niimbotClient.protocol.send(PacketGenerator.setLabelType(effectiveLabelType), 2500);
          } catch (_) {}
          try {
            if (taskType === 'B1') {
              await this.niimbotClient.protocol.send(PacketGenerator.printStart7b(1, PageColorType.SingleColor), 5000);
            } else if (taskType === 'D110M_V4') {
              await this.niimbotClient.protocol.send(PacketGenerator.printStart9b(1, PageColorType.SingleColor, 1), 5000);
            } else {
              await this.niimbotClient.protocol.send(PacketGenerator.printStart1b(), 5000);
            }
          } catch (_) {}
        }

        // 8. Encode image and send page packets
        if (onProgress) onProgress('Mengirim data cetak ke printer...');
        const printDirection = activeProfile.printDirection || meta?.printDirection || (taskType === 'D110' || taskType === 'D11_V1' ? 'left' : 'top');
        const encoded = ImageEncoder.encodeCanvas(dithered, PageColorType.SingleColor, printDirection);

        // Dynamic page timeout based on row count (at least 35s, allowing ~60ms per row for BLE transfer + thermal burning + paper feed)
        const totalRows = encoded?.rows || 500;
        const dynamicTimeout = Math.max(35000, totalRows * 60);
        task.setPrintOptions({ pageTimeoutMs: dynamicTimeout });

        try {
          await task.printPage(encoded, 1);
        } catch (pageErr) {
          // If timeout occurred specifically waiting for e4 (In_PageEnd ACK):
          // All image bitmap rows were already successfully delivered to the printer printhead,
          // and the printer is physically feeding and burning the paper.
          const errMsg = pageErr?.message || '';
          if (errMsg.includes('waited for e4') || errMsg.includes('e4')) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Niimbot: pageEnd ACK notice (data delivered, printer feeding/finishing):', errMsg);
            }
            if (onProgress) onProgress('Menyelesaikan keluaran kertas...');
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            throw pageErr;
          }
        }

        if (onProgress) onProgress('Menyelesaikan halaman cetak...');
        try {
          // For B21, B21S, D110, and B21L2_B, the printer hardware automatically advances and stops cleanly at the die-cut label gap after pageEnd.
          // Polling status or sending premature printEnd packets during motor feeding interrupts the transmissive gap sensor,
          // triggering re-printing / buffer replay loops or extra blank label feeds.
          // Additionally, B21V1PrintTask.waitForFinished() uses waitUntilPrintFinishedByPrintEndPoll, which cancels its own
          // timer and hangs, followed by a duplicate printEnd that causes double printing.
          // Therefore, B21, B21S, D110, and B21L2_B use a clean 1200ms stabilization delay without active polling or duplicate printEnd.
          if (taskType === 'D110' || taskType === 'B21L2_B' || taskType === 'B21_V1') {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          } else if (typeof task.waitForFinished === 'function') {
            await Promise.race([
              task.waitForFinished(),
              new Promise((resolve) => setTimeout(resolve, 4000))
            ]);
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (waitErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot: status poll notice (paper printing/printed):', waitErr?.message);
          }
        } finally {
          // Critical: Always cancel status poll timer so no background setInterval remains active
          try {
            if (typeof this.niimbotClient?.protocol?.cancelStatusPoll === 'function') {
              this.niimbotClient.protocol.cancelStatusPoll();
            }
          } catch (_) {}
        }

        // Clean task termination & gap advancement
        // - B1 requires protocol.printEnd() to commit buffer and feed to gap
        // - B1 Pro (D110M_V4) sends printEnd via task.printEnd()
        // - B21 / B21S (B21_V1, D110, B21L2_B) automatically complete feed on pageEnd;
        //   sending an explicit printEnd causes firmware buffer replay or extra blank label ejection (double print).
        if (taskType === 'B1') {
          try {
            await this.niimbotClient.protocol.printEnd();
          } catch (_) {}
        } else if (taskType === 'D110M_V4' && typeof task.printEnd === 'function') {
          try {
            await task.printEnd();
          } catch (_) {}
        }

        return { success: true };
      } finally {
        // Always safely resume background heartbeat for printer status & battery
        try {
          if (this.niimbotClient && this.niimbotClient.isConnected()) {
            this.niimbotClient.startHeartbeat();
          }
        } catch (_) {}
      }
    }

    // Fallback: Generic ESC/POS thermal printer
    const formattedCanvas = formatCanvasForThermalLabel(canvas, {
      labelWidthMm,
      labelHeightMm,
      marginMm,
      fitMode,
      autoRotate,
      orientation,
      maxPrintheadPixels: 384
    });
    if (onProgress) onProgress('Memproses cetak ESC/POS...');
    const dithered = ditherCanvasThermal(formattedCanvas, formattedCanvas.width, {
      algorithm: ditherMethod,
      brightness,
      contrast,
      gamma,
      sharpen
    });
    const printCommands = this.rasterizeCanvasToEscPos(dithered);
    await this.sendData(printCommands);
    return { success: true };
  }

  rasterizeCanvasToEscPos(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height).data;

    const widthBytes = Math.ceil(width / 8);
    const commands = [];

    // Initialize Printer ESC @
    commands.push(0x1B, 0x40);

    // ESC/POS GS v 0 (Raster bit image)
    commands.push(0x1D, 0x76, 0x30, 0x00);
    commands.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF);
    commands.push(height & 0xFF, (height >> 8) & 0xFF);

    for (let y = 0; y < height; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
          const x = xByte * 8 + b;
          if (x < width) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx];
            // Black pixel if red < 128
            if (r < 128) {
              byteVal |= (1 << (7 - b));
            }
          }
        }
        commands.push(byteVal);
      }
    }

    // Feed and Cut commands
    commands.push(0x1B, 0x64, 0x03); // Feed 3 lines
    commands.push(0x1D, 0x56, 0x41, 0x00); // Cut paper (if supported)

    return new Uint8Array(commands);
  }
}

export const bluetoothPrinter = new WebBluetoothPrinter();
