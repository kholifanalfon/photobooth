/**
 * bluetoothPrinter.js
 * Web Bluetooth API Manager for Photobooth Direct Kiosk Printing
 *
 * Supports:
 * - Native NIIMBOT Bluetooth Printers (B21S, B21, B21 Pro, B1, D11, D110, B3S, etc.) via @mmote/niimbluelib
 * - Generic ESC/POS / BLE Serial Thermal Printers as fallback
 * - High-detail Floyd-Steinberg error diffusion dithering for photographic thermal printing
 */

import { NiimbotBluetoothClient, ImageEncoder, PageColorType, PacketGenerator } from '@mmote/niimbluelib';

/**
 * Floyd-Steinberg error diffusion dithering
 * Converts any canvas into a clean, photographic 1-bit monochrome canvas (pure 0x000000 black & 0xFFFFFF white).
 */
/**
 * Advanced Thermal Halftoning Pipeline with Dot-Gain Compensation,
 * Gamma Correction, Dynamic Range Optimization, Edge Sharpening,
 * and Atkinson / Floyd-Steinberg Error Diffusion.
 * Specially designed for 203 DPI thermal printers (Niimbot B21/B21S, D110, ESC/POS).
 */
/**
 * Formats, scales, crops, rotates and adds safe margins to any source canvas
 * to match the exact physical die-cut label sticker or continuous roll of a thermal printer.
 */
export function formatCanvasForThermalLabel(sourceCanvas, options = {}) {
  if (typeof document === 'undefined') return sourceCanvas;

  const {
    labelWidthMm = 50,
    labelHeightMm = 30,
    marginMm = 1.5,
    fitMode = 'fit',
    autoRotate = true,
    maxPrintheadPixels = 384,
    dotsPerMm = 8
  } = options;

  const targetWidth = Math.min(maxPrintheadPixels, Math.round((Number(labelWidthMm) || 50) * dotsPerMm) || 384);
  const isContinuous = !labelHeightMm || Number(labelHeightMm) <= 0;

  let srcW = sourceCanvas.width;
  let srcH = sourceCanvas.height;

  // Determine if rotation will significantly better fill the target sticker orientation
  let shouldRotate = false;
  if (autoRotate && !isContinuous) {
    const isSrcPortrait = srcH > srcW;
    const isDstLandscape = targetWidth > (Number(labelHeightMm) * dotsPerMm);
    if ((isSrcPortrait && isDstLandscape) || (!isSrcPortrait && !isDstLandscape)) {
      shouldRotate = true;
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

  // Margin calculation
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

  // 3. 4-Neighbor Laplacian Unsharp Masking for crisp contours on 203 DPI
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

export class WebBluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.isConnected = false;
    this.printerName = null;
    this.printerModel = null;
    this.isNiimbot = false;
    this.niimbotClient = null;
    this.printheadPixels = 384;
    this.printTaskType = 'D110';
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Request Bluetooth Device and establish GATT / Niimbot connection
   */
  async connect() {
    if (!this.isSupported()) {
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
      if (isIOS) {
        throw new Error('iOS Safari tidak mendukung Web Bluetooth bawaan. Gunakan browser "Bluefy" di iPhone/iPad, atau gunakan mode Browser/Kiosk Print.');
      }
      throw new Error('Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome atau Microsoft Edge via HTTPS.');
    }

    try {
      this.disconnect();

      // Request device with all required service UUIDs in optionalServices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Niimbot Primary Service
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print Service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
          '0000ff00-0000-1000-8000-00805f9b34fb', // Common BLE Serial
          '0000fee7-0000-1000-8000-00805f9b34fb'  // Tencent/WeChat BLE Hardware
        ]
      });

      this.device = device;
      this.printerName = device.name || 'Bluetooth Printer';

      device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.server = null;
        this.writeCharacteristic = null;
        if (this.niimbotClient) {
          try { this.niimbotClient.disconnect(); } catch (_) {}
        }
      });

      // 1. Try Niimbot client connection first
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

        // Auto-assign model ID fallback if omitted by printer response
        if (!nbClient.printerInfo?.modelId) {
          const upperName = (this.printerName || '').toUpperCase();
          if (upperName.includes('B21S')) {
            nbClient.printerInfo.modelId = 777; // B21S
          } else if (upperName.includes('B21')) {
            nbClient.printerInfo.modelId = 768; // B21
          } else if (upperName.includes('B1')) {
            nbClient.printerInfo.modelId = 4096; // B1
          }
        }

        const taskType = nbClient.getPrintTaskType();
        this.printTaskType = taskType || 'D110';
        const meta = nbClient.getModelMetadata();
        this.printerModel = meta?.model || device.name;
        this.printheadPixels = meta?.printheadPixels || 384;
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
      }

      return {
        success: true,
        name: this.printerName,
        model: this.printerModel,
        type: this.isNiimbot ? 'niimbot' : 'escpos',
        id: device.id
      };
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  disconnect() {
    if (this.niimbotClient) {
      try { this.niimbotClient.disconnect(); } catch (_) {}
      this.niimbotClient = null;
    }
    if (this.device && this.device.gatt?.connected) {
      try { this.device.gatt.disconnect(); } catch (_) {}
    }
    this.isConnected = false;
    this.server = null;
    this.writeCharacteristic = null;
    this.isNiimbot = false;
  }

  /**
   * Send chunks of binary data to generic Bluetooth printer (ESC/POS fallback)
   */
  async sendData(dataBuffer, chunkSize = 128) {
    if (!this.isConnected || !this.writeCharacteristic) {
      throw new Error('Printer Bluetooth belum terhubung.');
    }

    const uint8 = new Uint8Array(dataBuffer);
    for (let offset = 0; offset < uint8.length; offset += chunkSize) {
      const chunk = uint8.slice(offset, offset + chunkSize);
      if (this.writeCharacteristic.writeValueWithoutResponse) {
        await this.writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.writeCharacteristic.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * Converts a canvas or image URL to binary bitmap format and prints
   */
  async printImage(imageUrlOrCanvas, options = {}) {
    const {
      onProgress = null,
      density = 2,
      labelType = 1,
      ditherMethod = 'atkinson',
      brightness = 22,
      contrast = 1.15,
      gamma = 1.75,
      sharpen = true,
      labelWidthMm = 50,
      labelHeightMm = 30,
      marginMm = 1.5,
      fitMode = 'fit',
      autoRotate = true
    } = options;

    if (!this.isConnected) {
      if (onProgress) onProgress('Menyambungkan printer Bluetooth...');
      await this.connect();
    }

    let canvas;
    if (typeof HTMLCanvasElement !== 'undefined' && imageUrlOrCanvas instanceof HTMLCanvasElement) {
      canvas = imageUrlOrCanvas;
    } else {
      if (typeof document === 'undefined') {
        throw new Error('Canvas not available in current environment');
      }
      canvas = document.createElement('canvas');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrlOrCanvas;
      });
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
    }

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

        // 3. Ensure fallback modelId
        if (!this.niimbotClient.printerInfo?.modelId) {
          const upperName = (this.printerName || '').toUpperCase();
          if (upperName.includes('B21S')) {
            this.niimbotClient.printerInfo.modelId = 777;
          } else if (upperName.includes('B21')) {
            this.niimbotClient.printerInfo.modelId = 768;
          }
        }

        // 4. Format canvas to exact label dimensions, orientation & safe margin
        const targetPixels = this.niimbotClient.getModelMetadata()?.printheadPixels || this.printheadPixels || 384;
        const formattedCanvas = formatCanvasForThermalLabel(canvas, {
          labelWidthMm,
          labelHeightMm,
          marginMm,
          fitMode,
          autoRotate,
          maxPrintheadPixels: targetPixels
        });

        // 5. Process thermal halftoning
        if (onProgress) onProgress(ditherMethod === 'atkinson' ? 'Memproses rasterisasi foto (Atkinson Halftone)...' : 'Memproses rasterisasi foto (Floyd-Steinberg)...');
        const dithered = ditherCanvasThermal(formattedCanvas, formattedCanvas.width, {
          algorithm: ditherMethod,
          brightness,
          contrast,
          gamma,
          sharpen
        });

        // 6. Initialize Niimbot print task
        const taskType = this.niimbotClient.getPrintTaskType() || this.printTaskType || 'D110';
        const detectedLabelType = (Number(labelHeightMm) <= 0) ? 3 : 1;
        const effectiveLabelType = this.niimbotClient.printerInfo?.labelType ?? detectedLabelType;

        const task = this.niimbotClient.protocol.newPrintTask(taskType, {
          totalPages: 1,
          density,
          labelType: effectiveLabelType,
          pageTimeoutMs: 15000,
          statusTimeoutMs: 8000
        });

        if (onProgress) onProgress('Menginisialisasi printer Niimbot...');

        // Safe density setting: some firmware revisions do not reply to 0x21 (setDensity) with 0x31.
        // We catch this error safely so it does not abort the print job.
        try {
          await this.niimbotClient.protocol.send(PacketGenerator.setDensity(density), 2500);
        } catch (densErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot: setDensity skipped or not acknowledged by firmware:', densErr?.message);
          }
        }

        // Safe label type setting
        try {
          await this.niimbotClient.protocol.send(PacketGenerator.setLabelType(effectiveLabelType), 2500);
        } catch (ltErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot: setLabelType skipped or not acknowledged:', ltErr?.message);
          }
        }

        // Print start command
        try {
          if (taskType === 'B1') {
            await this.niimbotClient.protocol.send(PacketGenerator.printStart7b(1, PageColorType.SingleColor), 5000);
          } else {
            await this.niimbotClient.protocol.send(PacketGenerator.printStart1b(), 5000);
          }
        } catch (startErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot: printStart direct packet note, attempting task.printInit fallback:', startErr?.message);
          }
          try {
            await task.printInit();
          } catch (initErr) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('task.printInit fallback note:', initErr?.message);
            }
          }
        }

        // 6. Encode image and send page packets
        if (onProgress) onProgress('Mengirim data cetak ke printer...');
        const encoded = ImageEncoder.encodeCanvas(dithered, PageColorType.SingleColor, 'top');

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
          if (typeof task.waitForFinished === 'function') {
            await Promise.race([
              task.waitForFinished(),
              new Promise((resolve) => setTimeout(resolve, 8000))
            ]);
          }
        } catch (waitErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Niimbot: status poll notice (paper printing/printed):', waitErr?.message);
          }
        }

        try {
          await this.niimbotClient.protocol.printEnd();
        } catch (_) {}

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
