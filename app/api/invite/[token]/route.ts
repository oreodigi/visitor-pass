import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { isValidInviteToken } from '@/lib/token';
import { getContactByToken } from '@/services/contact.service';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/invite/[token]
// Public route — no auth required. Returns data needed to render the form.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  if (!isValidInviteToken(token)) {
    return apiError('Invalid invitation link', 400, 'INVALID_TOKEN');
  }

  const result = await getContactByToken(token);

  if (result.error || !result.data) {
    return apiError('Invalid or expired invitation link', 404, 'NOT_FOUND');
  }

  const contact = result.data;

  return apiSuccess({
    contact: {
      id: contact.id,
      mobile: contact.mobile,
      status: contact.status,
    },
    event: contact.event,
    attendee_pass_url: null, // will be set after confirmation
  });
}
