export const APP_NAME = 'MSME Visitor Pass';

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
export const LOGO_BUCKET = 'event-logos';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SESSION_COOKIE_NAME = 'vp_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const MOBILE_REGEX = /^[6-9]\d{9}$/; // Indian 10-digit mobile
export const MOBILE_REGEX_WITH_COUNTRY = /^(\+91|91)?[6-9]\d{9}$/;
