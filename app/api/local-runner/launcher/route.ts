export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth';
import { apiError } from '@/lib/utils';
import { createServerClient } from '@/lib/supabase/server';
import { createLocalRunnerToken } from '@/lib/local-runner-auth';

type LauncherMode = 'invites' | 'passes';

function parseMode(value: string | null): LauncherMode {
  return value === 'passes' ? 'passes' : 'invites';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'event';
}

function safeCmdText(value: string) {
  return value.replace(/[&|<>^%"]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cmdScript(input: {
  appUrl: string;
  token: string;
  eventId: string;
  eventTitle: string;
  mode: LauncherMode;
}) {
  const downloadBase = `${input.appUrl}/downloads/whatsapp-local-runner`;
  const eventTitle = safeCmdText(input.eventTitle) || 'Event';
  return [
    '@echo off',
    'setlocal',
    'title Rimacle WhatsApp Sender',
    'color 0A',
    '',
    'echo ==============================================',
    'echo   Rimacle WhatsApp Bulk Sender',
    `echo   Event: ${eventTitle}`,
    `echo   Mode : ${input.mode === 'passes' ? 'Send Generated Passes' : 'Send Invitations'}`,
    'echo ==============================================',
    'echo.',
    '',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo Node.js is required one time before this sender can run.',
    '  echo Opening the safe official download page now.',
    '  start "" "https://nodejs.org/en/download"',
    '  echo Install Node.js LTS, then double-click this file again.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'set "TARGET=%USERPROFILE%\\RimacleWhatsAppRunner"',
    'if not exist "%TARGET%" mkdir "%TARGET%"',
    'cd /d "%TARGET%"',
    '',
    'echo Downloading sender files...',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${downloadBase}/runner.mjs' -OutFile 'runner.mjs'"`,
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${downloadBase}/package.json' -OutFile 'package.json'"`,
    '',
    'echo Preparing event settings...',
    '> ".env" echo APP_URL=' + input.appUrl,
    '>> ".env" echo RUNNER_TOKEN=' + input.token,
    '>> ".env" echo EVENT_ID=' + input.eventId,
    '>> ".env" echo MODE=' + input.mode,
    '>> ".env" echo MIN_DELAY=45',
    '>> ".env" echo MAX_DELAY=90',
    '>> ".env" echo BATCH_SIZE=15',
    '>> ".env" echo BATCH_BREAK=300',
    '>> ".env" echo COUNTRY_CODE=91',
    '',
    'if not exist "node_modules" (',
    '  echo Installing sender engine. This happens only once on this PC.',
    '  npm install',
    '  if errorlevel 1 (',
    '    echo Installation failed. Check internet connection and try again.',
    '    pause',
    '    exit /b 1',
    '  )',
    ')',
    '',
    'echo.',
    'echo Starting WhatsApp sender...',
    'echo If a QR page opens, scan it from WhatsApp on your phone.',
    'echo Keep this window open until sending finishes.',
    'echo.',
    'npm start',
    'echo.',
    'echo Sender finished. You can close this window.',
    'pause',
    '',
  ].join('\r\n');
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'manager');
    const { searchParams, origin } = request.nextUrl;
    const eventId = searchParams.get('event_id');
    const mode = parseMode(searchParams.get('mode'));

    if (!eventId) return apiError('event_id is required', 400);

    const db = createServerClient();
    const { data: event, error: eventError } = await db
      .from('events')
      .select('id,title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) return apiError('Event not found', 404);

    if (session.role === 'manager') {
      const { data: assignment } = await db
        .from('user_event_assignments')
        .select('id')
        .eq('user_id', session.id)
        .eq('event_id', eventId)
        .eq('assigned_role', 'manager')
        .maybeSingle();

      if (!assignment) return apiError('This event is not assigned to this manager', 403);
    }

    const token = await createLocalRunnerToken({
      eventId,
      userId: session.id,
      role: session.role,
    });

    const body = cmdScript({
      appUrl: origin,
      token,
      eventId,
      eventTitle: event.title || 'Event',
      mode,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="rimacle-whatsapp-${mode}-${slugify(event.title || 'event')}.cmd"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    console.error('GET /api/local-runner/launcher error:', err);
    return apiError('Failed to generate WhatsApp launcher', 500);
  }
}
