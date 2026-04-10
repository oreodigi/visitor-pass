import { normalizeMobile } from './utils';

export interface CloudTemplateVars {
  event?: string;
  date?: string;
  venue?: string;
  link?: string;
}

interface CloudSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

function getApiVersion() {
  return process.env.WHATSAPP_CLOUD_API_VERSION || 'v21.0';
}

function toInternationalMobile(raw: string) {
  const normalized = normalizeMobile(raw);
  return normalized.length === 10 ? `91${normalized}` : raw.replace(/\D/g, '');
}

function getTemplateParamOrder() {
  return (process.env.WHATSAPP_CLOUD_TEMPLATE_PARAM_ORDER || 'event,date,venue,link')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as Array<keyof CloudTemplateVars>;
}

function buildTemplatePayload(to: string, vars?: CloudTemplateVars) {
  const templateName = process.env.WHATSAPP_CLOUD_TEMPLATE_NAME;
  if (!templateName) return null;

  const parameters = getTemplateParamOrder().map((key) => ({
    type: 'text',
    text: vars?.[key] || '',
  }));

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: process.env.WHATSAPP_CLOUD_TEMPLATE_LANGUAGE || 'en_US',
      },
      components: parameters.length > 0
        ? [{ type: 'body', parameters }]
        : undefined,
    },
  };
}

function buildTextPayload(to: string, message: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: true,
      body: message,
    },
  };
}

function readCloudConfig() {
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    return {
      error: 'WhatsApp Cloud API credentials are missing. Configure WHATSAPP_CLOUD_PHONE_NUMBER_ID and WHATSAPP_CLOUD_ACCESS_TOKEN in Vercel.',
    };
  }
  return { phoneNumberId, accessToken };
}

export async function sendCloudWhatsAppMessage(
  mobile: string,
  message: string,
  vars?: CloudTemplateVars,
): Promise<CloudSendResult> {
  const config = readCloudConfig();
  if ('error' in config) return { success: false, error: config.error };

  const to = toInternationalMobile(mobile);
  const payload = buildTemplatePayload(to, vars) ?? buildTextPayload(to, message);
  const endpoint = `https://graph.facebook.com/${getApiVersion()}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const metaMessage = data?.error?.message || data?.error?.error_data?.details;
      return { success: false, error: metaMessage || `Cloud API failed with HTTP ${response.status}` };
    }

    return {
      success: true,
      providerMessageId: data?.messages?.[0]?.id,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Cloud API request failed' };
  }
}
