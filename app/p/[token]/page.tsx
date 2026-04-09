import { Metadata } from 'next';
import { isValidToken } from '@/lib/token';
import { getPublicPassByToken } from '@/services/pass.service';
import { generateQrDataUrl } from '@/lib/qr';
import PassCard from '@/components/pass/pass-card';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;

  if (!isValidToken(token)) return { title: 'Invalid Pass' };

  const result = await getPublicPassByToken(token);
  if (result.error || !result.data) return { title: 'Invalid Pass' };

  const { event, attendee } = result.data;
  const name = attendee.name || 'Participant';

  return {
    title: `${name} — ${event.title}`,
    description: `Visitor pass for ${event.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicPassPage({ params }: PageProps) {
  const { token } = await params;

  if (!isValidToken(token)) return <InvalidPass />;

  const result = await getPublicPassByToken(token);
  if (result.error || !result.data) return <InvalidPass />;

  const { event, attendee, pass_url } = result.data;
  const qrDataUrl = await generateQrDataUrl(pass_url);

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-6 flex flex-col items-center">
      <PassCard event={event} attendee={attendee} qrDataUrl={qrDataUrl} />
      <p className="mt-4 text-center text-[11px] text-stone-400">
        This pass is for personal use only. Do not share.
      </p>
    </div>
  );
}

function InvalidPass() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-stone-900">Invalid Pass</h1>
        <p className="mt-1.5 text-sm text-stone-500">
          This visitor pass link is invalid or has expired. Please contact the event organizer for assistance.
        </p>
      </div>
    </div>
  );
}
