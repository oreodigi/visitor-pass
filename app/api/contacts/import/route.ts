export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { parseCsv } from '@/lib/csv-parser';
import { importContacts } from '@/services/contact.service';

// POST /api/contacts/import
// multipart/form-data: event_id, file (CSV)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const formData = await request.formData();
    const eventId = formData.get('event_id') as string;
    const file = formData.get('file') as File | null;

    if (!eventId) return apiError('event_id is required', 400);
    if (!file) return apiError('CSV file is required', 400);

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
      return apiError('Only .csv or .txt files are accepted', 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      return apiError('File too large (max 5MB)', 400);
    }

    const text = await file.text();
    const { rows, errors: parseErrors } = parseCsv(text);

    if (rows.length === 0) {
      const reason = parseErrors[0]?.reason || 'CSV file is empty or has no valid rows';
      return apiError(reason, 400);
    }

    const contacts = rows.map((r) => ({ mobile: r.mobile || '' }));

    const result = await importContacts(eventId, contacts, request.nextUrl.origin);
    return apiSuccess(result, 200);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/contacts/import error:', err);
    return apiError('Internal server error', 500);
  }
}
