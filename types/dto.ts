import type {
  EventStatus,
  AttendeeSource,
  WhatsAppStatus,
  UserRole,
  AssignedRole,
  ContactStatus,
  WhatsAppInviteStatus,
} from './enums';

// ── AUTH DTOs ─────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string | null;
    role: UserRole;
  };
  token: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
}

// ── EVENT DTOs ────────────────────────────────────────────

export interface CreateEventPayload {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  venue_contact_number?: string;
  organizer_contact_number?: string;
  support_contact_number?: string;
  footer_note?: string;
  logo_url?: string;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  id: string;
  status?: EventStatus;
}

export interface EventResponse {
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
  attendee_count?: number;
  checked_in_count?: number;
  created_at: string;
  updated_at: string;
}

// ── ATTENDEE DTOs ─────────────────────────────────────────

export interface CreateAttendeePayload {
  event_id: string;
  name?: string;
  mobile: string;
  email?: string;
  business_name?: string;
  source?: AttendeeSource;
}

export interface UpdateAttendeePayload {
  id: string;
  name?: string;
  mobile?: string;
  email?: string;
  business_name?: string;
}

export interface AttendeeResponse {
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
  pass_url: string | null;
  qr_token: string | null;
  pass_generated_at: string | null;
  whatsapp_status: WhatsAppStatus;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendeeListResponse {
  attendees: AttendeeResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ImportAttendeesPayload {
  event_id: string;
  attendees: Array<{
    name?: string;
    mobile: string;
    business_name?: string;
  }>;
}

export interface ImportResult {
  total_rows: number;
  valid_rows: number;
  inserted: number;
  duplicates_skipped: number;
  invalid_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

// ── CONTACT DTOs ──────────────────────────────────────────

export interface ContactResponse {
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

export interface ContactListResponse {
  contacts: ContactResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ImportContactsPayload {
  event_id: string;
  contacts: Array<{ mobile: string }>;
}

export interface ImportContactsResult {
  total_rows: number;
  valid_rows: number;
  inserted: number;
  duplicates_skipped: number;
  invalid_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

// ── INVITE FORM DTOs ──────────────────────────────────────

export interface InviteFormData {
  contact: {
    id: string;
    mobile: string;
    status: ContactStatus;
  };
  event: {
    title: string;
    event_date: string;
    venue_name: string;
  };
  attendee_pass_url: string | null;
}

export interface SubmitInvitePayload {
  token: string;
  name: string;
  mobile: string;
  email?: string;
  company_name?: string;
}

export interface SubmitInviteResult {
  attendee_id: string;
  pass_url: string;
  pass_number: string;
  seat_number: string;
}

// ── STAFF MANAGEMENT DTOs ─────────────────────────────────

export interface StaffUserResponse {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  role: UserRole;
  active: boolean;
  designation: string | null;
  assignment_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: 'manager' | 'gate_staff';
  designation?: string;
}

export interface UpdateStaffPayload {
  name?: string;
  email?: string;
  mobile?: string;
  password?: string;
  role?: 'manager' | 'gate_staff';
  active?: boolean;
  designation?: string;
}

export interface EventAssignmentResponse {
  id: string;
  user_id: string;
  event_id: string;
  assigned_role: AssignedRole;
  created_at: string;
  user?: { name: string; email: string | null; role: UserRole; designation: string | null };
  event?: { title: string; event_date: string; status: EventStatus };
}

export interface CreateAssignmentPayload {
  user_id: string;
  event_id: string;
  assigned_role: AssignedRole;
}

// ── ADMIN DASHBOARD DTO ───────────────────────────────────

export interface AdminDashboardData {
  events: { total: number; active: number; completed: number };
  contacts: { total: number; invited: number; confirmed: number };
  attendees: { total: number; pass_generated: number; checked_in: number; pending: number; today: number };
  staff: { total: number; managers: number; event_staff: number; active: number };
  active_event: {
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
    status: EventStatus;
  } | null;
  funnel: {
    uploaded: number;
    invited: number;
    form_submitted: number;
    confirmed: number;
    pass_generated: number;
    checked_in: number;
  };
  recent_checkins: Array<{
    id: string;
    status: string;
    gate_name: string | null;
    created_at: string;
    attendee_name: string | null;
    attendee_pass: string | null;
  }>;
  recent_confirmations: Array<{
    id: string;
    name: string | null;
    mobile: string;
    pass_number: string | null;
    created_at: string;
  }>;
}

// ── MANAGER DASHBOARD DTO ─────────────────────────────────

export interface ManagerDashboardData {
  assigned_events: Array<{
    id: string;
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    status: EventStatus;
    stats: {
      total_attendees: number;
      checked_in: number;
      pending: number;
      today: number;
    };
    staff: Array<{ id: string; name: string; role: UserRole; designation: string | null; active: boolean }>;
  }>;
  recent_checkins: Array<{
    id: string;
    status: string;
    gate_name: string | null;
    created_at: string;
    attendee_name: string | null;
    event_title: string;
  }>;
}

// ── GENERIC API WRAPPER ───────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
