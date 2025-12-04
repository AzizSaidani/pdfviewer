import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UrlParams } from '../models/signature.model';

/**
 * Service to parse and manage URL parameters from Flutter WebView
 */
@Injectable({
    providedIn: 'root'
})
export class UrlParamsService {
    private paramsSubject = new BehaviorSubject<UrlParams>({ file: null, userId: null });
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

            // We rely on URLSearchParams to handle the standard decoding.
            // We DO NOT recursively decode because that breaks Firebase Storage URLs
            // which require %2F to be preserved in the path.
            let decodedFile: string | null = null;
            if (file) {
                decodedFile = file;
                console.log('File param:', file);
            }

            // Validate userId format (basic validation)
            const validatedUserId = userId && this.isValidUserId(userId) ? userId : null;

            this.paramsSubject.next({
                file: decodedFile,
                userId: validatedUserId
            });
        } catch (error) {
            console.error('Error parsing URL parameters:', error);
            this.paramsSubject.next({ file: null, userId: null });
        }
    }

    /**
     * Basic validation for userId
     * Prevents XSS and injection attacks
     */
    private isValidUserId(userId: string): boolean {
        // Allow alphanumeric, hyphens, and underscores (common in Firebase UIDs)
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        return validPattern.test(userId) && userId.length > 0 && userId.length < 256;
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