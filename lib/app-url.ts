const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

function parseUrl(value?: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalOrigin(url: URL | null): boolean {
  if (!url) return false;
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
}

export function resolveAppOrigin(originHint?: string): string {
  const configured = parseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const hinted = parseUrl(originHint);

  if (configured && !isLocalOrigin(configured)) {
    return configured.origin;
  }

  if (hinted) {
    return hinted.origin;
  }

  if (configured) {
    return configured.origin;
  }

  return DEFAULT_APP_ORIGIN;
}

export function buildAppUrl(path: string, originHint?: string): string {
  return new URL(path, resolveAppOrigin(originHint)).toString();
}

function normalizePathname(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  if (collapsed.startsWith('/invite/')) {
    return collapsed.replace('/invite/', '/i/');
  }
  return collapsed;
}

export function normalizePublicUrl(rawUrl: string, originHint?: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('/')) {
    return buildAppUrl(normalizePathname(trimmed), originHint);
  }

  const parsed = parseUrl(trimmed);
  if (!parsed) {
    return trimmed;
  }

  parsed.pathname = normalizePathname(parsed.pathname);

  if (isLocalOrigin(parsed)) {
    return new URL(
      `${parsed.pathname}${parsed.search}${parsed.hash}`,
      resolveAppOrigin(originHint)
    ).toString();
  }

  return parsed.toString();
}
