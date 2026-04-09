import { NextResponse } from 'next/server';
import { MOBILE_REGEX } from './constants';

// ── API Response Helpers ──────────────────────────────────

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: { message, code } },
    { status }
  );
}

// ── Mobile Number Normalization ───────────────────────────

export function normalizeMobile(raw: string): string {
  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, '');

  // Remove leading country code 91 if present and length > 10
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

export function isValidMobile(mobile: string): boolean {
  return MOBILE_REGEX.test(mobile);
}

// ── Input Sanitization ────────────────────────────────────

export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/<[^>]*>/g, '');
}

export function sanitizePhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\d+\-\s()]/g, '').trim();
}

// ── Pagination Helper ─────────────────────────────────────

export function parsePagination(params: URLSearchParams) {
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const per_page = Math.min(
    100,
    Math.max(1, parseInt(params.get('per_page') || '20', 10))
  );
  const offset = (page - 1) * per_page;
  return { page, per_page, offset };
}
