'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type NavItemConfig = {
  label: string;
  href: string;
  exact: boolean;
  icon: React.ReactNode;
};

type NavSection = {
  section: string;
  items: NavItemConfig[];
};

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        exact: true,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Event',
    items: [
      {
        label: 'Events',
        href: '/admin/event-settings',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
        ),
      },
      {
        label: 'Upload Contacts',
        href: '/admin/import',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        ),
      },
      {
        label: 'Contacts & Invites',
        href: '/admin/contacts',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        ),
      },
      {
        label: 'Bulk Send Invites',
        href: '/admin/send-invites',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        ),
      },
      {
        label: 'Confirmed Visitors',
        href: '/admin/attendees',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Settings',
    items: [
      {
        label: 'Seat Map',
        href: '/admin/seat-map',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
      {
        label: 'Message Templates',
        href: '/admin/message-templates',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Team',
    items: [
      {
        label: 'Staff Management',
        href: '/admin/staff',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        label: 'App Settings',
        href: '/admin/settings',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        label: 'My Profile',
        href: '/admin/profile',
        exact: false,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

const MOBILE_PRIMARY_LINKS = [
  '/admin',
  '/admin/contacts',
  '/admin/attendees',
  '/admin/event-settings',
];

function isActivePath(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function findCurrentItem(pathname: string) {
  return NAV.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href, item.exact));
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'h-16 border-b border-slate-800 px-4'}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-600 shadow-soft">
        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold leading-tight text-white">Visitor Pass</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">
          Admin Control
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  exact,
  pathname,
  onClick,
  mobile = false,
}: NavItemConfig & {
  pathname: string;
  onClick?: () => void;
  mobile?: boolean;
}) {
  const active = isActivePath(pathname, href, exact);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-600 text-white shadow-soft'
          : mobile
            ? 'text-slate-100 hover:bg-slate-800/90 hover:text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className={`shrink-0 transition-colors ${active ? 'text-white' : mobile ? 'text-slate-300 group-hover:text-white' : 'text-slate-400 group-hover:text-white'}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarNav({
  pathname,
  onItemClick,
  mobile = false,
}: {
  pathname: string;
  onItemClick?: () => void;
  mobile?: boolean;
}) {
  return (
    <nav className={`flex-1 overflow-y-auto px-3 ${mobile ? 'py-5' : 'space-y-5 py-4'}`}>
      {NAV.map(({ section, items }) => (
        <div key={section} className={mobile ? 'mb-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5' : ''}>
          <p className={`mb-2 px-3 text-[11px] font-black uppercase tracking-[0.28em] ${mobile ? 'text-slate-300' : 'text-slate-400'}`}>
            {section}
          </p>
          <div className="space-y-1">
            {items.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                pathname={pathname}
                onClick={onItemClick}
                mobile={mobile}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function MobileDock({
  pathname,
  onMoreClick,
}: {
  pathname: string;
  onMoreClick: () => void;
}) {
  const items = NAV.flatMap((section) => section.items).filter((item) => MOBILE_PRIMARY_LINKS.includes(item.href));

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.35rem)' }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pb-2 pt-2">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                active
                  ? 'bg-slate-950 text-white shadow-soft'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              <span className="truncate">{item.label.replace('Contacts & Invites', 'Contacts').replace('Confirmed Visitors', 'Visitors')}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75h.008v.008H12V6.75zm0 5.242h.008V12H12v-.008zm0 5.258h.008v.008H12v-.008z" />
            </svg>
          </span>
          <span className="truncate">More</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const currentItem = useMemo(() => findCurrentItem(pathname), [pathname]);

  const logoutBtn = (
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-700 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
      </svg>
      {loggingOut ? 'Signing out...' : 'Sign out'}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-800 lg:bg-slate-950">
        <BrandBlock />
        <SidebarNav pathname={pathname} />
        <div className="border-t border-slate-800 p-3">{logoutBtn}</div>
      </aside>

      <div className="lg:hidden">
        <header
          className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                aria-label="Open menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {currentItem?.label || 'Admin Panel'}
                </div>
                <div className="truncate text-xs text-slate-500">Manage events, invites, staff and check-ins</div>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-600 text-white shadow-soft">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col border-r border-slate-800 bg-slate-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-800 px-4 py-5">
                <div className="flex items-start justify-between gap-4">
                  <BrandBlock compact />
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                    aria-label="Close menu"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Current Screen</div>
                  <div className="mt-1 text-base font-semibold text-white">{currentItem?.label || 'Admin Panel'}</div>
                </div>
              </div>
              <SidebarNav pathname={pathname} onItemClick={() => setMobileOpen(false)} mobile />
              <div className="border-t border-slate-800 p-4">{logoutBtn}</div>
            </aside>
          </div>
        )}

        <MobileDock pathname={pathname} onMoreClick={() => setMobileOpen(true)} />
      </div>

      <main className="lg:pl-64">
        <div className="lg:hidden" style={{ height: 'calc(env(safe-area-inset-top) + 4rem)' }} />
        <div className="min-h-screen pb-28 lg:pb-0">{children}</div>
      </main>
    </div>
  );
}
