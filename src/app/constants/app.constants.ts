/**
 * Application-wide constants
 */

export const PDF_CONSTANTS = {
    WORKER_SRC: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    DEFAULT_PAGE_WIDTH: 595,
    QUALITY_SCALE_MOBILE: 2.0,
    RENDER_DELAY_MS: 100,
} as const;

export const SIGNATURE_CONSTANTS = {
    DEFAULT_WIDTH: 100,
    DEFAULT_HEIGHT: 50,
    MIN_WIDTH: 50,
    MIN_HEIGHT: 25,
} as const;

export const INITIAL_CONSTANTS = {
    DEFAULT_WIDTH: 60,
    DEFAULT_HEIGHT: 60,
} as const;

export const BREAKPOINTS = {
    MOBILE: 768,
    TABLET: 1024,
} as const;

export const SCALE_FACTORS = {
    MOBILE: 0.85,
    TABLET: 0.9,
    DESKTOP_MAX_WIDTH: 1200,
    MOBILE_MAX_SCALE: 1.2,
    TABLET_MAX_SCALE: 1.4,
    DESKTOP_MAX_SCALE: 1.6,
} as const;

export const TIMING = {
    SUCCESS_MESSAGE_DURATION: 2000,
    ERROR_MESSAGE_DURATION: 5000,
    SHORT_ERROR_DURATION: 3000,
} as const;

export const FIREBASE_PATHS = {
    USERS: 'users',
    SIGNATURES: 'signatures',
    INITIALS: 'initials',
    ENVELOPES: 'envelopes',
    USER_SIGNATURE_FILE: 'user_signature.png',
    USER_INITIAL_FILE: 'user_initial.png',
} as const;

export const VALIDATION = {
    ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
    MIN_ID_LENGTH: 1,
    MAX_ID_LENGTH: 256,
} as const;
