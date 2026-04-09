# MSME Visitor Pass System

Event visitor pass management for the MSME Awareness Program, Jalgaon.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your Supabase keys and generate JWT_SECRET

# 3. Run database migrations (in Supabase SQL Editor, in order):
#    a) Phase 1 schema.sql (events → users → attendees → checkin_logs → message_logs)
#    b) db/auth-functions.sql (password hashing + seed users)
#    c) db/storage-setup.sql (logo upload bucket)

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login)

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@msme.local | admin123 |
| Gate Staff | staff@msme.local | staff123 |

> **Change these immediately in production.**

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<openssl rand -base64 48>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Architecture

```
visitor-pass/
├── app/
│   ├── layout.tsx                 # Root layout (DM Sans font, Tailwind)
│   ├── page.tsx                   # Auto-redirect based on auth state
│   ├── globals.css                # Design tokens + utility classes
│   ├── login/page.tsx             # Login form
│   ├── admin/                     # Admin-only routes (middleware-protected)
│   │   ├── layout.tsx             # Sidebar navigation
│   │   ├── event-settings/page.tsx
│   │   ├── attendees/page.tsx
│   │   └── import/page.tsx
│   ├── staff/                     # Staff routes (middleware-protected)
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx
│   └── api/
│       ├── auth/{login,logout,me}/route.ts
│       ├── events/route.ts
│       ├── attendees/route.ts
│       └── attendees/import/route.ts
├── lib/
│   ├── auth.ts                    # JWT sessions, role guards
│   ├── constants.ts               # App-wide config values
│   ├── csv-parser.ts              # Robust CSV parser with column aliases
│   ├── utils.ts                   # Mobile normalization, API helpers
│   └── supabase/{server,client}.ts
├── services/
│   ├── event.service.ts           # Event CRUD + logo upload
│   └── attendee.service.ts        # Attendee CRUD + bulk import
├── middleware.ts                   # Route protection (/admin, /staff)
├── types/                         # Shared TypeScript interfaces
└── db/                            # SQL migrations
```

### Request Flow

```
Browser → Route Handler → Auth Guard → Service → Supabase → Response
                ↓
           middleware.ts checks JWT cookie
                ↓
           requireRole('admin') in route handler
                ↓
           service layer validates + sanitizes
                ↓
           Supabase client (service_role) executes query
```

---

## Auth System

Custom JWT-based auth using `jose` library + HTTP-only cookies.

- Passwords hashed via PostgreSQL `pgcrypto` (bcrypt, cost factor 10)
- JWT tokens stored in `vp_session` cookie (HTTP-only, SameSite=Lax, 7-day expiry)
- Middleware intercepts `/admin/*` and `/staff/*` routes before page loads
- Route handlers double-check with `requireRole()` for API-level protection

### Why not Supabase Auth?

For this MVP: fewer moving parts, no email verification flow needed, direct control over the users table, and the gate staff accounts are pre-seeded by admin — not self-registered.

---

## CSV Import

### Supported Formats

The parser accepts these column headers (case-insensitive):

| Canonical | Aliases |
|-----------|---------|
| `mobile` | phone, phone_number, contact, cell, mob, telephone |
| `name` | full_name, attendee_name |
| `business_name` | company, company_name, firm, organization |

### Import Pipeline

1. **Parse** — Split CSV, handle quoted fields, map column aliases
2. **Validate** — Check each row for valid mobile number
3. **Deduplicate within CSV** — Skip rows with duplicate mobiles
4. **Deduplicate against DB** — Fetch existing mobiles for the event, skip matches
5. **Batch insert** — Insert in batches of 100 via Supabase

### Response Shape

```json
{
  "success": true,
  "data": {
    "total_rows": 210,
    "valid_rows": 205,
    "inserted": 198,
    "duplicates_skipped": 7,
    "invalid_rows": 5,
    "errors": [
      { "row": 3, "reason": "Invalid mobile number: abc123" },
      { "row": 47, "reason": "Duplicate within CSV: 9876543210" }
    ]
  }
}
```

---

## API Reference

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Get current authenticated user |

### Events

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/events` | List all events |
| GET | `/api/events?id=xxx` | Get single event with counts |
| POST | `/api/events` | Create event (JSON) or upload logo (multipart) |
| PUT | `/api/events` | Update event |

### Attendees

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/attendees?event_id=xxx&page=1&search=term` | Paginated list with search |
| GET | `/api/attendees?id=xxx` | Single attendee |
| POST | `/api/attendees` | Create single attendee |
| PUT | `/api/attendees` | Update attendee |
| DELETE | `/api/attendees?id=xxx` | Delete attendee (blocks if checked-in) |
| POST | `/api/attendees/import` | Bulk CSV/JSON import |

### Response Format

All APIs return:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "code": "..." } }
```

---

## Deployment Checklist

- [ ] Change default admin/staff passwords
- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Enable RLS on Supabase tables before exposing anon key
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Create Supabase Storage bucket `event-logos` with public read policy
- [ ] Test CSV import with real attendee data
- [ ] Verify mobile number normalization matches your data format

---

## Phase 3 Scope (Next)

- QR token + pass number generation
- Visual pass page (`/p/[token]`)
- QR code rendering
- Scanner module for gate staff
- WhatsApp message link generation
- Dashboard with live check-in stats
