import { NextRequest } from 'next/server';
import { apiSuccess, apiError, normalizeMobile, isValidMobile, sanitizeString } from '@/lib/utils';
import { isValidInviteToken } from '@/lib/token';
import { getContactByToken } from '@/services/contact.service';
import { createConfirmedAttendee } from '@/services/attendee.service';

// POST /api/invite/submit
// Public route — no auth. Processes the interest form submission.
// Body: { token, name, mobile, email?, company_name? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return apiError('Invalid request body', 400);
  }

  const { token, name, mobile, email, company_name } = body as {
    token?: string;
    name?: string;
    mobile?: string;
    email?: string;
    company_name?: string;
  };

  // Validate token
  if (!token || typeof token !== 'string' || !isValidInviteToken(token)) {
    return apiError('Invalid invitation token', 400, 'INVALID_TOKEN');
  }

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return apiError('Name is required', 400, 'MISSING_NAME');
  }
  if (!mobile || typeof mobile !== 'string') {
    return apiError('Mobile number is required', 400, 'MISSING_MOBILE');
  }

  const normalizedMobile = normalizeMobile(mobile);
  if (!isValidMobile(normalizedMobile)) {
    return apiError('Invalid mobile number. Must be a 10-digit Indian mobile number.', 400, 'INVALID_MOBILE');
  }

  // Validate optional email format if provided
  if (email && typeof email === 'string' && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return apiError('Invalid email address', 400, 'INVALID_EMAIL');
    }
  }

  // Load contact by token
  const contactResult = await getContactByToken(token);
  if (contactResult.error || !contactResult.data) {
    return apiError('Invalid or expired invitation link', 404, 'NOT_FOUND');
  }

  const contact = contactResult.data;

  // Check if already confirmed — return existing pass
  if (contact.status === 'confirmed' && contact.attendee_id) {
    return apiError('This invitation has already been used. Check your pass link.', 409, 'ALREADY_CONFIRMED');
  }

  if (contact.status === 'cancelled') {
    return apiError('This invitation has been cancelled', 410, 'CANCELLED');
  }

  // Mobile mismatch check: if contact has a prefilled mobile, the submitted
  // mobile must match (prevents someone else using the link).
  if (contact.mobile && normalizeMobile(contact.mobile) !== normalizedMobile) {
    return apiError(
      'Mobile number does not match the invited number. Please use your registered mobile.',
      400,
      'MOBILE_MISMATCH'
    );
  }

  // Create confirmed attendee + generate pass
  const result = await createConfirmedAttendee({
    event_id: contact.event_id,
    contact_id: contact.id,
    name: sanitizeString(name),
    mobile: normalizedMobile,
    email: email?.trim() || undefined,
    company_name: company_name?.trim() || undefined,
    app_origin: request.nextUrl.origin,
  });

  if (result.error) {
    const status = result.error.includes('already registered') ? 409 : 500;
    return apiError(result.error, status);
  }

  return apiSuccess(result.data, 201);
}
