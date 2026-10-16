const QRCode = require('qrcode');

async function generateQrDataUri(url) {
  if (!url) throw new Error('URL is required for QR generation');
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });
}

module.exports = { generateQrDataUri };
