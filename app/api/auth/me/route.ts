export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Not authenticated', 401);
  }
  return apiSuccess({ user });
}
