export function normalizeTermsList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  const rawLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const numberedOrBulleted = value
    .split(/(?=\s*(?:\d+[\).]|[-*])\s+)/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const sentenceSplit = value
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sourceLines = rawLines.length > 1
    ? rawLines
    : numberedOrBulleted.length > 1
      ? numberedOrBulleted
      : sentenceSplit;

  return sourceLines
    .map((line) => line.replace(/^(?:\d+[\).]|[-*])\s*/, '').trim())
    .filter(Boolean);
}

export const PASS_POWERED_BY = 'Powered by Rimacle TMS';
