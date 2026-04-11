import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth } = pkg;

const DEFAULTS = {
  mode: 'invites',
  minDelay: 45,
  maxDelay: 90,
  batchSize: 15,
  batchBreak: 300,
  countryCode: '91',
  limit: 0,
  dryRun: false,
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs() {
  const args = { ...DEFAULTS };
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i += 1) {
    const arg = raw[i];
    const next = raw[i + 1];
    if (arg === '--event-id') args.eventId = next, i += 1;
    else if (arg === '--mode') args.mode = next, i += 1;
    else if (arg === '--min-delay') args.minDelay = Number(next), i += 1;
    else if (arg === '--max-delay') args.maxDelay = Number(next), i += 1;
    else if (arg === '--batch-size') args.batchSize = Number(next), i += 1;
    else if (arg === '--batch-break') args.batchBreak = Number(next), i += 1;
    else if (arg === '--country-code') args.countryCode = String(next || '91').replace(/\D/g, ''), i += 1;
    else if (arg === '--limit') args.limit = Number(next), i += 1;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`
WhatsApp Web batch sender

Usage:
  npm run wa:send -- --event-id EVENT_ID
  npm run wa:send -- --event-id EVENT_ID --mode passes

Options:
  --mode invites|passes       Send invitations or generated pass links. Default: invites
  --min-delay 45              Minimum delay between messages in seconds
  --max-delay 90              Maximum delay between messages in seconds
  --batch-size 15             Messages per batch
  --batch-break 300           Break between batches in seconds
  --limit 25                  Optional max records to send
  --country-code 91           Country code for WhatsApp chat IDs
  --dry-run                   Print messages without sending
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minSeconds, maxSeconds) {
  const min = Math.max(1, Math.floor(minSeconds));
  const max = Math.max(min, Math.floor(maxSeconds));
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function fmtTime(start, end) {
  if (!start) return '';
  const fmt = (value) => {
    const [h, m] = value.split(':').map(Number);
    return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function normalizeTermsList(value) {
  if (!value?.trim()) return [];
  const rawLines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numberedOrBulleted = value.split(/(?=\s*(?:\d+[\).]|[-*])\s+)/g).map((line) => line.trim()).filter(Boolean);
  const sentenceSplit = value.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((line) => line.trim()).filter(Boolean);
  const sourceLines = rawLines.length > 1 ? rawLines : numberedOrBulleted.length > 1 ? numberedOrBulleted : sentenceSplit;
  return sourceLines
    .map((line) => {
      let cleaned = line.replace(/^(?:\d+[\).]\s*|[-*]\s+)/, '').trim();
      const markdownHeading = cleaned.match(/^\*([^*]+)\*\s*(:?)\s*$/);
      if (markdownHeading) cleaned = `${markdownHeading[1]}${markdownHeading[2] || ''}`;
      return cleaned.replace(/^\*+|\*+$/g, '').trim();
    })
    .filter(Boolean);
}

function formatTermsForWhatsApp(value) {
  return normalizeTermsList(value).map((term, index) => `${index + 1}. ${term}`).join('\n');
}

const DEFAULT_INVITE_TEMPLATE = [
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

const DEFAULT_PASS_TEMPLATE = [
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
  '{{terms_block}}',
  '',
  'For assistance: {{support}}',
].join('\n');

function buildPublicUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.PUBLIC_BASE_URL || 'https://ticket.rimacle.com';
  return `${base.replace(/\/+$/, '')}/${String(value).replace(/^\/+/, '')}`;
}

function buildInviteMessage(row, event) {
  return renderTemplate(event.invite_message_template?.trim() || DEFAULT_INVITE_TEMPLATE, {
    event: event.title || 'Our Event',
    date: fmtDate(event.event_date),
    venue: event.venue_name || '',
    link: buildPublicUrl(row.invitation_link),
  });
}

function buildPassMessage(row, event) {
  const terms = formatTermsForWhatsApp(event.pass_terms_conditions);
  const template = event.pass_message_template?.trim() || DEFAULT_PASS_TEMPLATE;
  const rendered = renderTemplate(template, {
    name: row.name || 'Participant',
    event: event.title || 'Our Event',
    date: fmtDate(event.event_date),
    time: fmtTime(event.start_time, event.end_time),
    venue: event.venue_name || '',
    seat: row.seat_number || '',
    pass: row.pass_number || '',
    link: buildPublicUrl(row.pass_url),
    support: event.support_contact_number || '',
    terms,
    terms_block: terms ? `*Terms & Conditions*\n${terms}` : '',
  });
  if (terms && !template.includes('{{terms}}') && !template.includes('{{terms_block}}')) {
    return `${rendered.trim()}\n\n*Terms & Conditions*\n${terms}`;
  }
  return rendered;
}

async function loadEvent(db, eventId) {
  const { data, error } = await db
    .from('events')
    .select('id,title,event_date,start_time,end_time,venue_name,support_contact_number,invite_message_template,pass_message_template,pass_terms_conditions')
    .eq('id', eventId)
    .single();
  if (error || !data) throw new Error(`Event not found: ${eventId}`);
  return data;
}

async function loadRecipients(db, eventId, mode, limit) {
  if (mode === 'passes') {
    let query = db
      .from('attendees')
      .select('id,name,mobile,seat_number,pass_number,pass_url')
      .eq('event_id', eventId)
      .not('pass_generated_at', 'is', null)
      .not('pass_url', 'is', null)
      .order('created_at', { ascending: true });
    if (limit > 0) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  let query = db
    .from('contacts')
    .select('id,mobile,invitation_link')
    .eq('event_id', eventId)
    .eq('status', 'uploaded')
    .order('created_at', { ascending: true });
  if (limit > 0) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function markSent(db, mode, id) {
  if (mode === 'passes') {
    await db
      .from('attendees')
      .update({
        whatsapp_status: 'sent',
        whatsapp_sent_marked_at: new Date().toISOString(),
      })
      .eq('id', id);
    return;
  }

  await db
    .from('contacts')
    .update({
      status: 'invited',
      whatsapp_invite_status: 'sent',
      invited_at: new Date().toISOString(),
    })
    .eq('id', id);
}

async function createClientSession() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  });

  const ready = new Promise((resolve, reject) => {
    client.on('qr', async (qr) => {
      const qrPath = path.resolve('whatsapp-qr.html');
      const dataUrl = await qrcode.toDataURL(qr, { margin: 2, width: 320 });
      fs.writeFileSync(qrPath, `<html><body style="font-family:sans-serif;text-align:center;padding:32px"><h2>Scan WhatsApp QR</h2><img src="${dataUrl}" /></body></html>`);
      console.log(`Scan QR: ${qrPath}`);
    });
    client.on('authenticated', () => console.log('WhatsApp authenticated. Waiting for ready state...'));
    client.on('ready', resolve);
    client.on('auth_failure', (message) => reject(new Error(`WhatsApp auth failed: ${message}`)));
    client.on('disconnected', (reason) => console.log(`WhatsApp disconnected: ${reason}`));
  });

  await client.initialize();
  await ready;
  return client;
}

async function main() {
  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));
  const args = parseArgs();

  if (args.help) {
    usage();
    return;
  }

  if (!args.eventId) throw new Error('Missing --event-id');
  if (!['invites', 'passes'].includes(args.mode)) throw new Error('--mode must be invites or passes');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const event = await loadEvent(db, args.eventId);
  const recipients = await loadRecipients(db, args.eventId, args.mode, args.limit);
  console.log(`Loaded ${recipients.length} ${args.mode} recipient(s) for ${event.title}`);

  if (recipients.length === 0) return;

  const client = args.dryRun ? null : await createClientSession();
  console.log(args.dryRun ? 'Dry run enabled. Messages will not be sent.' : 'WhatsApp ready. Starting batch send.');

  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < recipients.length; i += 1) {
      const row = recipients[i];
      const message = args.mode === 'passes' ? buildPassMessage(row, event) : buildInviteMessage(row, event);
      const chatId = `${args.countryCode}${String(row.mobile).replace(/\D/g, '')}@c.us`;

      try {
        if (args.dryRun) {
          console.log(`\n[DRY RUN] ${row.mobile}\n${message}\n`);
        } else {
          await client.sendMessage(chatId, message);
          await markSent(db, args.mode, row.id);
        }
        sent += 1;
        console.log(`[${i + 1}/${recipients.length}] Sent ${row.mobile}`);
      } catch (error) {
        failed += 1;
        console.error(`[${i + 1}/${recipients.length}] Failed ${row.mobile}:`, error instanceof Error ? error.message : error);
      }

      const isLast = i === recipients.length - 1;
      if (!isLast) {
        const isBatchEnd = (i + 1) % args.batchSize === 0;
        const delay = isBatchEnd ? args.batchBreak * 1000 : randomDelay(args.minDelay, args.maxDelay);
        console.log(`Waiting ${Math.round(delay / 1000)}s before next send...`);
        await sleep(delay);
      }
    }
  } finally {
    if (client) await client.destroy();
  }

  console.log(`Completed. Sent: ${sent}, Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
