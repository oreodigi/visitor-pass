export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError, parsePagination } from '@/lib/utils';
import {
  createAttendee,
  updateAttendee,
  deleteAttendee,
  getAttendeeById,
  listAttendees,
} from '@/services/attendee.service';

// GET /api/attendees?event_id=xxx&page=1&per_page=20&search=term
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin', 'gate_staff');

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const id = searchParams.get('id');

    // Single attendee lookup
    if (id) {
      const result = await getAttendeeById(id);
      if (result.error) return apiError(result.error, 404);
      return apiSuccess(result.data);
    }

    if (!eventId) {
      return apiError('event_id query parameter is required', 400);
    }

    const { page, per_page } = parsePagination(searchParams);
    const search = searchParams.get('search') || undefined;
    const passFilter = searchParams.get('pass_filter') as 'has_pass' | 'no_pass' | null;

    const result = await listAttendees({
      event_id: eventId,
      page,
      per_page,
      search,
      pass_filter: passFilter || undefined,
    });

    if (result.error) return apiError(result.error, 500);
    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/attendees error:', err);
    return apiError('Internal server error', 500);
  }
}

// POST /api/attendees — create single attendee
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const result = await createAttendee(body);

    if (result.error) {
      const status = result.error.includes('already registered') ? 409 : 400;
      return apiError(result.error, status);
    }

    return apiSuccess(result.data, 201);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/attendees error:', err);
    return apiError('Internal server error', 500);
  }
}

// PUT /api/attendees — update attendee
export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    if (!body.id) return apiError('Attendee ID is required', 400);

    const result = await updateAttendee(body);

    if (result.error) {
      const status = result.error.includes('already registered') ? 409 : 400;
      return apiError(result.error, status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('PUT /api/attendees error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/attendees?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return apiError('Attendee ID is required', 400);

    const result = await deleteAttendee(id);
    if (!result.success) {
      return apiError(result.error || 'Failed to delete', 400);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('DELETE /api/attendees error:', err);
    return apiError('Internal server error', 500);
  }
}
