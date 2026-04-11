import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import type { UserRole } from '@/types';

const RUNNER_SCOPE = 'local_whatsapp_runner';

type LocalRunnerPayload = {
  scope: typeof RUNNER_SCOPE;
  event_id: string;
  uid: string;
  role: UserRole;
};

export type LocalRunnerAuth =
  | { kind: 'global' }
  | { kind: 'event'; eventId: string; userId: string; role: UserRole };

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

function getGlobalRunnerToken() {
  return process.env.WHATSAPP_RUNNER_TOKEN || process.env.LOCAL_WHATSAPP_RUNNER_TOKEN || '';
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

export async function createLocalRunnerToken(input: {
  eventId: string;
  userId: string;
  role: UserRole;
}) {
  return new SignJWT({
    scope: RUNNER_SCOPE,
    event_id: input.eventId,
    uid: input.userId,
    role: input.role,
  } satisfies LocalRunnerPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function authorizeLocalRunner(
  request: NextRequest,
  expectedEventId?: string | null,
): Promise<LocalRunnerAuth | null> {
  const bearer = getBearerToken(request);
  if (!bearer) return null;

  const globalToken = getGlobalRunnerToken();
  if (globalToken && bearer === globalToken) return { kind: 'global' };

  try {
    const { payload } = await jwtVerify(bearer, getJwtSecret());
    const runnerPayload = payload as Partial<LocalRunnerPayload>;
    if (runnerPayload.scope !== RUNNER_SCOPE || !runnerPayload.event_id || !runnerPayload.uid || !runnerPayload.role) {
      return null;
    }
    if (expectedEventId && runnerPayload.event_id !== expectedEventId) return null;

    return {
      kind: 'event',
      eventId: runnerPayload.event_id,
      userId: runnerPayload.uid,
      role: runnerPayload.role,
    };
  } catch {
    return null;
  }
}
