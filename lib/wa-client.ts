// WhatsApp Web client singleton
// Uses whatsapp-web.js (Puppeteer + WhatsApp Web) for automated sending.
// Runs as a persistent Node.js global — survives API request cycles.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client, LocalAuth } = require('whatsapp-web.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode');

export type WaStatus =
  | 'idle'
  | 'initializing'
  | 'qr_ready'
  | 'authenticated'
  | 'ready'
  | 'disconnected';

interface WaGlobal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any | null;
  status: WaStatus;
  qrDataUrl: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __wa: WaGlobal | undefined;
}

function g(): WaGlobal {
  if (!global.__wa) {
    global.__wa = { client: null, status: 'idle', qrDataUrl: null };
  }
  return global.__wa;
}

export function getWaStatus(): { status: WaStatus; qrDataUrl: string | null } {
  const s = g();
  return { status: s.status, qrDataUrl: s.qrDataUrl };
}

export function initWaClient(): void {
  const s = g();
  if (s.status === 'ready' || s.status === 'initializing' || s.status === 'qr_ready' || s.status === 'authenticated') {
    return; // already in progress
  }

  s.status = 'initializing';
  s.qrDataUrl = null;

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', async (qr: string) => {
    s.status = 'qr_ready';
    s.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 256 });
    console.log('[WA] QR code ready — scan with WhatsApp');
  });

  client.on('authenticated', () => {
    s.status = 'authenticated';
    s.qrDataUrl = null;
    console.log('[WA] Authenticated');
  });

  client.on('ready', () => {
    s.status = 'ready';
    s.qrDataUrl = null;
    console.log('[WA] Client ready to send');
  });

  client.on('disconnected', (reason: string) => {
    console.log('[WA] Disconnected:', reason);
    s.status = 'disconnected';
    s.qrDataUrl = null;
    s.client = null;
  });

  // Fire-and-forget — don't await; events drive state updates
  client.initialize().catch((err: Error) => {
    console.error('[WA] Initialize error:', err.message);
    s.status = 'disconnected';
  });

  s.client = client;
}

export async function disconnectWaClient(): Promise<void> {
  const s = g();
  if (s.client) {
    try { await s.client.destroy(); } catch { /* ignore */ }
  }
  s.client = null;
  s.status = 'idle';
  s.qrDataUrl = null;
}

export async function sendWaMessage(
  mobile: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const s = g();
  if (!s.client || s.status !== 'ready') {
    return { success: false, error: 'WhatsApp not connected' };
  }
  try {
    const chatId = `91${mobile}@c.us`;
    await s.client.sendMessage(chatId, message);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[WA] sendMessage error:', msg);
    return { success: false, error: msg };
  }
}
