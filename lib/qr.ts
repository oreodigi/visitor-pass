import QRCode from 'qrcode';

// ── Generate QR as Data URL ───────────────────────────────
// Returns a base64-encoded PNG data URL suitable for <img src>.
// Used on the public pass page to render the QR code inline.
// No server-side file storage needed — generated dynamically.

export async function generateQrDataUrl(text: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1c1917',  // stone-900
      light: '#ffffff',
    },
  });
  return dataUrl;
}

// ── Generate QR as SVG string ─────────────────────────────
// Alternative for SSR or situations where SVG is preferred.

export async function generateQrSvg(text: string): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1c1917',
      light: '#ffffff',
    },
  });
  return svg;
}
