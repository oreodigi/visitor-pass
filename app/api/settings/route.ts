export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError, sanitizeString } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { LOGO_BUCKET } from '@/lib/constants';
import { uploadPublicFile } from '@/lib/storage';

const ALLOWED_KEYS = [
  'app_name', 'app_tagline', 'app_logo_url', 'support_email', 'support_phone',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password',
  'smtp_from_name', 'smtp_from_email',
];

// GET /api/settings — returns all app settings as { key: value } map
export async function GET() {
  try {
    await requireRole('admin');
    const db = createServerClient();
    const { data, error } = await db
      .from('app_settings')
      .select('key, value')
      .in('key', ALLOWED_KEYS);

    if (error) {
      console.error('settings fetch error:', error);
      return apiError('Failed to load settings', 500);
    }

    const settings: Record<string, string> = {};
    for (const row of data || []) settings[row.key] = row.value;
    return apiSuccess(settings);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// PUT /api/settings — upsert one or many key/value pairs
export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin');
    const body = await request.json();
    if (typeof body !== 'object' || !body) return apiError('Invalid body', 400);

    const rows: Array<{ key: string; value: string }> = [];
    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      rows.push({ key, value: sanitizeString(String(val ?? '')) });
    }

    if (rows.length === 0) return apiError('No valid keys provided', 400);

    const db = createServerClient();
    const { error } = await db
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('settings save error:', error);
      return apiError('Failed to save settings', 500);
    }

    return apiSuccess({ updated: rows.length });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// POST /api/settings — upload app logo (multipart)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');
    const form = await request.formData();
    const file = form.get('logo') as File | null;

    if (!file || typeof file === 'string') return apiError('No file uploaded', 400);
    if (file.size === 0) return apiError('File is empty', 400);
    if (file.size > 2 * 1024 * 1024) return apiError('File must be under 2MB', 400);

    const rawExt = (file.name.split('.').pop() || 'png').toLowerCase();
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const contentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!allowedTypes.includes(contentType)) {
      return apiError('Only PNG, JPG, or WEBP images are allowed', 400);
    }

    const db = createServerClient();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const fileName = `app-logo/logo-${Date.now()}.${ext}`;
    const uploadResult = await uploadPublicFile(db, {
      bucket: LOGO_BUCKET,
      path: fileName,
      file,
    });

    if (uploadResult.error || !uploadResult.url) {
      return apiError(`Upload failed: ${uploadResult.error || 'Unknown error'}`, 500);
    }

    const { error: saveErr } = await db
      .from('app_settings')
      .upsert({ key: 'app_logo_url', value: uploadResult.url }, { onConflict: 'key' });

    if (saveErr) {
      console.error('app logo save error:', JSON.stringify(saveErr));
      return apiError('Logo uploaded but failed to save URL', 500);
    }

    return apiSuccess({ logo_url: uploadResult.url });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('settings POST error:', err);
    return apiError('Internal server error', 500);
  }
}
