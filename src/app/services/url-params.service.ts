import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UrlParams } from '../models/signature.model';
import { VALIDATION } from '../constants/app.constants';

/**
 * Service to parse and manage URL parameters from Flutter WebView
 */
@Injectable({
    providedIn: 'root'
})
export class UrlParamsService {
    private paramsSubject = new BehaviorSubject<UrlParams>({ file: null, userId: null, envelopeId: null });
    public params$: Observable<UrlParams> = this.paramsSubject.asObservable();

    constructor() {
        this.parseUrlParams();
    }

    /**
     * Parse URL parameters from the current window location
     */
    private parseUrlParams(): void {
        try {
            const urlParams = new URLSearchParams(window.location.search);

            const file = urlParams.get('file');
            const userId = urlParams.get('userId');
            const envelopeId = urlParams.get('envelopeId');

            // We rely on URLSearchParams to handle the standard decoding.
            // We DO NOT recursively decode because that breaks Firebase Storage URLs
            // which require %2F to be preserved in the path.
            let decodedFile: string | null = null;
            if (file) {
                decodedFile = file;
                console.log('File param:', file);
            }

            // Validate userId format (basic validation)
            const validatedUserId = userId && this.isValidId(userId) ? userId : null;

            // Validate envelopeId format (basic validation)
            const validatedEnvelopeId = envelopeId && this.isValidId(envelopeId) ? envelopeId : null;

            this.paramsSubject.next({
                file: decodedFile,
                userId: validatedUserId,
                envelopeId: validatedEnvelopeId
            });
        } catch (error) {
            console.error('Error parsing URL parameters:', error);
            this.paramsSubject.next({ file: null, userId: null, envelopeId: null });
        }
    }

    /**
     * Basic validation for IDs (userId, envelopeId, etc.)
     * Prevents XSS and injection attacks
     */
    private isValidId(id: string): boolean {
        return VALIDATION.ID_PATTERN.test(id)
            && id.length >= VALIDATION.MIN_ID_LENGTH
            && id.length < VALIDATION.MAX_ID_LENGTH;
    }

    /**
     * Get current parameters synchronously
     */
    getCurrentParams(): UrlParams {
        return this.paramsSubject.value;
    }

    /**
     * Check if all required parameters are present
     */
    hasRequiredParams(): boolean {
        const params = this.getCurrentParams();
        return params.file !== null && params.userId !== null;
    }

    /**
     * Get validation errors for missing parameters
     */
    getValidationErrors(): string[] {
        const params = this.getCurrentParams();
        const errors: string[] = [];

        if (!params.file) {
            errors.push('PDF file URL is missing');
        }

        if (!params.userId) {
            errors.push('User ID is missing or invalid');
        }

        return errors;
    }
}