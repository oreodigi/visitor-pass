export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { generatePassForAttendee } from '@/services/pass.service';

// POST /api/attendees/generate-pass
// Body: { attendee_id: string, force?: boolean }
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const { attendee_id, force } = body;

    if (!attendee_id || typeof attendee_id !== 'string') {
      return apiError('attendee_id is required', 400);
    }

    const result = await generatePassForAttendee(
      attendee_id,
      force === true,
      request.nextUrl.origin
    );

    if (result.error) {
      const status = result.error.includes('not found') ? 404 : 400;
      return apiError(result.error, status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/attendees/generate-pass error:', err);
    return apiError('Internal server error', 500);
  }
}
