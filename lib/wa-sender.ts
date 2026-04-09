// Bulk WhatsApp invite sender with rate limiting
// Runs as a fire-and-forget async loop, tracks progress in global state.

import { sendWaMessage } from './wa-client';
import { buildInviteMessage, type EventContext } from './whatsapp';

export interface BulkSendConfig {
  minDelayMs: number;   // min delay between messages  (default: 45 000 = 45s)
  maxDelayMs: number;   // max delay between messages  (default: 90 000 = 90s)
  batchSize: number;    // messages per batch          (default: 15)
  batchBreakMs: number; // pause between batches       (default: 300 000 = 5min)
}

export const DEFAULT_CONFIG: BulkSendConfig = {
  minDelayMs: 45_000,
  maxDelayMs: 90_000,
  batchSize: 15,
  batchBreakMs: 300_000,
};

export interface BulkSendItem {
  id: string;
  mobile: string;
  invitation_link: string;
}

export interface BulkSendProgress {
  status: 'idle' | 'running' | 'completed' | 'stopped';
  total: number;
  sent: number;
  failed: number;
  currentIndex: number;
  currentMobile?: string;
  /** Unix timestamp (ms) when the next message will be sent */
  nextSendAt?: number;
  errors: Array<{ mobile: string; reason: string }>;
  startedAt?: string;
  completedAt?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __waSend: { progress: BulkSendProgress; stopFlag: boolean } | undefined;
}

function st() {
  if (!global.__waSend) {
    global.__waSend = {
      progress: { status: 'idle', total: 0, sent: 0, failed: 0, currentIndex: 0, errors: [] },
      stopFlag: false,
    };
  }
  return global.__waSend;
}

export function getSendProgress(): BulkSendProgress {
  return { ...st().progress };
}

export function stopBulkSend(): void {
  st().stopFlag = true;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function startBulkSend(contacts: BulkSendItem[], config: BulkSendConfig, ctx?: EventContext): void {
  const state = st();
  if (state.progress.status === 'running') return;

  state.stopFlag = false;
  state.progress = {
    status: 'running',
    total: contacts.length,
    sent: 0,
    failed: 0,
    currentIndex: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };

  // Fire-and-forget — intentionally not awaited
  (async () => {
    for (let i = 0; i < contacts.length; i++) {
      if (state.stopFlag) {
        state.progress.status = 'stopped';
        state.progress.completedAt = new Date().toISOString();
        state.progress.nextSendAt = undefined;
        return;
      }

      const contact = contacts[i];
      state.progress.currentIndex = i + 1;
      state.progress.currentMobile = contact.mobile;
      state.progress.nextSendAt = undefined;

      const result = await sendWaMessage(contact.mobile, buildInviteMessage(contact.invitation_link, ctx));

      if (result.success) {
        state.progress.sent++;
        // Mark as invited — import inline to avoid circular dep issues
        try {
          const { markInviteSent } = await import('@/services/contact.service');
          await markInviteSent(contact.id);
        } catch { /* non-fatal */ }
      } else {
        state.progress.failed++;
        state.progress.errors.push({ mobile: contact.mobile, reason: result.error || 'Unknown' });
      }

      // Delay before next message
      const isLast = i === contacts.length - 1;
      if (!isLast && !state.stopFlag) {
        const isBatchEnd = (i + 1) % config.batchSize === 0;
        const delayMs = isBatchEnd
          ? config.batchBreakMs
          : randomBetween(config.minDelayMs, config.maxDelayMs);

        state.progress.nextSendAt = Date.now() + delayMs;

        console.log(
          `[WA] Sent ${i + 1}/${contacts.length}. ` +
          (isBatchEnd
            ? `Batch complete — pausing ${delayMs / 1000}s`
            : `Next in ${(delayMs / 1000).toFixed(0)}s`)
        );

        await sleep(delayMs);
      }
    }

    state.progress.status = 'completed';
    state.progress.completedAt = new Date().toISOString();
    state.progress.currentMobile = undefined;
    state.progress.nextSendAt = undefined;
    console.log(`[WA] Bulk send complete. Sent: ${state.progress.sent}, Failed: ${state.progress.failed}`);
  })();
}
