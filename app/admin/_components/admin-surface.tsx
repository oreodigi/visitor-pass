import type { ReactNode } from 'react';

export function AdminHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#1e1b4b_48%,_#312e81)] shadow-[0_30px_80px_-42px_rgba(15,23,42,0.7)]">
      <div className="px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-sky-100/75">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[2.35rem]">{title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-slate-100/95">{description}</p>
          </div>
          {actions ? <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">{actions}</div> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  note,
  tone = 'indigo',
  variant = 'light',
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
  variant?: 'light' | 'dark';
}) {
  const toneMap: Record<string, string> = {
    indigo: 'from-indigo-500/18 to-violet-500/8 border-indigo-200 text-indigo-700',
    emerald: 'from-emerald-500/18 to-teal-500/8 border-emerald-200 text-emerald-700',
    amber: 'from-amber-500/18 to-orange-500/8 border-amber-200 text-amber-700',
    rose: 'from-rose-500/18 to-pink-500/8 border-rose-200 text-rose-700',
    sky: 'from-sky-500/18 to-cyan-500/8 border-sky-200 text-sky-700',
    slate: 'from-slate-400/18 to-slate-200/8 border-slate-200 text-slate-700',
  };

  if (variant === 'dark') {
    return (
      <div className="rounded-[24px] border border-white/20 bg-white/[0.08] p-4 shadow-sm ring-1 ring-white/5 backdrop-blur">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-white/78">{note}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{note}</p>
    </div>
  );
}

export function SurfaceCard({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-36px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-[15px] leading-7 text-slate-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function InlineStatus({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'indigo';
  children: ReactNode;
}) {
  const toneMap: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold ${toneMap[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9A2.25 2.25 0 0118.75 18.75H5.25A2.25 2.25 0 013 16.5v-9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h9m-4.5-4.5v9" />
        </svg>
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-7 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
