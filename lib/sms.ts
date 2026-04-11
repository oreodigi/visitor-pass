import { normalizePublicUrl } from '@/lib/app-url';

export type SmsEventContext = {
  title: string;
  event_date?: string;
  venue_name?: string;
};

export function buildPassSmsMessage(input: {
  event: SmsEventContext;
  passUrl: string;
}) {
  const title = input.event.title || 'the event';
  const passUrl = normalizePublicUrl(input.passUrl);

  return [
    `Thank you for registering for ${title}.`,
    `Your invitation pass: ${passUrl}`,
    'Please show this pass at entry.',
    'Powered by Rimacle TMS',
  ].join('\n');
}
