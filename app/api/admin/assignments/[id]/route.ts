export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';

// DELETE /api/admin/assignments/:id — remove an event assignment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('admin');
    const db = createServerClient();

    const { data: existing } = await db
      .from('user_event_assignments')
      .select('id')
      .eq('id', params.id)
      .single();

    if (!existing) return apiError('Assignment not found', 404);

    const { error } = await db
      .from('user_event_assignments')
      .delete()
      .eq('id', params.id);

    if (error) return apiError('Failed to remove assignment', 500);

    return apiSuccess({ message: 'Assignment removed' });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
