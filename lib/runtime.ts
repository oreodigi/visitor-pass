export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

export type WhatsAppProvider = 'web' | 'cloud_api';

export function getWhatsAppProvider(): WhatsAppProvider {
  const configured = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (configured === 'web') return 'web';
  if (configured === 'cloud' || configured === 'cloud_api' || configured === 'meta') return 'cloud_api';
  return isVercelRuntime() ? 'cloud_api' : 'web';
}

export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED !== 'false';
}

export function getWhatsAppCloudMissingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID) missing.push('WHATSAPP_CLOUD_PHONE_NUMBER_ID');
  if (!process.env.WHATSAPP_CLOUD_ACCESS_TOKEN) missing.push('WHATSAPP_CLOUD_ACCESS_TOKEN');
  return missing;
}

export function getWhatsAppRuntimeBlockReason(): string | null {
  if (!isWhatsAppEnabled()) {
    return 'WhatsApp worker is disabled on this server. Set WHATSAPP_ENABLED=true, or remove WHATSAPP_ENABLED=false, then restart the app.';
  }

  if (getWhatsAppProvider() === 'cloud_api') {
    const missing = getWhatsAppCloudMissingConfig();
    if (missing.length > 0) {
      return `WhatsApp Cloud API is not configured. Add ${missing.join(', ')} in Vercel environment variables.`;
    }
    return null;
  }

  if (isVercelRuntime()) {
    return 'WhatsApp Web cannot run on Vercel serverless. Set WHATSAPP_PROVIDER=cloud_api and configure Meta WhatsApp Cloud API credentials.';
  }

  return null;
}
