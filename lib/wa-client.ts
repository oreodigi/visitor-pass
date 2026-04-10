// WhatsApp Web client singleton
// Uses whatsapp-web.js (Puppeteer + WhatsApp Web) for automated sending.
// Runs as a persistent Node.js global — survives API request cycles.

import { getWhatsAppProvider, getWhatsAppRuntimeBlockReason, type WhatsAppProvider } from './runtime';
import { sendCloudWhatsAppMessage, type CloudTemplateVars } from './wa-cloud';

export type WaStatus =
  | 'idle'
  | 'disabled'
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
  reason?: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __wa: WaGlobal | undefined;
}

function g(): WaGlobal {
  if (!global.__wa) {
    global.__wa = { client: null, status: 'idle', qrDataUrl: null, reason: null };
  }
  return global.__wa;
}

export function getWaStatus(): { status: WaStatus; qrDataUrl: string | null; reason?: string | null; provider: WhatsAppProvider } {
  const s = g();
  const blockedReason = getWhatsAppRuntimeBlockReason();
  const provider = getWhatsAppProvider();
  if (blockedReason) {
    s.status = 'disabled';
    s.reason = blockedReason;
    s.qrDataUrl = null;
  } else if (provider === 'cloud_api') {
    s.status = 'ready';
    s.reason = 'WhatsApp Cloud API is configured for Vercel-safe sending.';
    s.qrDataUrl = null;
  }
  return { status: s.status, qrDataUrl: s.qrDataUrl, reason: s.reason ?? null, provider };
}

export function initWaClient(): void {
  const s = g();
  const blockedReason = getWhatsAppRuntimeBlockReason();
  const provider = getWhatsAppProvider();
  if (blockedReason) {
    s.status = 'disabled';
    s.reason = blockedReason;
    s.qrDataUrl = null;
    s.client = null;
    throw new Error(blockedReason);
  }
  if (provider === 'cloud_api') {
    s.status = 'ready';
    s.reason = 'WhatsApp Cloud API is ready. No QR scan is required.';
    s.qrDataUrl = null;
    s.client = null;
    return;
  }
  if (s.status === 'ready' || s.status === 'initializing' || s.status === 'qr_ready' || s.status === 'authenticated') {
    return; // already in progress
  }

  s.status = 'initializing';
  s.qrDataUrl = null;
  s.reason = null;

  // Lazy-load heavy runtime deps only when this worker is actually allowed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client, LocalAuth } = require('whatsapp-web.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const QRCode = require('qrcode');

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
  s.status = getWhatsAppRuntimeBlockReason() ? 'disabled' : getWhatsAppProvider() === 'cloud_api' ? 'ready' : 'idle';
  s.qrDataUrl = null;
  s.reason = getWhatsAppRuntimeBlockReason();
}

export async function sendWaMessage(
  mobile: string,
  message: string,
  templateVars?: CloudTemplateVars,
): Promise<{ success: boolean; error?: string }> {
  const s = g();
  const blockedReason = getWhatsAppRuntimeBlockReason();
  if (blockedReason) {
    s.status = 'disabled';
    s.reason = blockedReason;
    return { success: false, error: blockedReason };
  }
  if (getWhatsAppProvider() === 'cloud_api') {
    return sendCloudWhatsAppMessage(mobile, message, templateVars);
  }
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
