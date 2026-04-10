'use client';

interface Props {
  token: string;
  passNumber: string;
}

export default function PassDownloadButton({ token, passNumber }: Props) {
  return (
    <a
      href={`/api/pass/image?token=${token}`}
      download={`visitor-pass-${passNumber}.png`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.98] transition-all"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Download Pass Image
    </a>
  );
}
