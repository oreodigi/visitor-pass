export const dynamic = 'force-dynamic';

import { clearSessionCookie } from '@/lib/auth';
import { apiSuccess } from '@/lib/utils';

export async function POST() {
  await clearSessionCookie();
  return apiSuccess({ message: 'Logged out' });
}
