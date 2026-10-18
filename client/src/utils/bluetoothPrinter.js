/**
 * bluetoothPrinter.js
 * Web Bluetooth API Manager for Photobooth Direct Kiosk Printing
 *
 * Supports Bluetooth Thermal/Photo Printers (Niimbot, ESC/POS, CPCL, Generic BLE Printers)
 * Standard Bluetooth GATT Service UUIDs for Printers:
 * - 0x18F0 (Standard Mobile Printing Service)
 * - 000018f0-0000-1000-8000-00805f9b34fb
 * - 49535343-fe7d-4ae5-8fa9-9fafd205e455 (ISSC Proprietary / Common BLE Serial)
 * - 0000e781-0000-1000-8000-00805f9b34fb (Niimbot / OEM Custom Service)
 * - 0000ff00-0000-1000-8000-00805f9b34fb (Generic Serial Transmit)
 */

class WebBluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.isConnected = false;
    this.printerName = null;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Request Bluetooth Device and establish GATT connection
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
      // Disconnect existing if any
      if (this.device && this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }

      // Request device with printer service filters & optional common UUIDs
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print Service
          '0000e781-0000-1000-8000-00805f9b34fb', // Niimbot Service
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
      });

      const server = await device.gatt.connect();
      this.server = server;

      // Find writable characteristic across available services
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
      this.isConnected = true;

      return {
        success: true,
        name: this.printerName,
        id: device.id
      };
    } catch (err) {
      this.isConnected = false;
      this.server = null;
      this.writeCharacteristic = null;
      throw err;
    }
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.server = null;
    this.writeCharacteristic = null;
  }

  /**
   * Send chunks of binary data to the Bluetooth printer
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
      // Brief delay to prevent BLE RX buffer overflow
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * Converts a canvas or image URL to binary bitmap format and prints
   */
  async printImage(imageUrlOrCanvas) {
    if (!this.isConnected) {
      await this.connect();
    }

    let canvas;
    if (typeof HTMLCanvasElement !== 'undefined' && imageUrlOrCanvas instanceof HTMLCanvasElement) {
      canvas = imageUrlOrCanvas;
    } else {
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

    // Generate ESC/POS or Raster print command stream
    const printCommands = this.rasterizeCanvasToEscPos(canvas);
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

    // Monochrome threshold dithering
    for (let y = 0; y < height; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
          const x = xByte * 8 + b;
          if (x < width) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const bVal = imgData[idx + 2];
            const a = imgData[idx + 3];
            // Luminance
            const luminance = a < 128 ? 255 : (0.299 * r + 0.587 * g + 0.114 * bVal);
            if (luminance < 128) {
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
