export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

export type WhatsAppProvider = 'web';

export function getWhatsAppProvider(): WhatsAppProvider {
  return 'web';
}

export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED !== 'false';
}

export function getWhatsAppRuntimeBlockReason(): string | null {
  if (!isWhatsAppEnabled()) {
    return 'WhatsApp worker is disabled on this server. Set WHATSAPP_ENABLED=true, or remove WHATSAPP_ENABLED=false, then restart the app.';
  }

  if (isVercelRuntime()) {
    return 'WhatsApp Web cannot run inside Vercel serverless. Use `npm run wa:send -- --event-id <event_id>` on a local machine or persistent server.';
  }

  return null;
}
