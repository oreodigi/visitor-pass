export type EventStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type AttendeeSource = 'missed_call' | 'manual' | 'import' | 'registration';

export type WhatsAppStatus = 'pending' | 'ready' | 'sent' | 'opened' | 'failed';

export type CheckinStatus = 'valid' | 'duplicate' | 'invalid' | 'manual';

export type MessageStatus = 'generated' | 'sent' | 'opened' | 'failed';

export type UserRole = 'admin' | 'gate_staff' | 'manager';

export type AssignedRole = 'manager' | 'gate_staff';

// ── Contact / Invite statuses ─────────────────────────────
export type ContactStatus = 'uploaded' | 'invited' | 'confirmed' | 'cancelled';

export type WhatsAppInviteStatus = 'pending' | 'sent';
