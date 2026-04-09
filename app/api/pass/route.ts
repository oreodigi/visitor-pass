import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { isValidToken } from '@/lib/token';
import { getPublicPassByToken } from '@/services/pass.service';

// GET /api/pass?token=vp_xxxxx
// Public endpoint — no auth required.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return apiError('Token is required', 400);
  }

  // Validate token format before hitting DB
  if (!isValidToken(token)) {
    return apiError('Invalid pass', 404);
  }

  const result = await getPublicPassByToken(token);

  if (result.error) {
    return apiError(result.error, 404);
  }

  return apiSuccess(result.data);
}
