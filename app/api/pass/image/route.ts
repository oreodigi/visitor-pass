import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { isValidToken } from '@/lib/token';
import { getPublicPassByToken } from '@/services/pass.service';
import { generateQrDataUrl } from '@/lib/qr';
import { PassImageTemplate } from './pass-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/pass/image?token=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || !isValidToken(token)) {
    return new Response('Invalid token', { status: 400 });
  }

  const result = await getPublicPassByToken(token);
  if (result.error || !result.data) {
    return new Response('Pass not found', { status: 404 });
  }

  const qrDataUrl = await generateQrDataUrl(result.data.pass_url);
  const imageHeight = result.data.event.pass_terms_conditions ? 1000 : 860;

  const response = new ImageResponse(
    PassImageTemplate({ data: result.data, qrDataUrl, imageHeight }),
    { width: 600, height: imageHeight }
  );

  const png = await response.arrayBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="visitor-pass-${result.data.attendee.pass_number || 'pass'}.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
