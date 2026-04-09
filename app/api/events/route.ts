export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import {
  createEvent,
  updateEvent,
  listEvents,
  getEventById,
  uploadLogo,
} from '@/services/event.service';

// GET /api/events — list all events
// GET /api/events?id=xxx — get single event
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const result = await getEventById(id);
      if (result.error) return apiError(result.error, 404);
      return apiSuccess(result.data);
    }

    const result = await listEvents();
    if (result.error) return apiError(result.error, 500);
    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/events error:', err);
    return apiError('Internal server error', 500);
  }
}

// POST /api/events — create event or upload logo
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');

    const contentType = request.headers.get('content-type') || '';

    // Handle logo upload (multipart form)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const eventId = formData.get('event_id') as string;
      const file = formData.get('logo') as File | null;

      if (!eventId) return apiError('Event ID is required', 400);
      if (!file) return apiError('Logo file is required', 400);

      const result = await uploadLogo(eventId, file);
      if (result.error) return apiError(result.error, 400);
      return apiSuccess({ logo_url: result.url });
    }

    // Handle JSON event creation
    const body = await request.json();
    const result = await createEvent(body);
    if (result.error) return apiError(result.error, 400);
    return apiSuccess(result.data, 201);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('POST /api/events error:', err);
    return apiError('Internal server error', 500);
  }
}

// PUT /api/events — update event
export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    if (!body.id) return apiError('Event ID is required in body', 400);

    const result = await updateEvent(body);
    if (result.error) return apiError(result.error, 400);
    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('PUT /api/events error:', err);
    return apiError('Internal server error', 500);
  }
}
