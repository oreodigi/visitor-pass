export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError, parsePagination } from '@/lib/utils';
import {
  listContacts,
  getContactById,
  markInviteSent,
  markContactPassSent,
  deleteContacts,
  bulkMarkInvited,
} from '@/services/contact.service';

// GET /api/contacts?event_id=xxx&page=1&status_filter=invited
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const result = await getContactById(id);
      if (result.error) return apiError(result.error, 404);
      return apiSuccess(result.data);
    }

    const eventId = searchParams.get('event_id');
    if (!eventId) return apiError('event_id is required', 400);

    const { page, per_page } = parsePagination(searchParams);
    const search = searchParams.get('search') || undefined;
    const status_filter = searchParams.get('status_filter') || undefined;

    const result = await listContacts({ event_id: eventId, page, per_page, search, status_filter });
    if (result.error) return apiError(result.error, 500);
    return apiSuccess(result.data);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/contacts error:', err);
    return apiError('Internal server error', 500);
  }
}

// PATCH /api/contacts — mark invite sent
// Body: { id: string, action: 'mark_invited' }
export async function PATCH(request: NextRequest) {
  try {
    await requireRole('admin');

    const body = await request.json();
    const { id, action } = body;

    if (action === 'mark_invited') {
      if (!id) return apiError('Contact ID is required', 400);
      const result = await markInviteSent(id);
      if (!result.success) return apiError(result.error || 'Failed to update', 400);
      return apiSuccess({ updated: true });
    }

    if (action === 'mark_pass_sent') {
      if (!id) return apiError('Contact ID is required', 400);
      const result = await markContactPassSent(id);
      if (!result.success) return apiError(result.error || 'Failed to update', 400);
      return apiSuccess({ updated: true });
    }

    const { ids } = body;
    if (action === 'bulk_mark_invited') {
      if (!Array.isArray(ids) || ids.length === 0) return apiError('ids array is required', 400);
      const result = await bulkMarkInvited(ids);
      if (!result.success) return apiError(result.error || 'Failed to update', 400);
      return apiSuccess({ updated: result.updated });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('PATCH /api/contacts error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/contacts — bulk delete
// Body: { ids: string[] }
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin');
    const body = await request.json();
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0) return apiError('ids array is required', 400);
    const result = await deleteContacts(ids);
    if (!result.success) return apiError(result.error || 'Failed to delete', 500);
    return apiSuccess({ deleted: result.deleted });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('DELETE /api/contacts error:', err);
    return apiError('Internal server error', 500);
  }
}
