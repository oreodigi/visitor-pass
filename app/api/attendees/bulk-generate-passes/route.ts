export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { bulkGeneratePasses } from '@/services/pass.service';

// POST /api/attendees/bulk-generate-passes
// Body: { event_id: string, attendee_ids?: string[], force?: boolean }
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const { event_id, attendee_ids, force } = body;

    if (!event_id || typeof event_id !== 'string') {
      return apiError('event_id is required', 400);
    }

    // Validate attendee_ids if provided
    if (attendee_ids !== undefined) {
      if (!Array.isArray(attendee_ids)) {
        return apiError('attendee_ids must be an array', 400);
      }
      if (attendee_ids.some((id: unknown) => typeof id !== 'string')) {
        return apiError('All attendee_ids must be strings', 400);
      }
    }

    const result = await bulkGeneratePasses(
      event_id,
      attendee_ids,
      force === true,
      request.nextUrl.origin
    );

    return apiSuccess(result);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/attendees/bulk-generate-passes error:', err);
    return apiError('Internal server error', 500);
  }
}
