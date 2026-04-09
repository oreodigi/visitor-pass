// ── WhatsApp message builders + wa.me link helpers ────────
// Used for both manual (admin clicks link) and automated bulk send.

export interface EventContext {
  title?: string;
  event_date?: string;   // raw e.g. "2026-04-15"
  start_time?: string;   // raw e.g. "10:00"
  end_time?: string;     // raw e.g. "17:00"
  venue_name?: string;
  support_contact_number?: string;
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

// ── Message templates ──────────────────────────────────────

export function buildInviteMessage(
  inviteLink: string,
  ctx?: EventContext,
): string {
  const title    = ctx?.title      || 'Our Event';
  const date     = fmtDate(ctx?.event_date);
  const venue    = ctx?.venue_name || '';

  return [
    'Hello 👋',
    '',
    "You're invited to attend:",
    '',
    `*${title}*`,
    '',
    ...(date  ? [`📅 Date: ${date}`]  : []),
    ...(venue ? [`📍 Venue: ${venue}`] : []),
    '',
    'To confirm your participation, please fill this form:',
    inviteLink,
    '',
    'Kindly complete it to receive your entry pass.',
  ].join('\n');
}

export function buildPassMessage(
  name: string,
  passLink: string,
  seatNumber: string,
  ctx?: EventContext,
): string {
  const displayName = name || 'Participant';
  const date        = fmtDate(ctx?.event_date);
  const time        = fmtTime(ctx?.start_time, ctx?.end_time);
  const venue       = ctx?.venue_name || '';
  const support     = ctx?.support_contact_number || '';

  return [
    `Hello ${displayName} 👋`,
    '',
    'Your participation is confirmed.',
    '',
    '🎫 *Your Event Pass*',
    ...(date  ? [`📅 Date: ${date}`]        : []),
    ...(time  ? [`⏰ Time: ${time}`]        : []),
    ...(venue ? [`📍 Venue: ${venue}`]      : []),
    `🪑 Seat No: ${seatNumber}`,
    '',
    'Please show this QR pass at entry:',
    passLink,
    ...(support ? ['', `For assistance: ${support}`] : []),
  ].join('\n');
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
