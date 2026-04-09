export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { parseCsv } from '@/lib/csv-parser';
import { importAttendees } from '@/services/attendee.service';

// POST /api/attendees/import
// Accepts: multipart/form-data with 'file' (CSV) and 'event_id'
// Also accepts: application/json with { event_id, attendees: [...] }
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const contentType = request.headers.get('content-type') || '';

    let eventId: string;
    let rows: Array<{ name?: string; mobile: string; business_name?: string }>;

    if (contentType.includes('multipart/form-data')) {
      // ── CSV File Upload ─────────────────────────────────
      const formData = await request.formData();
      eventId = (formData.get('event_id') as string) || '';
      const file = formData.get('file') as File | null;

      if (!eventId) return apiError('event_id is required', 400);
      if (!file) return apiError('CSV file is required', 400);

      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
        return apiError('Only .csv and .txt files are accepted', 400);
      }

      // Validate file size (5MB max for CSV)
      if (file.size > 5 * 1024 * 1024) {
        return apiError('File too large. Maximum: 5MB', 400);
      }

      // Read and parse CSV
      const text = await file.text();
      const parseResult = parseCsv(text);

      if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
        return apiError(
          `CSV parsing failed: ${parseResult.errors[0].reason}`,
          400
        );
      }

      rows = parseResult.rows;

      // Attach CSV-level parse errors to import result
      if (parseResult.errors.length > 0) {
        // We proceed with valid rows but will merge errors later
        const importResult = await importAttendees(eventId, rows);
        importResult.errors = [
          ...parseResult.errors,
          ...importResult.errors,
        ];
        importResult.invalid_rows += parseResult.errors.length;
        importResult.total_rows += parseResult.errors.length;
        return apiSuccess(importResult);
      }
    } else {
      // ── JSON Payload ────────────────────────────────────
      const body = await request.json();
      eventId = body.event_id;
      rows = body.attendees;

      if (!eventId) return apiError('event_id is required', 400);
      if (!Array.isArray(rows) || rows.length === 0) {
        return apiError('attendees array is required and must not be empty', 400);
      }
    }

    // Run import
    const result = await importAttendees(eventId, rows);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/attendees/import error:', err);
    return apiError('Internal server error', 500);
  }
}
