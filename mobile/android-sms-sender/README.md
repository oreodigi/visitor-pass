# Rimacle SMS Sender Android App

Private Android app for sending event pass links by SMS from a manager/admin phone SIM.

## Operator Flow

1. Install APK and login with the same admin/manager account.
2. Select event and tap `Start SMS Campaign`.

The app sends from the phone SIM, waits 45-60 seconds between SMS, and pauses after 50 SMS in one hour.

Long messages with pass links can count as more than one carrier SMS segment. Keep enough SMS balance on the phone SIM before starting a campaign.

## Build APK

Open this folder in Android Studio:

```text
mobile/android-sms-sender
```

Then use:

```text
Build > Generate App Bundles or APKs > APK
```

For internal use, install the debug APK directly on staff phones. Do not publish this on Play Store unless you are ready for SMS permission review.

## API Endpoints Used

- `POST /api/auth/login`
- `GET /api/sms-runner/events`
- `GET /api/sms-runner/queue?event_id=...`
- `POST /api/sms-runner/mark`
