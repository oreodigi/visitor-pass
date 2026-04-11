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
    '  echo First-time setup: installing the sender runtime...',
    '  echo This can take a few minutes. Keep this window open.',
    '  where winget >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo Automatic install is not available on this PC.',
    '    echo Opening the official Node.js download page.',
    '    start "" "https://nodejs.org/en/download"',
    '    echo Install Node.js LTS once, then double-click this sender again.',
    '    pause',
    '    exit /b 1',
    '  )',
    '  winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements > "%TEMP%\\rimacle-node-install.log" 2>&1',
    '  set "PATH=%ProgramFiles%\\nodejs;%PATH%"',
    '  where node >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo Runtime install did not finish correctly.',
    '    echo Log: %TEMP%\\rimacle-node-install.log',
    '    pause',
    '    exit /b 1',
    '  )',
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
    '>> ".env" echo MAX_DELAY=60',
    '>> ".env" echo HOURLY_LIMIT=50',
    '>> ".env" echo COUNTRY_CODE=91',
    '>> ".env" echo LIMIT=500',
    '',
    'if not exist "node_modules" (',
    '  echo First-time setup: installing sender engine...',
    '  echo Please wait. This happens only once on this PC.',
    '  call npm install --silent --omit=dev --no-audit --no-fund > "install.log" 2>&1',
    '  if errorlevel 1 (',
    '    echo Sender setup failed. Check internet connection and try again.',
    '    echo Technical log saved at: %TARGET%\\install.log',
    '    pause',
    '    exit /b 1',
    '  )',
    '  echo Sender engine ready.',
    ')',
    '',
    'echo.',
    'echo Starting WhatsApp sender...',
    'echo If a QR page opens, scan it from WhatsApp on your phone.',
    'echo Keep this window open until sending finishes.',
    'echo.',
    'call npm start',
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
