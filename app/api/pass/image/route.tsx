import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { PassImageTemplate } from './pass-template';
import type { PublicPassData } from '@/services/pass.service';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const TOKEN_REGEX = /^vp_(?:[a-f0-9]{32}|[A-Za-z0-9_-]{12})$/;

const DEFAULT_PASS_STYLE = {
  primary_color: '#065f46',
  secondary_color: '#0f766e',
  accent_color: '#059669',
  surface_color: '#f5f5f4',
};

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizePassStyle(value: unknown) {
  const raw = typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
  return {
    primary_color: normalizeColor(raw.primary_color, DEFAULT_PASS_STYLE.primary_color),
    secondary_color: normalizeColor(raw.secondary_color, DEFAULT_PASS_STYLE.secondary_color),
    accent_color: normalizeColor(raw.accent_color, DEFAULT_PASS_STYLE.accent_color),
    surface_color: normalizeColor(raw.surface_color, DEFAULT_PASS_STYLE.surface_color),
  };
}

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase server configuration');
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseSettingsValue(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

async function getPublicPassByToken(token: string, origin: string): Promise<{ data?: PublicPassData; error?: string }> {
  const db = getDb();

  const { data: attendee, error: attendeeErr } = await db
    .from('attendees')
    .select('name, mobile, email, business_name, seat_number, pass_number, checked_in_at, pass_url, event_id')
    .eq('qr_token', token)
    .single();

  if (attendeeErr || !attendee) return { error: 'Invalid pass' };
  if (!attendee.pass_number) return { error: 'Pass not generated' };

  const { data: event, error: eventErr } = await db
    .from('events')
    .select('title, event_date, start_time, end_time, venue_name, venue_address, venue_contact_number, organizer_contact_number, support_contact_number, footer_note, logo_url, pass_terms_conditions, partners')
    .eq('id', attendee.event_id)
    .single();

  if (eventErr || !event) return { error: 'Event not found' };

  const { data: styleRow } = await db
    .from('app_settings')
    .select('value')
    .eq('key', `pass_style_config:${attendee.event_id}`)
    .maybeSingle();

  const { data: appSettings } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['app_name', 'app_logo_url']);

  const appSettingsMap = Object.fromEntries(
    (appSettings || []).map((row) => [row.key, row.value])
  ) as Record<string, string | undefined>;

  const passUrl = attendee.pass_url || `${origin.replace(/\/+$/, '')}/p/${token}`;
  const passStyle = normalizePassStyle(parseSettingsValue(styleRow?.value));

  return {
    data: {
      app: {
        name: appSettingsMap.app_name?.trim() || 'Visitor Pass',
        logo_url: appSettingsMap.app_logo_url?.trim() || null,
      },
      attendee: {
        name: attendee.name,
        mobile: attendee.mobile,
        email: attendee.email,
        business_name: attendee.business_name,
        seat_number: attendee.seat_number,
        pass_number: attendee.pass_number,
        checked_in_at: attendee.checked_in_at,
      },
      event: {
        title: event.title || 'Event',
        event_date: event.event_date || '',
        start_time: event.start_time || '00:00',
        end_time: event.end_time || '00:00',
        venue_name: event.venue_name || '',
        venue_address: event.venue_address || '',
        venue_contact_number: event.venue_contact_number,
        organizer_contact_number: event.organizer_contact_number,
        support_contact_number: event.support_contact_number,
        footer_note: event.footer_note,
        logo_url: event.logo_url,
        pass_terms_conditions: event.pass_terms_conditions,
        partners: Array.isArray(event.partners) ? event.partners : [],
        pass_style: passStyle,
      },
      pass_url: passUrl,
    },
  };
}

async function generateQrSvgDataUrl(text: string) {
  const svg = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1c1917',
      light: '#ffffff',
    },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function filenameFromPass(passNumber: string | null | undefined) {
  return `visitor-pass-${(passNumber || 'pass').replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
}

// GET /api/pass/image?token=xxx
// Returns a PNG image of the visitor pass for sharing via WhatsApp.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || !TOKEN_REGEX.test(token)) {
    return new Response('Invalid token', { status: 400 });
  }

  const result = await getPublicPassByToken(token, origin);
  if (result.error || !result.data) {
    return new Response(result.error || 'Pass not found', { status: 404 });
  }

  const qrDataUrl = await generateQrSvgDataUrl(result.data.pass_url);
  const imageHeight = result.data.event.pass_terms_conditions ? 1000 : 860;
  const response = new ImageResponse(
    <PassImageTemplate data={result.data} qrDataUrl={qrDataUrl} imageHeight={imageHeight} />,
    {
      width: 600,
      height: imageHeight,
    }
  );

  return new Response(await response.arrayBuffer(), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filenameFromPass(result.data.attendee.pass_number)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
