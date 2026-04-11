import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth } = pkg;

const DEFAULTS = {
  appUrl: 'https://ticket.rimacle.com',
  mode: 'invites',
  minDelay: 45,
  maxDelay: 90,
  batchSize: 15,
  batchBreak: 300,
  countryCode: '91',
  limit: 100,
  dryRun: false,
};

function loadEnv(file = '.env') {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
}

function parseArgs(env) {
  const args = {
    ...DEFAULTS,
    appUrl: env.APP_URL || process.env.APP_URL || DEFAULTS.appUrl,
    runnerToken: env.RUNNER_TOKEN || process.env.RUNNER_TOKEN || '',
    eventId: env.EVENT_ID || process.env.EVENT_ID || '',
    mode: env.MODE || process.env.MODE || DEFAULTS.mode,
    minDelay: Number(env.MIN_DELAY || process.env.MIN_DELAY || DEFAULTS.minDelay),
    maxDelay: Number(env.MAX_DELAY || process.env.MAX_DELAY || DEFAULTS.maxDelay),
    batchSize: Number(env.BATCH_SIZE || process.env.BATCH_SIZE || DEFAULTS.batchSize),
    batchBreak: Number(env.BATCH_BREAK || process.env.BATCH_BREAK || DEFAULTS.batchBreak),
    countryCode: String(env.COUNTRY_CODE || process.env.COUNTRY_CODE || DEFAULTS.countryCode).replace(/\D/g, ''),
    limit: Number(env.LIMIT || process.env.LIMIT || DEFAULTS.limit),
  };

  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i += 1) {
    const arg = raw[i];
    const next = raw[i + 1];
    if (arg === '--app-url') args.appUrl = next, i += 1;
    else if (arg === '--token') args.runnerToken = next, i += 1;
    else if (arg === '--event-id') args.eventId = next, i += 1;
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
Rimacle WhatsApp Local Runner

Usage:
  npm start -- --event-id EVENT_ID --mode invites
  npm start -- --event-id EVENT_ID --mode passes

Options:
  --app-url https://ticket.rimacle.com
  --token RUNNER_TOKEN
  --min-delay 45
  --max-delay 90
  --batch-size 15
  --batch-break 300
  --limit 100
  --dry-run
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

function openQrPage(filePath) {
  if (process.env.NO_OPEN_QR === 'true') return;
  const opener = process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '', filePath]]
    : process.platform === 'darwin'
      ? ['open', [filePath]]
      : ['xdg-open', [filePath]];

  execFile(opener[0], opener[1], { windowsHide: true }, () => undefined);
}

async function apiFetch(args, pathname, options = {}) {
  const url = new URL(pathname, args.appUrl.replace(/\/+$/, '/'));
  if (options.search) {
    for (const [key, value] of Object.entries(options.search)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${args.runnerToken}`,
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || `Request failed: ${res.status}`);
  }
  return json.data;
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
      openQrPage(qrPath);
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
  const args = parseArgs(loadEnv());
  if (args.help) {
    usage();
    return;
  }

  if (!args.eventId) throw new Error('Missing EVENT_ID. Set it in .env or pass --event-id.');
  if (!args.runnerToken) throw new Error('Missing RUNNER_TOKEN in .env.');
  if (!['invites', 'passes'].includes(args.mode)) throw new Error('MODE must be invites or passes.');

  const queue = await apiFetch(args, '/api/local-runner/queue', {
    search: {
      event_id: args.eventId,
      mode: args.mode,
      limit: args.limit,
    },
  });

  const recipients = queue.recipients || [];
  console.log(`Loaded ${recipients.length} ${args.mode} recipient(s) for ${queue.event?.title || args.eventId}`);
  if (recipients.length === 0) return;

  const client = args.dryRun ? null : await createClientSession();
  console.log(args.dryRun ? 'Dry run enabled. Messages will not be sent.' : 'WhatsApp ready. Starting send run.');

  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < recipients.length; i += 1) {
      const row = recipients[i];
      const chatId = `${args.countryCode}${String(row.mobile).replace(/\D/g, '')}@c.us`;

      try {
        if (args.dryRun) {
          console.log(`\n[DRY RUN] ${row.mobile}\n${row.message}\n`);
        } else {
          await client.sendMessage(chatId, row.message);
          await apiFetch(args, '/api/local-runner/mark', {
            method: 'POST',
            body: { id: row.id, mode: args.mode, status: 'sent' },
          });
        }
        sent += 1;
        console.log(`[${i + 1}/${recipients.length}] ${args.dryRun ? 'Prepared' : 'Sent'} ${row.mobile}`);
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[${i + 1}/${recipients.length}] Failed ${row.mobile}: ${reason}`);
        if (!args.dryRun) {
          await apiFetch(args, '/api/local-runner/mark', {
            method: 'POST',
            body: { id: row.id, mode: args.mode, status: 'failed', error: reason },
          }).catch(() => undefined);
        }
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

  console.log(`Completed. ${args.dryRun ? 'Prepared' : 'Sent'}: ${sent}, Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
