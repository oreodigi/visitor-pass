# Visitor Pass — Event Check-in Management System

A full-stack web application for managing event visitor passes, QR-based check-in, invitation flows, WhatsApp notifications, email notifications, and multi-role staff management.

Built with **Next.js 14 App Router**, **Supabase** (PostgreSQL + Storage), **Tailwind CSS**, and a custom JWT auth system.

---

## Table of Contents

- [Features](#features)
- [Roles & Access Control](#roles--access-control)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [How to Run Migrations](#how-to-run-migrations)
- [Project Structure](#project-structure)
- [Pages & Portals](#pages--portals)
- [API Reference](#api-reference)
- [Auth System](#auth-system)
- [Forgot Password Flow](#forgot-password-flow)
- [Email / SMTP System](#email--smtp-system)
- [CSV Import Format](#csv-import-format)
- [Pass Generation](#pass-generation)
- [Seat Map](#seat-map)
- [WhatsApp Integration](#whatsapp-integration)
- [Profile Management](#profile-management)
- [App Settings](#app-settings)
- [Staff Management](#staff-management)
- [Error Handling](#error-handling)
- [Developer Notes](#developer-notes)
- [Deployment Checklist](#deployment-checklist)
- [Tech Stack](#tech-stack)

---

## Features

### Event Management
- Create and manage multiple events with full details (title, date, time, venue, contacts)
- Event statuses: `draft` → `active` → `completed` / `cancelled`
- Per-event capacity controls: **Max Visitors** and **VIP / Management seats**
- Upload event logo (PNG/JPG, up to 2 MB, stored in Supabase Storage `event-logos` bucket)
- Add **Partners & Sponsors** with logos shown in the pass footer
- Custom per-event message templates for invite and pass WhatsApp messages
- Per-event **Terms & Conditions** printed at the bottom of every pass
- Per-event **Footer Note** shown on the pass
- Live pass preview panel while editing event settings

### Contact & Invitation Flow
- Upload contacts via CSV with smart column-alias detection
- Generate unique invitation tokens per contact
- Send WhatsApp invitation messages via the Baileys (web-based) WhatsApp client
- Contacts self-register via a public invitation link (`/invite/[token]`)
- Registration form captures name, mobile, email, company
- Confirmed contacts become attendees automatically
- Track invite statuses: `uploaded → invited → confirmed / cancelled`

### Visitor Pass System
- Generate QR-coded visitor passes for confirmed attendees
- Passes contain: attendee name, business, mobile, pass number, seat number, QR code, event details, partner logos, T&C
- Unique cryptographically secure QR tokens per attendee (32-byte hex)
- Pass number format: `[PREFIX]-[SEQUENCE]` e.g. `APR26-MSME-001`
- Sequential seat assignment or seat map–based assignment
- Public pass page at `/p/[token]` — no login required
- Download pass as a high-quality PNG image (rendered via Satori + sharp)
- Bulk pass generation for all attendees in one click

### QR Check-in
- Gate staff scan QR codes on any device via the Staff Terminal
- Real-time check-in result: Valid / Duplicate / Invalid
- Records check-in timestamp and gate name
- Full check-in log per attendee
- Manual check-in override by admin

### Seat Map
- Configure rows × seats per row with optional row labels
- Visual seat grid with colour-coded availability (available / assigned / VIP)
- Seats auto-assigned from map during pass generation
- Seat reservation for VIP / management (blocked seats)
- Per-event seat map — each event has its own layout

### Staff Management (Admin)
- Create staff with roles: **Admin**, **Manager**, or **Gate Staff**
- All three roles visible and manageable from one page (role tabs: All / Admins / Managers / Event Staff)
- Assign staff to specific events
- Enable / disable accounts (soft disable)
- Hard delete accounts with confirmation modal (type "DELETE" to confirm)
- Edit name, email, mobile, designation, password
- **Welcome email** automatically sent to new staff with their login credentials
- Self-protection guards: cannot delete, demote, or deactivate your own account or the last active admin
- "You" badge shown on your own row

### Team Portals
- **Admin Panel** (`/admin`) — full control: events, attendees, contacts, passes, staff, settings
- **Manager Portal** (`/manager`) — read-only dashboard with check-in stats for assigned events
- **Staff Terminal** (`/staff`) — optimised mobile-first QR scan interface for gate check-in

### Profile Management
- Every user (admin / manager / staff) can update their own name, email, mobile, designation
- Profile picture upload (shown as avatar with initials fallback)
- Password change requires current password verification
- JWT session cookie is automatically re-issued when name or email changes

### Login & Password Reset
- Redesigned login page: dark split-panel with animated gradient, feature pills, and pass preview
- **Forgot Password** flow at `/forgot-password` — sends a reset link via email
- Anti-enumeration: always shows "check your inbox" regardless of email existence
- **Reset Password** at `/reset-password/[token]` — password strength meter, confirm field, auto-redirect after success
- Tokens are single-use, expire in 1 hour, stored in `password_reset_tokens` table

### Application Settings (Admin Only)
- **General** tab: app name, tagline, logo upload, support email, support phone
- **SMTP / Email** tab: full SMTP configuration — host, port, security (STARTTLS / SSL / None), username, password, From name and address

### Email Notifications
- Welcome email sent on every new staff/manager/admin creation
- Password reset email with a time-limited reset link
- Branded HTML emails with gradient header, role badge, credentials box, and CTA button
- Dev fallback: credentials and reset URL logged to console when SMTP is not configured

### WhatsApp Messaging
- Integrate the WhatsApp Web client via Baileys (no cloud API key needed)
- Scan QR code to connect your WhatsApp number
- Bulk-send invite messages with per-contact invite link
- Bulk-send pass messages with per-attendee pass link
- Real-time send progress via Server-Sent Events (SSE)
- Configurable per-event message templates with placeholder variables

### Admin Dashboard (Mobile-First)
- Gradient hero header on mobile with compact icon-only controls
- Colored gradient stat cards with `active:scale` touch feedback
- Active event promoted to a full-width tappable hero card at the top
- Quick actions: 3×2 grid on mobile with colored backgrounds and emoji icons
- Recent activity: tabbed interface (Check-ins / Passes) instead of side-by-side columns
- Visitor funnel with shorter labels on mobile, percentage column hidden on small screens

---

## Roles & Access Control

| Role | Login Portal | Access |
|------|-------------|--------|
| `admin` | `/admin` | Full access — events, attendees, contacts, passes, staff, settings, all APIs |
| `manager` | `/manager` | Read-only dashboard for assigned events only |
| `gate_staff` | `/staff` | QR scan check-in terminal only |

Route protection is enforced at **two layers**:

1. **Middleware** (`middleware.ts`) — runs at the Next.js Edge before the page loads; redirects unauthenticated or wrong-role requests to `/login`
2. **`requireRole()`** / **`requireAuth()`** — called inside every API route handler; returns 401/403 JSON if the check fails

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your Supabase URL, keys, and a strong JWT_SECRET

# 3. Run all SQL migrations in order (see "How to Run Migrations" below)

# 4. Start development server
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login)

### Default Credentials

Seeded by `auth-functions.sql`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@msme.local` | `admin123` |
| Gate Staff | `staff@msme.local` | `staff123` |

> **Change all default passwords immediately before any real use.**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key (server-side only — never expose to client) |
| `JWT_SECRET` | Yes | Minimum 32 chars — signs session tokens. Generate: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | Yes | Full origin URL e.g. `https://yourapp.com` — used in QR pass links and invite links |

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<output of: openssl rand -base64 48>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database Migrations

All migration files live in `db/`. Run them in the listed order — each file is idempotent (safe to re-run).

| File | What it does |
|------|-------------|
| `schema.sql` | Core tables: `events`, `users`, `attendees`, `checkin_logs` |
| `auth-functions.sql` | `crypt_password` / `verify_password` RPC functions via `pgcrypto`; seeds default admin + gate staff users |
| `storage-setup.sql` | Creates the `event-logos` Supabase Storage bucket with public-read policy |
| `migrate-v2.sql` | Adds `email`, `seat_number`, `contact_id` to attendees; creates `contacts` table with invitation token |
| `migrate-v3.sql` | Adds `manager` role; `designation` column on `users`; `user_event_assignments` join table |
| `migrate-v4.sql` | Adds `invite_message_template`, `pass_message_template`, `pass_terms_conditions` to `events` |
| `migrate-v5.sql` | Adds `seat_map_config JSONB` to `events` |
| `migrate-v6.sql` | Adds `max_visitors` and `vip_seats` to `events` |
| `migrate-v7.sql` | Adds `partners JSONB` to `events` |
| `migrate-v8.sql` | Creates `app_settings` key/value table; seeds SMTP and app-name rows |
| `migrate-v9.sql` | Adds `profile_picture_url TEXT` to `users`; seeds extra `app_settings` rows |
| `migrate-v10.sql` | Creates `password_reset_tokens` table for the forgot-password flow |

### Dependency order — IMPORTANT

Each migration assumes the previous one has already run. If you skip a migration:

- Running `migrate-v9.sql` before `migrate-v8.sql` will fail with `relation "app_settings" does not exist`
- Running `migrate-v10.sql` before `schema.sql` will fail because the `users` table won't exist

Always run migrations in the numbered order.

### migrate-v9.sql extra step

After running `migrate-v9.sql`, run this SQL separately to create the avatars storage bucket:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Service upload access for avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Service update access for avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars');
```

---

## How to Run Migrations

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the migration file (e.g. `db/schema.sql`), copy its full contents, paste into the editor
4. Click **Run** (or `Ctrl+Enter`)
5. Confirm success in the output panel (`Success. No rows returned`)
6. Repeat for each migration file **in order**

To verify a migration ran correctly:

```sql
-- Example: verify migrate-v10 ran
SELECT table_name FROM information_schema.tables
WHERE table_name = 'password_reset_tokens';
```

---

## Project Structure

```
visitor-pass/
├── app/
│   ├── layout.tsx                      # Root layout (DM Sans font, Tailwind, metadata)
│   ├── page.tsx                        # Auto-redirect based on session role
│   ├── error.tsx                       # App Router error boundary (catches render errors)
│   ├── global-error.tsx                # Root layout error boundary (required by Next.js)
│   ├── globals.css                     # Design tokens + utility classes (input-field, btn-primary, card, badge-*)
│   ├── login/page.tsx                  # Dark split-panel login form (email + password + forgot link)
│   ├── forgot-password/page.tsx        # Request password reset — anti-enumeration always shows "check inbox"
│   ├── reset-password/[token]/page.tsx # Set new password — validates token, strength meter, auto-redirect
│   │
│   ├── admin/                          # Admin portal — role: admin
│   │   ├── layout.tsx                  # Sidebar nav (Overview, Event, Settings, Team, Account sections)
│   │   ├── page.tsx                    # Mobile-first dashboard (KPI stats, funnel, recent activity, tabbed)
│   │   ├── _components/
│   │   │   └── event-selector.tsx      # Shared event dropdown used in the dashboard header
│   │   ├── event-settings/page.tsx     # Create / edit events + live pass preview panel
│   │   ├── attendees/page.tsx          # Confirmed visitors — paginated table, search, bulk actions
│   │   ├── contacts/page.tsx           # Contacts & invite status tracking
│   │   ├── import/page.tsx             # CSV contact import with column-alias resolution
│   │   ├── send-invites/page.tsx       # Bulk WhatsApp invite sender with real-time progress
│   │   ├── message-templates/page.tsx  # Per-event WhatsApp message template editor
│   │   ├── seat-map/page.tsx           # Seat map builder + visual grid with colour-coded status
│   │   ├── staff/page.tsx              # Team management — all roles (admin/manager/gate_staff)
│   │   ├── settings/page.tsx           # App settings — General tab + SMTP/Email tab
│   │   └── profile/page.tsx            # Admin's own profile (wraps shared ProfileForm)
│   │
│   ├── manager/                        # Manager portal — role: manager
│   │   ├── layout.tsx                  # Sidebar nav
│   │   ├── dashboard/page.tsx          # Read-only check-in stats for assigned events
│   │   └── profile/page.tsx            # Manager's own profile (wraps shared ProfileForm)
│   │
│   ├── staff/                          # Staff terminal — role: gate_staff
│   │   ├── layout.tsx                  # Minimal top bar with profile link + sign out
│   │   ├── dashboard/page.tsx          # Full-screen QR scan interface + recent check-ins
│   │   └── profile/page.tsx            # Staff's own profile (wraps shared ProfileForm)
│   │
│   ├── invite/[token]/page.tsx         # Public self-registration form for contacts
│   ├── p/[token]/page.tsx              # Public visitor pass page (QR code + details)
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts          # POST — authenticate, issue JWT cookie
│       │   ├── logout/route.ts         # POST — clear session cookie
│       │   ├── me/route.ts             # GET  — return current session payload
│       │   ├── forgot-password/route.ts # POST — create reset token, send email
│       │   └── reset-password/route.ts  # GET (validate token) / POST (apply new password)
│       │
│       ├── events/
│       │   ├── route.ts                # GET/POST/PUT/DELETE — event CRUD + logo/partner-logo upload
│       │   └── seat-map/route.ts       # GET/PUT — seat map config per event
│       │
│       ├── attendees/
│       │   ├── route.ts                # GET/POST/PUT/DELETE — attendee CRUD
│       │   ├── import/route.ts         # POST — bulk CSV/JSON attendee import
│       │   ├── generate-pass/route.ts  # POST — generate pass for one attendee
│       │   └── bulk-generate-passes/route.ts  # POST — batch pass generation
│       │
│       ├── contacts/
│       │   ├── route.ts                # GET/POST/PUT/DELETE — contact management
│       │   └── import/route.ts         # POST — bulk contact CSV import
│       │
│       ├── checkin/route.ts            # POST — process QR scan; records check-in log
│       │
│       ├── invite/
│       │   ├── [token]/route.ts        # GET  — fetch invitation details (public, no auth)
│       │   └── submit/route.ts         # POST — submit self-registration form (public)
│       │
│       ├── pass/
│       │   ├── route.ts                # GET  — fetch pass data by QR token (public)
│       │   └── image/
│       │       ├── route.tsx           # GET  — render pass as PNG via Satori + sharp
│       │       └── pass-template.tsx   # JSX template used by Satori for pass image rendering
│       │
│       ├── whatsapp/
│       │   ├── route.ts                # GET/POST/DELETE — WA client session management
│       │   ├── send/route.ts           # POST — bulk send invite or pass messages
│       │   └── progress/route.ts       # GET  — SSE stream for real-time send progress
│       │
│       ├── admin/
│       │   ├── staff/
│       │   │   ├── route.ts            # GET (list all roles) / POST (create any role + send welcome email)
│       │   │   └── [id]/route.ts       # GET / PATCH / DELETE (hard delete with guards)
│       │   ├── assignments/
│       │   │   ├── route.ts            # GET/POST — list + create event-staff assignments
│       │   │   └── [id]/route.ts       # DELETE — remove assignment
│       │   └── dashboard/route.ts      # GET  — admin dashboard aggregate stats
│       │
│       ├── manager/
│       │   └── dashboard/route.ts      # GET  — stats for manager's assigned events
│       │
│       ├── staff/
│       │   ├── event/route.ts          # GET  — assigned event for the logged-in gate staff
│       │   ├── attendees/route.ts      # GET  — attendee search for gate staff
│       │   ├── search/route.ts         # GET  — search by QR token or pass number
│       │   └── recent-checkins/route.ts # GET — last N check-in events
│       │
│       ├── profile/route.ts            # GET/PUT/POST — own profile + avatar upload
│       └── settings/route.ts           # GET/PUT/POST — app settings + logo upload
│
├── components/
│   ├── pass/
│   │   ├── pass-card.tsx               # Public-facing pass display component
│   │   └── pass-download-button.tsx    # Client component for triggering pass PNG download
│   └── profile/
│       └── profile-form.tsx            # Shared profile + avatar + password-change form (used by all 3 portals)
│
├── lib/
│   ├── auth.ts                         # JWT create/verify, session cookie R/W, requireAuth, requireRole
│   ├── constants.ts                    # Cookie name (vp_session), session TTL, mobile regex
│   ├── csv-parser.ts                   # CSV parser with column-alias resolution
│   ├── mailer.ts                       # Nodemailer wrapper — sendWelcomeEmail, sendPasswordResetEmail
│   ├── seat-map.ts                     # Seat availability queries + next-seat assignment logic
│   ├── token.ts                        # Secure token generation, pass-number formatting
│   ├── utils.ts                        # apiSuccess, apiError helpers, mobile normalization, sanitizeString
│   ├── wa-client.ts                    # Baileys WhatsApp session management singleton
│   ├── wa-sender.ts                    # Message sending loop + SSE progress tracking
│   ├── whatsapp.ts                     # Message template variable substitution
│   └── supabase/
│       ├── server.ts                   # Supabase client with service-role key (server-only)
│       └── client.ts                   # Supabase client with anon key (browser-safe)
│
├── services/
│   ├── event.service.ts                # Event CRUD, logo upload, partner logo upload
│   ├── pass.service.ts                 # Pass generation (single + bulk), QR token logic
│   ├── attendee.service.ts             # Attendee CRUD + CSV batch import
│   └── contact.service.ts             # Contact CRUD + invitation token management
│
├── types/
│   ├── enums.ts                        # UserRole, EventStatus, InviteStatus, etc.
│   ├── database.ts                     # TypeScript types mirroring DB row shapes
│   ├── dto.ts                          # Request/response body shapes
│   └── index.ts                        # Re-exports everything from types/
│
├── middleware.ts                        # Next.js Edge middleware — role-based route guard
├── db/                                 # SQL migration files (run in order via Supabase SQL Editor)
│   ├── schema.sql
│   ├── auth-functions.sql
│   ├── storage-setup.sql
│   ├── migrate-v2.sql … migrate-v10.sql
│   ├── reset-data.sql                  # DEV ONLY — truncates all event/attendee data
│   └── run-migrations.mjs              # Node script for automated migration (update credentials before use)
└── .env.example                        # Environment variable template
```

---

## Pages & Portals

### Admin Panel (`/admin`)

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/admin` | Mobile-first KPI stats, visitor funnel, tabbed recent activity |
| Events | `/admin/event-settings` | Create/edit events with live pass preview |
| Upload Contacts | `/admin/import` | CSV upload for bulk contact import |
| Contacts & Invites | `/admin/contacts` | Manage contacts, track invite status |
| Bulk Send Invites | `/admin/send-invites` | WhatsApp bulk invite sender with real-time progress |
| Confirmed Visitors | `/admin/attendees` | Attendee table, pass generation, check-in management |
| Seat Map | `/admin/seat-map` | Visual row/seat builder for reserved seating |
| Message Templates | `/admin/message-templates` | Edit per-event WhatsApp message templates |
| Staff Management | `/admin/staff` | Create/edit/delete/disable accounts for all roles |
| App Settings | `/admin/settings` | App branding (General) + SMTP email config |
| My Profile | `/admin/profile` | Update name, email, mobile, avatar, password |

### Manager Portal (`/manager`)

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/manager/dashboard` | Read-only check-in stats for assigned events |
| My Profile | `/manager/profile` | Update own details and password |

### Staff Terminal (`/staff`)

| Page | Path | Description |
|------|------|-------------|
| Check-in Terminal | `/staff/dashboard` | Full-screen QR scan interface + recent check-ins |
| My Profile | `/staff/profile` | Update own details and password |

### Public Pages (No Login Required)

| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | Dark split-panel login form |
| Forgot Password | `/forgot-password` | Request password reset email |
| Reset Password | `/reset-password/[token]` | Set new password via email link |
| Visitor Pass | `/p/[token]` | Attendee's digital pass with QR code and event details |
| Self-Registration | `/invite/[token]` | Invitation response form for contacts |

---

## API Reference

### Response Envelope

All API endpoints return a consistent JSON envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "Human-readable message" } }
```

HTTP status codes are set appropriately (200, 201, 400, 401, 403, 404, 409, 500).

---

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Body: `{ email, password }` — returns session user, sets `vp_session` JWT cookie |
| POST | `/api/auth/logout` | Any | Clears the `vp_session` cookie |
| GET | `/api/auth/me` | Any | Returns current session payload `{ id, name, email, role }` |
| POST | `/api/auth/forgot-password` | Public | Body: `{ email }` — creates reset token, sends email. Always returns success |
| GET | `/api/auth/reset-password?token=xxx` | Public | Validates a reset token. Returns `{ valid: true, email }` or error |
| POST | `/api/auth/reset-password` | Public | Body: `{ token, password }` — applies the new password, marks token used |

---

### Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events` | Admin | List all events with attendee/contact counts |
| GET | `/api/events?id=xxx` | Admin | Fetch single event with all fields |
| POST | `/api/events` | Admin | Create event (JSON body) or upload event logo (multipart with `logo` field) |
| PUT | `/api/events` | Admin | Update event fields |
| DELETE | `/api/events?id=xxx` | Admin | Delete event and all related data |
| GET | `/api/events/seat-map?event_id=xxx` | Admin | Fetch seat map config |
| PUT | `/api/events/seat-map` | Admin | Save seat map config |

**Logo upload** — multipart POST with fields `event_id` + `logo` (image file).  
**Partner logo upload** — multipart POST with `event_id` + `upload_type=partner_logo` + `logo`.

---

### Attendees

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/attendees?event_id=&page=&search=` | Admin | Paginated list with search |
| GET | `/api/attendees?id=xxx` | Admin | Single attendee detail |
| POST | `/api/attendees` | Admin | Create single attendee |
| PUT | `/api/attendees` | Admin | Update attendee |
| DELETE | `/api/attendees?id=xxx` | Admin | Delete attendee (blocked if already checked-in) |
| POST | `/api/attendees/import` | Admin | Bulk import from JSON/CSV body |
| POST | `/api/attendees/generate-pass` | Admin | Generate pass for one attendee |
| POST | `/api/attendees/bulk-generate-passes` | Admin | Generate passes for all (or selected) attendees |

---

### Contacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/contacts?event_id=&page=&search=` | Admin | Paginated contact list |
| POST | `/api/contacts` | Admin | Create single contact |
| PUT | `/api/contacts` | Admin | Update contact |
| DELETE | `/api/contacts?id=xxx` | Admin | Delete contact |
| POST | `/api/contacts/import` | Admin | Bulk CSV contact import |

---

### Check-in

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/checkin` | Admin / Gate Staff | Process a QR scan. Body: `{ token, gate_name? }` |

---

### Pass (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pass?token=xxx` | Public | Fetch full pass data by QR token |
| GET | `/api/pass/image?token=xxx` | Public | Render pass as PNG (Satori → SVG → sharp → PNG) |

---

### Invitation Flow (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/invite/[token]` | Public | Fetch invitation details for the self-registration page |
| POST | `/api/invite/submit` | Public | Submit self-registration form; creates attendee record |

---

### WhatsApp

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/whatsapp` | Admin | Get WA client status (`connected` / `qr` / `disconnected`) |
| POST | `/api/whatsapp` | Admin | Initialize WA client; returns QR code data URL |
| DELETE | `/api/whatsapp` | Admin | Disconnect and destroy WA session |
| POST | `/api/whatsapp/send` | Admin | Send messages. Body: `{ event_id, type: 'invite'|'pass', contact_ids? }` |
| GET | `/api/whatsapp/progress` | Admin | SSE stream — emits `{ sent, total, current, errors }` events |

---

### Staff Management (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/staff` | Admin | List staff. Query params: `role=admin|manager|gate_staff`, `active=true|false`, `page=N` |
| POST | `/api/admin/staff` | Admin | Create staff. Sends welcome email automatically. Body: `{ name, email, mobile, password, role, designation? }` |
| GET | `/api/admin/staff/[id]` | Admin | Get one staff member + their event assignments |
| PATCH | `/api/admin/staff/[id]` | Admin | Update fields: `name`, `email`, `mobile`, `role`, `active`, `designation`, `password` |
| DELETE | `/api/admin/staff/[id]` | Admin | Hard delete the user record |

**Guards enforced server-side:**
- Cannot change your own role
- Cannot demote/deactivate/delete the last active admin
- Cannot deactivate or delete your own account

---

### Event Assignments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/assignments?event_id=` | Admin | List assignments for an event |
| POST | `/api/admin/assignments` | Admin | Assign a staff/manager to an event. Body: `{ user_id, event_id, assigned_role }` |
| DELETE | `/api/admin/assignments/[id]` | Admin | Remove an assignment |

---

### Dashboard Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Aggregate counts: events, contacts, attendees, staff, funnel, recent activity |
| GET | `/api/manager/dashboard` | Manager | Stats scoped to the manager's assigned events |

---

### Staff Terminal APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/staff/event` | Gate Staff | Fetch the event assigned to the logged-in staff |
| GET | `/api/staff/attendees?search=` | Gate Staff | Search attendees for their assigned event |
| GET | `/api/staff/search?q=` | Gate Staff | Lookup by QR token or pass number |
| GET | `/api/staff/recent-checkins` | Gate Staff | Most recent check-in events for their event |

---

### Profile (Own User)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Any logged-in user | Fetch own full profile from DB |
| PUT | `/api/profile` | Any logged-in user | Update `name`, `email`, `mobile`, `designation`, or `password`. Password change requires `current_password` + `new_password` |
| POST | `/api/profile` | Any logged-in user | Upload avatar image (multipart `avatar` field). Stored in `event-logos` bucket under `avatars/{userId}/` |

---

### App Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | Admin | Fetch all settings as `{ key: value }` map |
| PUT | `/api/settings` | Admin | Upsert one or many allowed keys. Body is a flat object of `key: value` pairs |
| POST | `/api/settings` | Admin | Upload app logo (multipart `logo` field). Stored in `event-logos` bucket under `app-logo/` |

**Allowed setting keys:** `app_name`, `app_tagline`, `app_logo_url`, `support_email`, `support_phone`, `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_password`, `smtp_from_name`, `smtp_from_email`

---

## Auth System

Custom JWT-based authentication using the `jose` library. No external auth provider.

### How it works

1. `POST /api/auth/login` validates credentials against the `users` table using the `verify_password` Supabase RPC (bcrypt via pgcrypto)
2. On success, creates an HS256 JWT containing `{ id, name, email, role }` and stores it in an HTTP-only, SameSite=Lax cookie named `vp_session` (7-day TTL)
3. Middleware at the Next.js Edge reads and verifies the cookie before every page load
4. API routes call `requireAuth()` or `requireRole('admin')` — these throw `AuthError` on failure, caught and returned as JSON

### Session refresh

When a user updates their name or email via `PUT /api/profile`, the JWT is automatically re-issued with the updated payload so the sidebar/header stays in sync without requiring re-login.

### Why not Supabase Auth?

Staff accounts are pre-created by admins, not self-registered. No email verification, magic links, or OAuth needed. Full control over the `users` table and role system without the Supabase Auth overhead.

---

## Forgot Password Flow

1. User visits `/forgot-password` and submits their email
2. `POST /api/auth/forgot-password` — invalidates any existing unused tokens for that user, creates a new 32-byte hex token in `password_reset_tokens` with a 1-hour expiry, sends a reset email
3. The email contains a link to `/reset-password/[token]`
4. The reset page calls `GET /api/auth/reset-password?token=xxx` on load to validate the token
5. If valid, the user fills in a new password and submits
6. `POST /api/auth/reset-password` — verifies the token is valid and unused, updates `password_hash` in `users`, marks `used_at` in the token row
7. The page auto-redirects to `/login` after 3 seconds

**Anti-enumeration**: `POST /api/auth/forgot-password` always returns `200 OK` regardless of whether the email exists in the database. This prevents attackers from enumerating valid email addresses.

---

## Email / SMTP System

All email is handled by `lib/mailer.ts` using **Nodemailer**.

### Configuration

SMTP credentials are stored in the `app_settings` table (not `.env`). Configure via **Admin → App Settings → Email/SMTP**.

| Setting key | Example |
|-------------|---------|
| `smtp_host` | `smtp.gmail.com` |
| `smtp_port` | `587` |
| `smtp_secure` | `starttls` / `ssl` / `none` |
| `smtp_user` | `youraddress@gmail.com` |
| `smtp_password` | app password or SMTP password |
| `smtp_from_name` | `Visitor Pass` |
| `smtp_from_email` | `noreply@yourdomain.com` |

### Dev mode (no SMTP configured)

When `smtp_host`, `smtp_user`, or `smtp_password` is missing, `mailer.ts` skips sending and logs the full email content (including credentials or reset link) to the server console. This is the expected behaviour in local development.

### Email functions

| Function | When it's sent |
|----------|---------------|
| `sendWelcomeEmail(opts)` | After `POST /api/admin/staff` creates a new user |
| `sendPasswordResetEmail(opts)` | After `POST /api/auth/forgot-password` |

Both functions are called **non-blocking** (`.catch()` pattern) so email failure never causes the API response to fail.

---

## CSV Import Format

### Contact / Attendee Import

The parser resolves columns by name (case-insensitive). Use any of the recognised aliases:

| Canonical field | Accepted column name aliases |
|-----------------|------------------------------|
| `mobile` | `phone`, `phone_number`, `contact`, `cell`, `mob`, `telephone` |
| `name` | `full_name`, `attendee_name` |
| `business_name` | `company`, `company_name`, `firm`, `organization` |
| `email` | `email_address`, `mail` |

Example:

```csv
name,phone,company,email
Rahul Sharma,9876543210,ABC Traders,rahul@abc.com
Priya Patil,8765432109,XYZ Exports,
```

### Import Pipeline

1. **Parse** — split CSV rows, handle quoted fields, resolve column aliases
2. **Validate** — check each row for a valid 10-digit mobile number
3. **Deduplicate within CSV** — skip duplicate mobile numbers in the same file
4. **Deduplicate against DB** — fetch existing mobiles for the event, skip matches
5. **Batch insert** — insert in batches of 100 rows

---

## Pass Generation

### Pass Number Format

`[PREFIX]-[SEQUENCE]` — e.g. `APR26-MSME-001`

- Prefix = event date formatted as `MMM-YY` + first word of event title (uppercased)
- Sequence = per-event auto-incrementing integer, zero-padded to 3 digits

### QR Token

32-byte cryptographically random hex string. Unique per attendee across all events. Stored in the `attendees` table as `qr_token`.

### Seat Assignment

1. If a seat map is configured for the event, the next available (non-VIP, non-assigned) seat is taken from the map
2. If no seat map, a sequential fallback seat number is generated: `S-001`, `S-002`, …

### Idempotency

Pass generation skips attendees that already have a pass. Pass `force: true` in the request body to regenerate for a specific attendee.

### Pass Image Download

`GET /api/pass/image?token=xxx`

1. Fetches pass data from DB
2. Renders `pass-template.tsx` JSX using **Satori** (JSX → SVG, 600 px wide)
3. Converts SVG → PNG using **sharp**
4. Returns the PNG with `Content-Disposition: attachment` header

---

## Seat Map

Configured per-event from **Admin → Seat Map**.

### Config shape (stored as JSONB in `events.seat_map_config`)

```json
{
  "rows": [
    { "label": "A", "seats": 20 },
    { "label": "B", "seats": 20 },
    { "label": "VIP", "seats": 10 }
  ]
}
```

- Seats are labelled `A-1`, `A-2`, … `B-1`, `B-2`, …
- VIP seats (the count in `events.vip_seats`) are reserved at the end of the map and skipped during auto-assignment
- The visual grid uses colour-coded status: white = available, emerald = assigned, violet = VIP

---

## WhatsApp Integration

Uses **Baileys** — a reverse-engineered WhatsApp Web client. No API key or cloud service required.

### Setup

1. Go to **Admin → Bulk Send Invites**
2. Click **Connect WhatsApp** — a QR code is displayed
3. Open WhatsApp on your phone → Linked Devices → Link a Device → scan the QR
4. Once connected, the session persists in memory until explicitly disconnected

### Message Templates

Templates use `{placeholder}` syntax:

| Placeholder | Replaced with |
|-------------|---------------|
| `{name}` | Attendee / contact name |
| `{event}` | Event title |
| `{date}` | Event date (formatted) |
| `{venue}` | Venue name |
| `{link}` | Invitation or pass URL |
| `{pass_number}` | Pass number (e.g. `APR26-MSME-001`) |
| `{seat_number}` | Assigned seat number |

Templates are stored per-event in `events.invite_message_template` and `events.pass_message_template`.

---

## Profile Management

A shared `ProfileForm` client component (`components/profile/profile-form.tsx`) is used across all three portals. Each portal wraps it in a thin server page:

```tsx
// app/admin/profile/page.tsx  (same pattern for manager and staff)
import ProfileForm from '@/components/profile/profile-form';
export default function Page() { return <ProfileForm />; }
```

### ProfileForm features

- **Left card**: avatar (image or initials fallback), role badge, email, mobile, joined date
- **Account Info tab**: edit name, email, mobile, designation
- **Change Password tab**: current password + new password + confirm (with show/hide toggles)
- **Avatar upload**: hover-to-change overlay on the avatar; uploads to Supabase Storage; previews immediately

### Migration resilience

The profile GET and PUT handlers include a fallback for environments where `migrate-v9.sql` hasn't been run yet: they first try selecting `profile_picture_url`; if Supabase returns a column-not-found error, they retry without it and inject `profile_picture_url: null`. This means the profile page works before and after the migration.

---

## App Settings

Stored in the `app_settings` table as key/value pairs (created by `migrate-v8.sql`).

### General tab settings

| Key | Description |
|-----|-------------|
| `app_name` | Application name shown in the sidebar |
| `app_tagline` | Short description below the app name |
| `app_logo_url` | URL of the uploaded app logo |
| `support_email` | Shown on error pages and email footers |
| `support_phone` | Shown on error pages |

### SMTP tab settings

| Key | Description |
|-----|-------------|
| `smtp_host` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `smtp_port` | Port number (e.g. `587`) |
| `smtp_secure` | `starttls` / `ssl` / `none` |
| `smtp_user` | SMTP username / email |
| `smtp_password` | SMTP password or app password |
| `smtp_from_name` | Display name for outgoing emails |
| `smtp_from_email` | From address for outgoing emails |

Settings are upserted (safe to re-save). All reads/writes go through `/api/settings` which is admin-only.

---

## Staff Management

The **Admin → Staff Management** page manages all user accounts across all roles.

### Role tabs

- **All** — shows every user across all roles
- **Admins** — only `admin` role users
- **Managers** — only `manager` role users
- **Event Staff** — only `gate_staff` role users

### Creating users

Any role (`admin`, `manager`, `gate_staff`) can be selected when creating a new user. The API (`POST /api/admin/staff`) accepts all three roles and automatically sends a welcome email with login credentials.

### Editing users

Click the edit (pencil) icon on any row to open the edit drawer. All fields are editable: name, email, mobile, designation, role, active status, and password.

### Deleting users

Click the trash icon on a row. A confirmation modal requires typing `DELETE` before the hard-delete executes. The row is permanently removed from the database.

### Self-protection rules (enforced at API level)

| Action | Blocked if... |
|--------|--------------|
| Change your own role | Always — you cannot demote yourself |
| Deactivate your own account | Always |
| Delete your own account | Always |
| Demote the last active admin | Would leave zero active admins |
| Deactivate the last active admin | Would leave zero active admins |
| Delete the last active admin | Would leave zero active admins |

---

## Error Handling

### App Router error boundaries

Two required files handle rendering errors:

- `app/error.tsx` — catches errors within any route segment, shows a styled "Try again" card
- `app/global-error.tsx` — catches errors in the root layout itself (renders its own `<html>`)

Both are `'use client'` components that receive `{ error, reset }` props. Without these files, Next.js App Router shows `missing required error components, refreshing...` in a loop.

### API errors

All API routes return the standard envelope:

```json
{ "success": false, "error": { "message": "..." } }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation failure |
| 401 | Not authenticated (no valid session) |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Unexpected server error |

---

## Developer Notes

### Running the dev server

Only run **one** instance of `npm run dev` at a time. Next.js will automatically try ports 3001, 3002, etc. if 3000 is taken — make sure to browse to the correct port shown in the terminal output.

To stop all dev servers (Windows PowerShell):

```powershell
Get-Process -Name node | Stop-Process -Force
npm run dev
```

### Clearing the build cache

If you see `missing required error components` or stale module errors after adding new files:

```bash
rm -rf .next
npm run dev
```

### Duplicate route files

The project uses `.tsx` for routes that contain JSX (e.g. `app/api/pass/image/route.tsx`). Never have both a `.ts` and `.tsx` version of the same route — Next.js will warn about duplicate pages and behave unpredictably.

### Supabase client usage

- `lib/supabase/server.ts` — uses the **service-role key**; bypasses Row-Level Security; for server-side API routes only
- `lib/supabase/client.ts` — uses the **anon key**; for browser-side usage if needed

Always use the server client in API routes (`createServerClient()`). Never expose the service-role key to the browser.

### File uploads to Supabase Storage

Always convert `File` objects to `Buffer` before uploading to Supabase Storage:

```typescript
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
await db.storage.from('bucket').upload(path, buffer, { contentType });
```

Always derive `contentType` from the file extension (not `file.type`) because browsers may omit or send a non-standard MIME type:

```typescript
const ext = (file.name.split('.').pop() || 'png').toLowerCase();
const extMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const contentType = extMap[ext] || file.type;
```

### Adding a new migration

1. Create `db/migrate-vN.sql` with idempotent SQL (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
2. Run it in the Supabase SQL Editor
3. Update this README's migration table
4. If the migration adds a new column that existing API routes select, add the column-fallback pattern (see `app/api/profile/route.ts` GET handler for an example)

### TypeScript checking

```bash
node node_modules/typescript/bin/tsc --noEmit
```

All files must pass without errors before committing.

### Git remotes

The project has two remotes:

| Remote name | Repository | Purpose |
|-------------|-----------|---------|
| `origin` | `github.com/oreodigi/visitor-pass` | Backup / source of truth |
| `vercel` | `github.com/oreodigi/visitor-passx` | Vercel watches this — push here to deploy |

Always push to **both** remotes:

```bash
git push vercel main && git push origin main
```

---

## Deployment Checklist

- [ ] Change default passwords for `admin@msme.local` and `staff@msme.local`
- [ ] Set a strong `JWT_SECRET` (run `openssl rand -base64 48`)
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain (used in QR code, invite links, and password reset emails)
- [ ] Run all SQL migrations in order (schema → auth-functions → storage-setup → v2 → … → v10)
- [ ] Create the `event-logos` bucket (from `storage-setup.sql`) with public-read policy
- [ ] Create the `avatars` bucket (from `migrate-v9.sql` comments) with public-read policy
- [ ] Configure SMTP settings: **Admin → App Settings → Email/SMTP**
- [ ] Upload app logo and set app name: **Admin → App Settings → General**
- [ ] Test forgot-password flow end-to-end (check email or server console in dev)
- [ ] Test CSV import with a sample file
- [ ] Test pass generation and QR scan end-to-end on a real device
- [ ] Test WhatsApp connection; send a test message before the event

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | Server components, API routes, Edge middleware |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS v3 | Design tokens in `globals.css` |
| Database | Supabase (PostgreSQL) | All queries via service-role client |
| File Storage | Supabase Storage | `event-logos` bucket for logos + avatars |
| Auth | Custom JWT (`jose`) | HTTP-only cookies, no external provider |
| Password Hashing | PostgreSQL `pgcrypto` (bcrypt) | Via RPC functions `crypt_password` / `verify_password` |
| Email | Nodemailer | SMTP config stored in `app_settings` DB table |
| QR Generation | `qrcode` | Generates QR code data URL for pass |
| Pass Image | Satori + sharp | JSX → SVG → PNG, 600 px wide |
| WhatsApp | Baileys | WhatsApp Web reverse-engineered client; no API key |
| Font | DM Sans | Google Fonts via `next/font/google` |
