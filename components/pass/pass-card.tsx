interface PassCardProps {
  event: {
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    venue_address: string;
    venue_contact_number: string | null;
    organizer_contact_number: string | null;
    support_contact_number: string | null;
    footer_note: string | null;
    logo_url: string | null;
  };
  attendee: {
    name: string | null;
    mobile: string;
    email: string | null;
    business_name: string | null;
    seat_number: string | null;
    pass_number: string;
    checked_in_at: string | null;
  };
  qrDataUrl: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatMobile(mobile: string): string {
  return mobile.length === 10 ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : mobile;
}

export default function PassCard({ event, attendee, qrDataUrl }: PassCardProps) {
  const displayName = attendee.name || 'Participant';
  const isCheckedIn = !!attendee.checked_in_at;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">

        {/* ── Header Band ────────────────────────────────── */}
        <div className="bg-emerald-800 px-5 py-4">
          {event.logo_url && (
            <div className="mb-3 flex justify-center">
              <img
                src={event.logo_url}
                alt="Event logo"
                className="h-14 w-auto max-w-[180px] object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <h1 className="text-center text-base font-bold text-white leading-tight">{event.title}</h1>
          <div className="mt-1.5 flex justify-center">
            <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold tracking-wider text-emerald-100 uppercase">
              Visitor Pass
            </span>
          </div>
        </div>

        {/* ── Checked-In Banner ───────────────────────────── */}
        {isCheckedIn && (
          <div className="flex items-center justify-center gap-1.5 bg-emerald-50 border-b border-emerald-200 px-4 py-2">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700">Checked In</span>
          </div>
        )}

        {/* ── Attendee Details ────────────────────────────── */}
        <div className="px-5 pt-5 pb-4">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-stone-900 leading-tight">{displayName}</h2>
            {attendee.business_name && (
              <p className="mt-0.5 text-sm text-stone-500">{attendee.business_name}</p>
            )}
            {attendee.email && (
              <p className="mt-0.5 text-xs text-stone-400">{attendee.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Mobile</div>
              <div className="text-sm font-medium text-stone-800 font-mono">{formatMobile(attendee.mobile)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Pass No.</div>
              <div className="text-sm font-bold text-emerald-800 font-mono">{attendee.pass_number}</div>
            </div>
            {attendee.seat_number && (
              <div className="col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Seat Number</div>
                <div className="text-base font-bold text-stone-900 font-mono">{attendee.seat_number}</div>
              </div>
            )}
          </div>

          {/* ── Divider ─────────────────────────────────── */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-stone-200" />
            </div>
            <div className="absolute -left-[13px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-50 border-r border-stone-200" />
            <div className="absolute -right-[13px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-50 border-l border-stone-200" />
          </div>

          {/* ── QR Code ─────────────────────────────────── */}
          <div className="flex flex-col items-center mt-5 mb-4">
            <div className="rounded-xl border border-stone-100 bg-white p-2.5 shadow-sm">
              <img src={qrDataUrl} alt={`QR code for pass ${attendee.pass_number}`} className="h-48 w-48" width={192} height={192} />
            </div>
            <p className="mt-3 text-center text-xs text-stone-500 leading-relaxed">
              Please show this QR code at event entry
            </p>
          </div>

          {/* ── Divider ─────────────────────────────────── */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-stone-200" />
            </div>
            <div className="absolute -left-[13px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-50 border-r border-stone-200" />
            <div className="absolute -right-[13px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-50 border-l border-stone-200" />
          </div>

          {/* ── Event Info ──────────────────────────────── */}
          <div className="space-y-2.5 mt-5">
            <div className="flex items-start gap-2.5">
              <svg className="h-4 w-4 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <div>
                <div className="text-sm font-medium text-stone-800">{formatDate(event.event_date)}</div>
                <div className="text-xs text-stone-500">{formatTime(event.start_time)} – {formatTime(event.end_time)}</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <svg className="h-4 w-4 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-stone-800">{event.venue_name}</div>
                <div className="text-xs text-stone-500 leading-relaxed">{event.venue_address}</div>
              </div>
            </div>

            {(event.venue_contact_number || event.organizer_contact_number || event.support_contact_number) && (
              <div className="flex items-start gap-2.5">
                <svg className="h-4 w-4 mt-0.5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <div className="text-xs text-stone-600 space-y-0.5">
                  {event.venue_contact_number && (
                    <div>Venue: <a href={`tel:${event.venue_contact_number}`} className="text-emerald-700 font-medium">{event.venue_contact_number}</a></div>
                  )}
                  {event.organizer_contact_number && (
                    <div>Organizer: <a href={`tel:${event.organizer_contact_number}`} className="text-emerald-700 font-medium">{event.organizer_contact_number}</a></div>
                  )}
                  {event.support_contact_number && (
                    <div>Support: <a href={`tel:${event.support_contact_number}`} className="text-emerald-700 font-medium">{event.support_contact_number}</a></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        {event.footer_note && (
          <div className="border-t border-stone-100 bg-stone-50 px-5 py-3">
            <p className="text-center text-[11px] text-stone-500 leading-relaxed">{event.footer_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
