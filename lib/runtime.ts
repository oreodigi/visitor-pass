export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

export function isWhatsAppEnabled(): boolean {
  if (isVercelRuntime()) return false;
  return process.env.WHATSAPP_ENABLED !== 'false';
}

export function getWhatsAppRuntimeBlockReason(): string | null {
  if (isVercelRuntime()) {
    return 'WhatsApp Web cannot run on Vercel serverless. Move this worker to your VPS or persistent Node server.';
  }

  if (!isWhatsAppEnabled()) {
    return 'WhatsApp worker is disabled on this server. Set WHATSAPP_ENABLED=true, or remove WHATSAPP_ENABLED=false, then restart the app.';
  }

  return null;
}
