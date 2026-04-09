import type {
  EventStatus,
  AttendeeSource,
  WhatsAppStatus,
  CheckinStatus,
  MessageStatus,
  UserRole,
  AssignedRole,
  ContactStatus,
  WhatsAppInviteStatus,
} from './enums';

export interface EventRow {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  venue_contact_number: string | null;
  organizer_contact_number: string | null;
  support_contact_number: string | null;
  footer_note: string | null;
  logo_url: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface AttendeeRow {
  id: string;
  event_id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  business_name: string | null;
  source: AttendeeSource;
  contact_id: string | null;
  seat_number: string | null;
  pass_number: string | null;
  qr_token: string | null;
  pass_url: string | null;
  pass_generated_at: string | null;
  whatsapp_status: WhatsAppStatus;
  whatsapp_opened_at: string | null;
  whatsapp_sent_marked_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  manual_override_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: string;
  event_id: string;
  mobile: string;
  invitation_token: string;
  invitation_link: string;
  status: ContactStatus;
  whatsapp_invite_status: WhatsAppInviteStatus;
  invited_at: string | null;
  responded_at: string | null;
  attendee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  password_hash: string | null;
  auth_id: string | null;
  role: UserRole;
  active: boolean;
  designation: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserEventAssignmentRow {
  id: string;
  user_id: string;
  event_id: string;
  assigned_role: AssignedRole;
  created_at: string;
}

export interface CheckinLogRow {
  id: string;
  event_id: string;
  attendee_id: string | null;
  scanned_token: string;
  status: CheckinStatus;
  scanned_by: string | null;
  gate_name: string | null;
  device_info: string | null;
  created_at: string;
}

export interface MessageLogRow {
  id: string;
  event_id: string;
  attendee_id: string | null;
  mobile: string;
  message_text: string | null;
  whatsapp_link: string | null;
  status: MessageStatus;
  opened_by: string | null;
  created_at: string;
}
