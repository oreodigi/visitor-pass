import { randomBytes } from 'crypto';

// ── QR Token Generation (for event passes) ────────────────
// Format: vp_<32 hex chars> = 35 chars total
// Entropy: 128 bits

const TOKEN_PREFIX = 'vp_';
const TOKEN_BYTE_LENGTH = 16;
const TOKEN_REGEX = /^vp_[a-f0-9]{32}$/;

export function generateSecureToken(): string {
  const bytes = randomBytes(TOKEN_BYTE_LENGTH);
  return TOKEN_PREFIX + bytes.toString('hex');
}

export function isValidToken(token: string): boolean {
  return TOKEN_REGEX.test(token);
}

// ── Invite Token Generation (for form invitation links) ───
// Format: inv_<32 hex chars> = 36 chars total
// Entropy: 128 bits — separate namespace from pass tokens

const INVITE_TOKEN_PREFIX = 'inv_';
const INVITE_TOKEN_REGEX = /^inv_[a-f0-9]{32}$/;

export function generateInviteToken(): string {
  const bytes = randomBytes(TOKEN_BYTE_LENGTH);
  return INVITE_TOKEN_PREFIX + bytes.toString('hex');
}

export function isValidInviteToken(token: string): boolean {
  return INVITE_TOKEN_REGEX.test(token);
}

// ── Pass Number Generation ────────────────────────────────
// Format: {PREFIX}-{6-digit zero-padded sequence}
// Example: MSM26-000001

const PASS_NUMBER_PAD_LENGTH = 6;

export function buildPassPrefix(eventDate: string, eventTitle: string): string {
  const year = eventDate.slice(2, 4); // "2026" → "26"
  const letters = eventTitle
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3);
  const prefix = letters.length >= 2 ? letters : 'EVT';
  return `${prefix}${year}`;
}

export function formatPassNumber(prefix: string, sequence: number): string {
  const padded = String(sequence).padStart(PASS_NUMBER_PAD_LENGTH, '0');
  return `${prefix}-${padded}`;
}

export function parsePassNumberSequence(passNumber: string): number {
  const parts = passNumber.split('-');
  if (parts.length !== 2) return 0;
  const num = parseInt(parts[1], 10);
  return isNaN(num) ? 0 : num;
}

// ── Seat Number Generation ────────────────────────────────
// Format: SEAT-{3-digit zero-padded sequence}
// Example: SEAT-001
// Shares the same integer sequence as pass_number so they stay in sync.

const SEAT_NUMBER_PAD_LENGTH = 3;

export function formatSeatNumber(sequence: number): string {
  const padded = String(sequence).padStart(SEAT_NUMBER_PAD_LENGTH, '0');
  return `SEAT-${padded}`;
}
