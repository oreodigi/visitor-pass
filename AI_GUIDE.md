# AI Developer Guide — Visitor Pass

This file is written for AI coding assistants (Claude, Codex, Copilot, etc.) taking over this codebase.
It explains the architecture, every important pattern, known pitfalls, and how to safely add/modify/delete anything.
Read this before touching any file.

---

## 1. What This App Does (30-second summary)

A multi-tenant event management system. Admins create events, upload contacts, send WhatsApp invites, and manage staff. Contacts self-register, become attendees, and receive QR-coded visitor passes. Gate staff scan QR codes at the venue. Three portals: `/admin`, `/manager`, `/staff`.

**Deployed at:** `https://ticket.rimacle.com/`  
**GitHub (source of truth):** `github.com/oreodigi/visitor-pass`  
**GitHub (Vercel watches this):** `github.com/oreodigi/visitor-passx`

To deploy: `git push vercel main && git push origin main`

---

## 2. Tech Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x strict |
| Styling | Tailwind CSS | 3.x |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.x |
| Auth | `jose` (HS256 JWT) | 5.x |
| Email | Nodemailer | 8.x |
| QR code | `qrcode` | 1.5.x |
| Pass image | Satori + sharp | runtime rendering |
| WhatsApp | Baileys (whatsapp-web.js) | 1.34.x |
| Font | DM Sans via next/font/google | — |

No Supabase Auth. No NextAuth. No Prisma. No Redux. No external UI component library.

---

## 3. Repository Layout

```
app/                    Next.js App Router pages + API routes
  layout.tsx            Root layout — DM Sans font, global metadata
  page.tsx              Redirects to correct portal based on session role
  error.tsx             REQUIRED — App Router error boundary (crashes loop without it)
  global-error.tsx      REQUIRED — catches errors in root layout itself
  login/                Public login page (dark split-panel design)
  forgot-password/      Request reset email (anti-enumeration)
  reset-password/[token]/ Set new password via email link
  admin/                Role: admin — full control
  manager/              Role: manager — read-only assigned events
  staff/                Role: gate_staff — QR check-in terminal
  invite/[token]/       Public self-registration form
  p/[token]/            Public visitor pass display
  api/                  All API routes (Next.js Route Handlers)

components/
  pass/                 pass-card.tsx, pass-download-button.tsx
  profile/              profile-form.tsx — shared by all 3 portals

lib/
  auth.ts               JWT create/verify, requireAuth, requireRole
  constants.ts          Cookie name, session TTL, mobile regex
  csv-parser.ts         CSV parsing with column alias resolution
  mailer.ts             Nodemailer wrapper — welcome + reset emails
  qr.ts                 QR code data URL generator
  seat-map.ts           Seat availability + assignment logic
  token.ts              Crypto token + pass-number generation
  utils.ts              apiSuccess, apiError, sanitizeString, isValidMobile, normalizeMobile
  wa-client.ts          WhatsApp singleton session (Baileys)
  wa-sender.ts          Bulk send loop + SSE progress
  whatsapp.ts           Template variable substitution
  supabase/server.ts    Service-role Supabase client (server only)
  supabase/client.ts    Anon-key Supabase client (browser safe)

services/
  attendee.service.ts   Attendee CRUD + CSV batch import
  contact.service.ts    Contact CRUD + invitation token
  event.service.ts      Event CRUD, logo upload, partner logos
  pass.service.ts       Pass generation (single + bulk), QR token

types/
  enums.ts              UserRole, EventStatus, InviteStatus, AttendeeStatus
  database.ts           TypeScript interfaces for every DB table row
  dto.ts                Request/response body shapes
  index.ts              Re-exports all of the above

middleware.ts           Edge middleware — role-based route guard
db/                     SQL migration files (run in Supabase SQL Editor in order)
```

---

## 4. Database Schema

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| name | TEXT | required |
| email | TEXT UNIQUE | lowercase |
| mobile | TEXT | 10-digit normalized |
| password_hash | TEXT | bcrypt via pgcrypto |
| role | TEXT | `admin` / `manager` / `gate_staff` |
| designation | TEXT nullable | job title |
| profile_picture_url | TEXT nullable | added by migrate-v9 |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `events`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| title | TEXT | |
| description | TEXT nullable | |
| event_date | DATE | |
| start_time | TIME nullable | |
| end_time | TIME nullable | |
| venue | TEXT nullable | |
| status | TEXT | `draft`/`active`/`completed`/`cancelled` |
| logo_url | TEXT nullable | Supabase Storage URL |
| max_visitors | INT nullable | migrate-v6 |
| vip_seats | INT nullable | migrate-v6 |
| partners | JSONB nullable | `[{name, logo_url}]` — migrate-v7 |
| seat_map_config | JSONB nullable | `{rows:[{label,seats}]}` — migrate-v5 |
| invite_message_template | TEXT nullable | migrate-v4 |
| pass_message_template | TEXT nullable | migrate-v4 |
| pass_terms_conditions | TEXT nullable | migrate-v4 |
| footer_note | TEXT nullable | |
| created_by | UUID FK users | |
| created_at / updated_at | TIMESTAMPTZ | |

#### `attendees`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK events | |
| contact_id | UUID FK contacts nullable | migrate-v2 |
| name | TEXT | |
| mobile | TEXT | |
| email | TEXT nullable | migrate-v2 |
| business_name | TEXT nullable | |
| pass_number | TEXT nullable | generated |
| qr_token | TEXT UNIQUE nullable | 32-byte hex |
| seat_number | TEXT nullable | migrate-v2 |
| status | TEXT | `pending`/`checked_in`/`cancelled` |
| checked_in_at | TIMESTAMPTZ nullable | |
| gate_name | TEXT nullable | |
| created_at / updated_at | TIMESTAMPTZ | |

#### `contacts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK events | |
| name | TEXT | |
| mobile | TEXT | |
| email | TEXT nullable | |
| business_name | TEXT nullable | |
| invite_token | TEXT UNIQUE | 16-byte hex |
| invite_status | TEXT | `uploaded`/`invited`/`confirmed`/`cancelled` |
| created_at / updated_at | TIMESTAMPTZ | |

#### `checkin_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| attendee_id | UUID FK attendees | |
| event_id | UUID FK events | |
| scanned_at | TIMESTAMPTZ | |
| gate_name | TEXT nullable | |
| result | TEXT | `success`/`duplicate`/`invalid` |

#### `user_event_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK users | |
| event_id | UUID FK events | |
| assigned_role | TEXT | role at assignment time |
| created_at | TIMESTAMPTZ | |

#### `app_settings`
| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | setting name |
| value | TEXT | setting value |
| updated_at | TIMESTAMPTZ | |

#### `password_reset_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK users ON DELETE CASCADE | |
| token | TEXT UNIQUE | 32-byte hex |
| expires_at | TIMESTAMPTZ | 1 hour from creation |
| used_at | TIMESTAMPTZ nullable | set when consumed |
| created_at | TIMESTAMPTZ | |

### Migration order (MUST be run in this exact order)
1. `schema.sql` — creates core tables
2. `auth-functions.sql` — creates pgcrypto RPC functions + seeds default users
3. `storage-setup.sql` — creates `event-logos` bucket
4. `migrate-v2.sql` — adds email/seat_number/contact_id to attendees, creates contacts
5. `migrate-v3.sql` — adds manager role, designation, user_event_assignments
6. `migrate-v4.sql` — adds message templates to events
7. `migrate-v5.sql` — adds seat_map_config to events
8. `migrate-v6.sql` — adds max_visitors, vip_seats to events
9. `migrate-v7.sql` — adds partners JSONB to events
10. `migrate-v8.sql` — creates app_settings table
11. `migrate-v9.sql` — adds profile_picture_url to users + creates avatars bucket
12. `migrate-v10.sql` — creates password_reset_tokens table

**Next migration to add should be `migrate-v11.sql`.**

---

## 5. Auth System

### Files
- `lib/auth.ts` — all auth logic
- `lib/constants.ts` — cookie name (`vp_session`), session TTL (7 days)
- `middleware.ts` — Edge route guard

### How sessions work
1. Login → `POST /api/auth/login` → verifies password via `verify_password` RPC (bcrypt) → creates HS256 JWT → sets `vp_session` HTTP-only SameSite=Lax cookie
2. Every page request → `middleware.ts` reads + verifies cookie → redirects to `/login` if invalid/missing or wrong role for the path
3. Every API handler → calls `await requireAuth()` or `await requireRole('admin')` at the top → throws `AuthError` on failure → caught and returned as `apiError(err.message, err.status)`

### JWT payload
```typescript
{ uid: string, name: string, email: string | null, role: UserRole }
```
JWT expiry = 7 days. No refresh token. Re-login required after expiry.

### Adding a new protected route
- Page: add the path prefix to `middleware.ts` allowed-roles map
- API: add `await requireRole('admin')` (or `requireAuth()` for any logged-in user) as the first line in the handler

### Password hashing
Passwords are hashed via `crypt_password(password)` PostgreSQL RPC — bcrypt via pgcrypto extension. The `hashPassword()` and `verifyPassword()` functions in `lib/auth.ts` call these RPCs.

---

## 6. API Route Patterns

### Every API route file starts with
```typescript
export const dynamic = 'force-dynamic';
```
This prevents Next.js from statically caching API responses.

### Standard response helpers (`lib/utils.ts`)
```typescript
return apiSuccess(data);           // 200 { success: true, data }
return apiSuccess(data, 201);      // 201 { success: true, data }
return apiError('message', 400);   // 400 { success: false, error: { message } }
```

### Auth guard pattern
```typescript
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin');   // throws AuthError if not admin
    // ... handler logic
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.message, err.status);
    return apiError('Internal server error', 500);
  }
}
```

### Supabase query pattern
```typescript
const db = createServerClient();    // always import from lib/supabase/server
const { data, error } = await db.from('table').select('...').eq('id', id).single();
if (error) return apiError('message', 500);
```

### Input sanitization
Always run user string inputs through `sanitizeString()` (strips HTML, trims whitespace) and `normalizeMobile()` / `isValidMobile()` for phone numbers.

```typescript
const name = sanitizeString(body.name || '');
const mobile = normalizeMobile(body.mobile || '');
if (!isValidMobile(mobile)) return apiError('Invalid mobile number', 400);
```

---

## 7. File Upload Pattern (CRITICAL)

Uploading to Supabase Storage from a Next.js API route requires converting the `File` object to a `Buffer`. Passing the `File` directly fails silently or uploads corrupted data.

### Always do this
```typescript
const file = form.get('logo') as File | null;
if (!file || file.size === 0) return apiError('No file', 400);
if (file.size > 2 * 1024 * 1024) return apiError('Max 2MB', 400);

// Derive MIME type from extension — browsers sometimes send empty or wrong type
const ext = (file.name.split('.').pop() || 'png').toLowerCase();
const extMap: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};
const contentType = extMap[ext] || file.type;

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const { error } = await db.storage
  .from('event-logos')
  .upload(path, buffer, { cacheControl: '3600', upsert: true, contentType });
```

### Buckets in use
| Bucket | Contents |
|--------|---------|
| `event-logos` | Event logos, partner logos, app logo, user avatars |

All uploads go to the `event-logos` bucket. Avatars are stored at path `avatars/{userId}/avatar-{timestamp}.{ext}`.  
App logos are stored at `app-logo/logo-{timestamp}.{ext}`.

---

## 8. Email System

### File
`lib/mailer.ts`

### How it works
1. `getSmtpConfig()` — reads SMTP settings from `app_settings` table (not `.env`)
2. `makeTransporter(s)` — returns `null` if SMTP not configured (dev mode)
3. If transporter is `null`, logs the email content to console and returns (no error thrown)
4. `htmlWrapper(appName, logoUrl, content)` — wraps content in branded HTML email template

### Functions to call
```typescript
import { sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/mailer';

// Non-blocking pattern — email failure must never fail the API response
sendWelcomeEmail({ to, name, email, password, role, designation })
  .catch((err) => console.error('email error:', err));

sendPasswordResetEmail({ to, name, resetUrl })
  .catch((err) => console.error('email error:', err));
```

### Adding a new email type
1. Add a new `export async function sendXxxEmail(opts: XxxEmailOptions)` in `lib/mailer.ts`
2. Reuse `getSmtpConfig()`, `makeTransporter()`, and `htmlWrapper()`
3. Always handle the no-transporter case (log to console)
4. Always call non-blocking from the API route

---

## 9. Migration Resilience Pattern

When a migration adds a new column, existing API routes that `SELECT` that column will fail on environments where the migration hasn't run yet. Use this fallback pattern:

```typescript
let { data, error } = await db
  .from('users')
  .select('id, name, profile_picture_url')  // new column
  .eq('id', id)
  .single();

if (error) {
  // Retry without the new column for pre-migration environments
  const fallback = await db
    .from('users')
    .select('id, name')
    .eq('id', id)
    .single();
  if (fallback.error || !fallback.data) return apiError('Not found', 404);
  data = { ...fallback.data, profile_picture_url: null } as typeof data;
}
```

This pattern is used in `app/api/profile/route.ts` for `profile_picture_url`.

---

## 10. Page Structure Conventions

### Admin pages
Every admin page is a client component (`'use client'`). They:
1. Fetch data from their corresponding API route via `fetch('/api/...')`
2. Use the event selector in `app/admin/_components/event-selector.tsx` to switch events
3. Use Tailwind classes for layout — no CSS modules, no styled components

### Portal layouts
Each portal has a `layout.tsx` that:
1. Calls `/api/auth/me` server-side to get the session
2. Redirects to `/login` if no session or wrong role
3. Renders a sidebar nav + `{children}`

### Shared ProfileForm
All three portals' profile pages just render `<ProfileForm />` from `components/profile/profile-form.tsx`. To change profile UI, edit that one file.

---

## 11. Error Boundary Files (DO NOT DELETE)

`app/error.tsx` and `app/global-error.tsx` are required by Next.js App Router.  
Deleting either file causes an infinite `missing required error components, refreshing...` loop for ALL users.

- `error.tsx` — must be `'use client'`, receives `{ error, reset }` props, renders a "Try again" UI
- `global-error.tsx` — must render its own `<html><body>` wrapper (it replaces the root layout)

---

## 12. Middleware Route Guards

`middleware.ts` runs at the Edge before every request. It:
1. Reads the `vp_session` cookie
2. Verifies the JWT
3. Checks role against the requested path prefix

```
/admin/*    → requires role: admin
/manager/*  → requires role: manager
/staff/*    → requires role: gate_staff
/api/admin/* → requires role: admin (double-checked in each handler too)
```

Public paths that bypass the guard: `/login`, `/forgot-password`, `/reset-password/*`, `/p/*`, `/invite/*`, `/api/auth/*`, `/api/pass/*`, `/api/invite/*`

---

## 13. WhatsApp Integration

- WhatsApp session is held in-memory as a singleton in `lib/wa-client.ts`
- Session does NOT survive server restarts — user must re-scan QR after each restart
- Bulk send progress is tracked via SSE (`/api/whatsapp/progress`)
- Message template variables: `{name}`, `{event}`, `{date}`, `{venue}`, `{link}`, `{pass_number}`, `{seat_number}`
- WhatsApp only works reliably in a persistent server (Vercel serverless functions may disconnect the session between requests)

---

## 14. Pass Image Generation

`app/api/pass/image/route.tsx` (note: `.tsx`, NOT `.ts`)

Flow: DB lookup → `pass-template.tsx` JSX → Satori (JSX→SVG) → sharp (SVG→PNG) → HTTP response with `Content-Disposition: attachment`

**Never rename to `.ts`** — Satori requires JSX syntax which requires a `.tsx` file.  
**Never create a duplicate `route.ts`** alongside `route.tsx` — Next.js will warn about duplicate pages.

---

## 15. Design System

All styling is Tailwind CSS. Custom design tokens are in `app/globals.css`:

| Class | Use |
|-------|-----|
| `input-field` | All text/email/select inputs |
| `btn-primary` | Primary actions (indigo/violet gradient) |
| `btn-secondary` | Secondary actions |
| `card` | White card with shadow |
| `badge-admin` / `badge-manager` / `badge-gate_staff` | Role badges |

**Brand colors:**
- Primary: `indigo-600` / `#4f46e5`
- Secondary: `violet-600` / `#7c3aed`
- Gradient: `from-brand-700 to-violet-700` (brand-700 = indigo-700)

**Mobile-first:** The admin dashboard uses `sm:` breakpoints extensively. Default styles are mobile, `sm:` overrides are for desktop.

---

## 16. Common Tasks

### Add a new page to the admin portal
1. Create `app/admin/your-page/page.tsx` as `'use client'`
2. Add the nav link to `app/admin/layout.tsx`
3. Create `app/api/your-resource/route.ts` with `export const dynamic = 'force-dynamic'`
4. Guard with `await requireRole('admin')` at the top of every handler

### Add a new DB column
1. Write `db/migrate-vN.sql` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
2. Run it in Supabase SQL Editor
3. Update `types/database.ts` with the new column
4. Update any API routes that need the new column (use the resilience fallback pattern if in doubt)
5. Update this guide and README.md

### Add a new setting key
1. Add the key to the `allowedKeys` array in `app/api/settings/route.ts`
2. Add a seed row to the next migration file
3. Update the `app_settings` table documentation in this file and README.md

### Send a new type of email
1. Add a new function to `lib/mailer.ts` following the existing pattern
2. Call it non-blocking from the relevant API route

### Add a new role
You'd need to:
1. Add the value to `UserRole` in `types/enums.ts`
2. Update `middleware.ts` to map the new role to its protected paths
3. Create the portal layout at `app/[role]/layout.tsx`
4. Update `lib/auth.ts` `requireRole` if needed
5. Add a new migration for any DB changes

---

## 17. Things That Have Bitten Us (Do Not Repeat)

| Mistake | What happened | Fix |
|---------|--------------|-----|
| Missing `error.tsx` | All rendering errors caused infinite refresh loop in browser | Created `app/error.tsx` and `app/global-error.tsx` |
| Multiple dev server instances | Browsing the wrong port (stale build) | Kill all node processes: `Get-Process -Name node \| Stop-Process -Force` |
| Stale `.next` cache | New files not found after adding them | `rm -rf .next && npm run dev` |
| `route.ts` + `route.tsx` same path | Next.js duplicate page warning, unpredictable behavior | Keep only `.tsx` for JSX routes |
| Pushing to `origin` instead of `vercel` | Vercel didn't deploy | `git push vercel main` is the deploy command |
| Uploading `File` directly to Supabase | Corrupted or zero-byte uploads | Convert to `Buffer` via `file.arrayBuffer()` first |
| Running migrations out of order | `relation "app_settings" does not exist` when running v9 before v8 | Always run in numbered order |
| `file.type` for MIME detection | Browsers send empty string or `image/jpg` (invalid) | Derive from extension using `extMap` |
| Non-blocking email omitted | Email failure threw and failed the entire API response | Always `.catch()` email sends |

---

## 18. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Anon/public key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=        # Service-role key (server only — NEVER expose to client)
JWT_SECRET=                       # Min 32 chars — signs session JWTs
NEXT_PUBLIC_APP_URL=              # Full origin, e.g. https://ticket.rimacle.com
```

SMTP config is stored in the **database** (`app_settings`), not in `.env`.

---

## 19. Deployment

**Platform:** Vercel  
**Domain:** `https://ticket.rimacle.com/`  
**Trigger:** push to `github.com/oreodigi/visitor-passx` (the `vercel` remote)

```bash
# Deploy
git push vercel main && git push origin main
```

After deploying a migration, you must run the SQL manually in the Supabase dashboard. Vercel does NOT run migrations automatically.

---

## 20. Current State (as of 2026-04-11)

All migrations through v10 are in `db/`. The app owner needs to run `db/migrate-v10.sql` if they haven't already — it creates the `password_reset_tokens` table for the forgot-password flow.

**All features are implemented and working:**
- Multi-role auth with custom JWT
- Full event lifecycle management
- Contact import, invitation flow, attendee management
- QR pass generation + PNG download
- QR check-in at gate
- Seat map builder
- WhatsApp bulk messaging with SSE progress
- Staff/manager/admin creation with welcome emails
- Forgot-password / reset-password flow
- Profile management with avatar upload
- App settings (branding + SMTP)
- Mobile-first admin dashboard
- Redesigned login page
