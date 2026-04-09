export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { getSendProgress } from '@/lib/wa-sender';

// GET /api/whatsapp/progress — poll current send progress
export async function GET(_request: NextRequest) {
  try {
    await requireRole('admin');
    return apiSuccess(getSendProgress());
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
