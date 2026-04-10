export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === 'true';
}

export function getWhatsAppRuntimeBlockReason(): string | null {
  if (!isWhatsAppEnabled()) {
    return 'WhatsApp worker is disabled. Set WHATSAPP_ENABLED=true only on a persistent server.';
  }

  if (isVercelRuntime()) {
    return 'WhatsApp Web cannot run on Vercel serverless. Move this worker to a VPS or persistent Node server.';
  }

  return null;
}
