import { Injectable } from '@angular/core';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, Observable, from, of, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { UserSignature } from '../models/signature.model';

/**
 * Service to fetch user signatures and initials from Firebase Storage
 */
@Injectable({
    providedIn: 'root'
})
export class SignatureService {
    private signatureCache = new Map<string, UserSignature>();
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$: Observable<boolean> = this.loadingSubject.asObservable();

    constructor(private storage: Storage) { }

    /**
     * Load both signature and initial for a user
     * Results are cached to avoid redundant fetches
     */
    loadUserAssets(userId: string): Observable<UserSignature> {
        // Check cache first
        if (this.signatureCache.has(userId)) {
            return of(this.signatureCache.get(userId)!);
        }

        this.loadingSubject.next(true);

        // Fetch both signature and initial in parallel
        return forkJoin({
            signature: this.fetchImage(userId, 'signatures', 'user_signature.png'),
            initial: this.fetchImage(userId, 'initials', 'user_initial.png')
        }).pipe(
            map(({ signature, initial }) => ({
                signatureUrl: signature.url,
                initialUrl: initial.url,
                signatureDataUrl: signature.dataUrl,
                initialDataUrl: initial.dataUrl
            })),
            tap(userSignature => {
                // Cache the result
                this.signatureCache.set(userId, userSignature);
                this.loadingSubject.next(false);
            }),
            catchError(error => {
                console.error('Error loading user assets:', error);
                this.loadingSubject.next(false);
                // Return empty signature data on error
                return of({
                    signatureUrl: null,
                    initialUrl: null,
                    signatureDataUrl: undefined,
                    initialDataUrl: undefined
                });
            })
        );
    }

    /**
     * Fetch a single image from Firebase Storage and convert to data URL
     */
    private fetchImage(
        userId: string,
        folder: 'signatures' | 'initials',
        filename: string
    ): Observable<{ url: string | null; dataUrl?: string }> {
        const path = `users/${userId}/${folder}/${filename}`;
        const storageRef = ref(this.storage, path);

        return from(getDownloadURL(storageRef)).pipe(
            // First get the download URL
            catchError(error => {
                console.warn(`Image not found at ${path}:`, error);
                return of(null);
            }),
            // Then convert to data URL if we have a URL
            switchMap(url => {
                if (!url) {
                    return of({ url: null, dataUrl: undefined });
                }
                return this.convertUrlToDataUrl(url).pipe(
                    map(dataUrl => ({ url, dataUrl })),
                    catchError(() => of({ url, dataUrl: undefined }))
                );
            })
        );
    }

    /**
     * Convert a URL to a data URL for embedding
     */
    private convertUrlToDataUrl(url: string): Observable<string> {
        return new Observable(observer => {
            fetch(url)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        observer.next(reader.result as string);
                        observer.complete();
                    };
                    reader.onerror = () => {
                        observer.error('Failed to convert to data URL');
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    observer.error(error);
                });
        });
    }

    /**
     * Clear the cache for a specific user or all users
     */
    clearCache(userId?: string): void {
        if (userId) {
            this.signatureCache.delete(userId);
        } else {
            this.signatureCache.clear();
        }
    }

    /**
     * Get cached signature for a user (synchronous)
     */
    getCachedSignature(userId: string): UserSignature | null {
        return this.signatureCache.get(userId) || null;
    }
}
