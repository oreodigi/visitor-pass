// ── WhatsApp message builders + wa.me link helpers ────────
// Supports both hardcoded defaults and custom templates stored in the DB.
// Custom templates use {{variable}} placeholders.

export interface EventContext {
  title?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  support_contact_number?: string;
  // Custom templates (loaded from events table)
  invite_message_template?: string | null;
  pass_message_template?: string | null;
}

// ── Formatting helpers ─────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

function fmtTime(start?: string, end?: string): string {
  if (!start) return '';
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function toInternational(mobile: string): string {
  return `91${mobile}`;
}

// ── Template variable renderer ─────────────────────────────
// Replaces {{variable}} tokens in a custom template string.

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Invite message ─────────────────────────────────────────

export const DEFAULT_INVITE_TEMPLATE = [
  'Hello 👋',
  '',
  "You're invited to attend:",
  '',
  '*{{event}}*',
  '',
  '📅 Date: {{date}}',
  '📍 Venue: {{venue}}',
  '',
  'To confirm your participation, please fill this form:',
  '{{link}}',
  '',
  'Kindly complete it to receive your entry pass.',
].join('\n');

export function buildInviteMessage(
  inviteLink: string,
  ctx?: EventContext,
): string {
  const vars: Record<string, string> = {
    event: ctx?.title      || 'Our Event',
    date:  fmtDate(ctx?.event_date),
    venue: ctx?.venue_name || '',
    link:  inviteLink,
  };

  const template = ctx?.invite_message_template?.trim() || DEFAULT_INVITE_TEMPLATE;

  // If template has no date/venue lines and those are empty, clean up
  return renderTemplate(template, vars);
}

// ── Pass / Confirmation message ────────────────────────────

export const DEFAULT_PASS_TEMPLATE = [
  'Hello {{name}} 👋',
  '',
  'Your participation is confirmed.',
  '',
  '🎫 *Your Event Pass*',
  '📅 Date: {{date}}',
  '⏰ Time: {{time}}',
  '📍 Venue: {{venue}}',
  '🪑 Seat No: {{seat}}',
  '',
  'Please show this QR pass at entry:',
  '{{link}}',
  '',
  'For assistance: {{support}}',
].join('\n');

export function buildPassMessage(
  name: string,
  passLink: string,
  seatNumber: string,
  ctx?: EventContext,
): string {
  const vars: Record<string, string> = {
    name:    name || 'Participant',
    event:   ctx?.title      || 'Our Event',
    date:    fmtDate(ctx?.event_date),
    time:    fmtTime(ctx?.start_time, ctx?.end_time),
    venue:   ctx?.venue_name || '',
    seat:    seatNumber,
    link:    passLink,
    support: ctx?.support_contact_number || '',
  };

  const template = ctx?.pass_message_template?.trim() || DEFAULT_PASS_TEMPLATE;
  return renderTemplate(template, vars);
}

// ── WhatsApp Web link builders ─────────────────────────────

export function buildInviteWhatsAppLink(
  mobile: string,
  inviteLink: string,
  ctx?: EventContext,
): string {
  const message = buildInviteMessage(inviteLink, ctx);
  return `https://wa.me/${toInternational(mobile)}?text=${encodeURIComponent(message)}`;
}

export function buildPassWhatsAppLink(
  mobile: string,
  name: string,
  passLink: string,
  seatNumber: string,
  ctx?: EventContext,
): string {
  const message = buildPassMessage(name, passLink, seatNumber, ctx);
  return `https://wa.me/${toInternational(mobile)}?text=${encodeURIComponent(message)}`;
}
