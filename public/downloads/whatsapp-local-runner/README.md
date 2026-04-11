# Rimacle WhatsApp Local Runner

This runner sends event invitations or generated passes from a local PC using WhatsApp Web.

Best option: open the WhatsApp Runner page in the app and download the ready-made sender file for the event. Then double-click it.

It does not need Supabase keys. The ready-made sender file connects to the live app with an event-locked token.

## Plug and play setup

1. Download the event sender file from the admin or manager WhatsApp Runner page.
2. Double-click it and scan the WhatsApp QR if shown.

If Node.js is missing, the sender opens the official Node.js download page. Install Node.js LTS once, then double-click the sender again.

## Manual setup

1. Install Node.js 20 LTS from `https://nodejs.org`.
2. Download these files into one folder:
   - `runner.mjs`
   - `package.json`
   - `env.example`
   - `start-windows.bat`
3. Copy `env.example` and rename the copy to `.env`.
4. Fill:
   - `APP_URL=https://ticket.rimacle.com`
   - `RUNNER_TOKEN=token provided by admin`
   - `EVENT_ID=event id from the admin page`
   - `MODE=invites` or `MODE=passes`
5. Double-click `start-windows.bat`.
6. On first run, scan the WhatsApp QR from the generated `whatsapp-qr.html` file.

## Commands

Send invitations:

```bash
npm start -- --event-id EVENT_ID --mode invites
```

Send generated passes:

```bash
npm start -- --event-id EVENT_ID --mode passes
```

Dry run without sending:

```bash
npm start -- --event-id EVENT_ID --mode passes --dry-run
```

Run without editing `.env`:

```bash
npm start -- --app-url https://ticket.rimacle.com --token RUNNER_TOKEN --event-id EVENT_ID --mode invites
```

## Safety defaults

Default sending profile:

- 45 to 90 seconds between messages
- 15 messages per batch
- 5 minute break between batches

Use slower settings for new WhatsApp numbers or high-value campaigns.
