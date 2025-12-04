/**
 * Type definitions for signature and initial management
 */

/**
 * User signature and initial data from Firebase Storage
 */
export interface UserSignature {
    signatureUrl: string | null;
    initialUrl: string | null;
    signatureDataUrl?: string;
    initialDataUrl?: string;
}

/**
 * Position and metadata for a placed signature or initial on the PDF
 */
export interface SignaturePosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    imageData: string;
    type: 'signature' | 'initial';
}

/**
 * Loading state for async operations
 */
export interface LoadingState {
    pdf: boolean;
    signature: boolean;
    initial: boolean;
}

/**
 * Error state for better error handling
 */
export interface ErrorState {
    pdf: string | null;
    signature: string | null;
    initial: string | null;
    general: string | null;
}

/**
 * URL parameters expected from Flutter WebView
 */
export interface UrlParams {
    file: string | null;
    userId: string | null;
}
