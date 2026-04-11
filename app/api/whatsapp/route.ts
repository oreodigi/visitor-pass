export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { getWhatsAppRuntimeBlockReason } from '@/lib/runtime';
import { apiSuccess, apiError } from '@/lib/utils';
import { getWaStatus, initWaClient, disconnectWaClient } from '@/lib/wa-client';

// GET /api/whatsapp - get current session status
export async function GET(_request: NextRequest) {
  try {
    await requireRole('admin');
    return apiSuccess(getWaStatus());
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// POST /api/whatsapp - initialize WhatsApp Web
export async function POST(_request: NextRequest) {
  try {
    await requireRole('admin');
    const blockedReason = getWhatsAppRuntimeBlockReason();
    if (blockedReason) return apiError(blockedReason, 400, 'WHATSAPP_DISABLED');
    initWaClient();
    const status = getWaStatus();
    return apiSuccess({
      message: 'Initializing WhatsApp client...',
      status,
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}

// DELETE /api/whatsapp - disconnect WhatsApp Web
export async function DELETE(_request: NextRequest) {
  try {
    await requireRole('admin');
    await disconnectWaClient();
    return apiSuccess({ message: 'Disconnected', status: getWaStatus() });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
