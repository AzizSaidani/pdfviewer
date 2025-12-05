import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoadingState, ErrorState } from '../models/signature.model';

/**
 * Service responsible for managing UI state (loading, errors, success)
 */
@Injectable({
    providedIn: 'root'
})
export class UiStateService {
    private loadingState = new BehaviorSubject<LoadingState>({
        pdf: false,
        saving: false
    });

    private errorState = new BehaviorSubject<ErrorState>({
        pdf: null,
        signature: null,
        initial: null,
        general: null
    });

    private pdfSavedState = new BehaviorSubject<boolean>(false);
    private showSuccessState = new BehaviorSubject<boolean>(false);

    public loading$ = this.loadingState.asObservable();
    public errors$ = this.errorState.asObservable();
    public pdfSaved$ = this.pdfSavedState.asObservable();
    public showSuccess$ = this.showSuccessState.asObservable();

    /**
     * Set PDF loading state
     */
    setPdfLoading(loading: boolean): void {
        this.loadingState.next({
            ...this.loadingState.value,
            pdf: loading
        });
    }

    /**
     * Set saving state
     */
    setSaving(saving: boolean): void {
        this.loadingState.next({
            ...this.loadingState.value,
            saving
        });
    }

    /**
     * Set PDF error
     */
    setPdfError(error: string | null): void {
        this.errorState.next({
            ...this.errorState.value,
            pdf: error
        });
    }

    /**
     * Set general error with auto-clear
     */
    setGeneralError(error: string | null, autoClearMs?: number): void {
        this.errorState.next({
            ...this.errorState.value,
            general: error
        });

        if (error && autoClearMs) {
            setTimeout(() => {
                this.errorState.next({
                    ...this.errorState.value,
                    general: null
                });
            }, autoClearMs);
        }
    }

    /**
     * Clear all errors
     */
    clearErrors(): void {
        this.errorState.next({
            pdf: null,
            signature: null,
            initial: null,
            general: null
        });
    }

    /**
     * Set PDF saved state
     */
    setPdfSaved(saved: boolean): void {
        this.pdfSavedState.next(saved);
    }

    /**
     * Show success message
     */
    showSuccess(durationMs: number): void {
        this.showSuccessState.next(true);

        setTimeout(() => {
            this.showSuccessState.next(false);
            this.pdfSavedState.next(true);
        }, durationMs);
    }

    /**
     * Get current loading state
     */
    getLoadingState(): LoadingState {
        return this.loadingState.value;
    }

    /**
     * Get current error state
     */
    getErrorState(): ErrorState {
        return this.errorState.value;
    }

    /**
     * Check if PDF is saved
     */
    isPdfSaved(): boolean {
        return this.pdfSavedState.value;
    }
}
