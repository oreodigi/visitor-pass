import { createServerClient } from '@/lib/supabase/server';

export interface PassStyleConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  surface_color: string;
}

type DbClient = ReturnType<typeof createServerClient>;

const FALLBACK_KEY_PREFIX = 'pass_style_config:';

export const DEFAULT_PASS_STYLE: PassStyleConfig = {
  primary_color: '#065f46',
  secondary_color: '#0f766e',
  accent_color: '#059669',
  surface_color: '#f5f5f4',
};

function getFallbackKey(eventId: string) {
  return `${FALLBACK_KEY_PREFIX}${eventId}`;
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizePassStyleConfig(value: unknown): PassStyleConfig {
  const raw = typeof value === 'object' && value ? (value as Record<string, unknown>) : {};

  return {
    primary_color: isHexColor(raw.primary_color) ? raw.primary_color : DEFAULT_PASS_STYLE.primary_color,
    secondary_color: isHexColor(raw.secondary_color) ? raw.secondary_color : DEFAULT_PASS_STYLE.secondary_color,
    accent_color: isHexColor(raw.accent_color) ? raw.accent_color : DEFAULT_PASS_STYLE.accent_color,
    surface_color: isHexColor(raw.surface_color) ? raw.surface_color : DEFAULT_PASS_STYLE.surface_color,
  };
}

export async function loadPassStyleConfig(
  db: DbClient,
  eventId: string
): Promise<{ data?: PassStyleConfig; error?: string }> {
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', getFallbackKey(eventId))
    .maybeSingle();

  if (error) {
    console.error('Pass style load error:', error);
    return { error: 'Failed to load pass style' };
  }

  if (!data?.value) return { data: DEFAULT_PASS_STYLE };

  try {
    return { data: normalizePassStyleConfig(JSON.parse(data.value)) };
  } catch (err) {
    console.error('Pass style parse error:', err);
    return { data: DEFAULT_PASS_STYLE };
  }
}

export async function savePassStyleConfig(
  db: DbClient,
  eventId: string,
  config: PassStyleConfig | null | undefined
): Promise<{ error?: string }> {
  const normalized = normalizePassStyleConfig(config ?? DEFAULT_PASS_STYLE);
  const { error } = await db
    .from('app_settings')
    .upsert(
      { key: getFallbackKey(eventId), value: JSON.stringify(normalized) },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Pass style save error:', error);
    return { error: 'Failed to save pass style' };
  }

  return {};
}
