import type { PublicPassData } from '@/services/pass.service';

interface Props {
  data: PublicPassData;
  qrDataUrl: string;
  imageHeight: number;
}

function fmtDate(d: string) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

function fmtTime(s: string, e: string) {
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  return `${fmt(s)} – ${fmt(e)}`;
}

export function PassImageTemplate({ data, qrDataUrl, imageHeight }: Props) {
  const { event, attendee } = data;
  const name = attendee.name || 'Participant';
  const terms = event.pass_terms_conditions;

  return (
    <div
      style={{
        width: '600px',
        height: `${imageHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f4',
        fontFamily: 'sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          overflow: 'hidden',
          flex: 1,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#065f46',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {event.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.logo_url}
              alt=""
              style={{ height: '52px', maxWidth: '180px', objectFit: 'contain', marginBottom: '12px', borderRadius: '6px' }}
            />
          )}
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
            {event.title}
          </div>
          <div
            style={{
              marginTop: '8px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '999px',
              padding: '3px 14px',
              color: '#d1fae5',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Visitor Pass
          </div>
        </div>

        {/* Attendee name */}
        <div style={{ padding: '20px 28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#1c1917', textAlign: 'center' }}>{name}</div>
          {attendee.business_name && (
            <div style={{ fontSize: '13px', color: '#78716c', marginTop: '4px' }}>{attendee.business_name}</div>
          )}
        </div>

        {/* Pass details */}
        <div style={{ display: 'flex', padding: '16px 28px', borderBottom: '1px dashed #e7e5e4' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#a8a29e', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mobile</div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#292524', fontFamily: 'monospace', marginTop: '2px' }}>{attendee.mobile}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#a8a29e', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pass No.</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', fontFamily: 'monospace', marginTop: '2px' }}>{attendee.pass_number}</div>
          </div>
          {attendee.seat_number && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#a8a29e', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Seat No.</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1c1917', fontFamily: 'monospace', marginTop: '2px' }}>{attendee.seat_number}</div>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 28px' }}>
          <div style={{ border: '1px solid #e7e5e4', borderRadius: '12px', padding: '10px', backgroundColor: '#ffffff' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" style={{ width: '180px', height: '180px' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#78716c', marginTop: '10px' }}>Show this QR code at event entry</div>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e7e5e4', margin: '0 28px' }} />

        {/* Event details */}
        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ fontSize: '16px', marginTop: '1px' }}>📅</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#292524' }}>{fmtDate(event.event_date)}</div>
              <div style={{ fontSize: '11px', color: '#78716c', marginTop: '2px' }}>{fmtTime(event.start_time, event.end_time)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ fontSize: '16px', marginTop: '1px' }}>📍</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#292524' }}>{event.venue_name}</div>
              <div style={{ fontSize: '11px', color: '#78716c', marginTop: '2px' }}>{event.venue_address}</div>
            </div>
          </div>
          {event.support_contact_number && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '14px' }}>📞</div>
              <div style={{ fontSize: '12px', color: '#78716c' }}>Support: {event.support_contact_number}</div>
            </div>
          )}
        </div>

        {event.footer_note && (
          <div style={{ borderTop: '1px solid #e7e5e4', backgroundColor: '#fafaf9', padding: '10px 28px' }}>
            <div style={{ fontSize: '10px', color: '#a8a29e', textAlign: 'center' }}>{event.footer_note}</div>
          </div>
        )}

        {terms && (
          <div style={{ borderTop: '1px solid #d6d3d1', backgroundColor: '#f5f5f4', padding: '12px 28px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#a8a29e', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Terms &amp; Conditions
            </div>
            <div style={{ fontSize: '9px', color: '#a8a29e', lineHeight: 1.5 }}>{terms}</div>
          </div>
        )}
      </div>
    </div>
  );
}
