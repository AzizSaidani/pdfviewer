import { Injectable } from '@angular/core';
import { SignaturePosition } from '../models/signature.model';
import { SIGNATURE_CONSTANTS, INITIAL_CONSTANTS } from '../constants/app.constants';
import { groupBy } from '../utils/pdf.utils';

/**
 * Service responsible for managing signature positions and operations
 */
@Injectable({
    providedIn: 'root'
})
export class SignatureManagementService {
    private signatures: SignaturePosition[] = [];

    /**
     * Add a new signature to the document
     */
    addSignature(
        imageData: string,
        pageNumber: number,
        pageWidth: number,
        pageHeight: number,
        type: 'signature' | 'initial' = 'signature'
    ): SignaturePosition {
        const width = type === 'signature'
            ? SIGNATURE_CONSTANTS.DEFAULT_WIDTH
            : INITIAL_CONSTANTS.DEFAULT_WIDTH;

        const height = type === 'signature'
            ? SIGNATURE_CONSTANTS.DEFAULT_HEIGHT
            : INITIAL_CONSTANTS.DEFAULT_HEIGHT;

        const centerX = (pageWidth - width) / 2;
        const centerY = (pageHeight - height) / 2;

        const signature: SignaturePosition = {
            id: Date.now().toString(),
            x: centerX,
            y: centerY,
            width,
            height,
            page: pageNumber,
            imageData,
            type
        };

        this.signatures.push(signature);
        return signature;
    }

    /**
     * Remove a signature by ID
     */
    removeSignature(id: string): void {
        this.signatures = this.signatures.filter(sig => sig.id !== id);
    }

    /**
     * Clear all signatures
     */
    clearAll(): void {
        this.signatures = [];
    }

    /**
     * Get all signatures
     */
    getAll(): SignaturePosition[] {
        return [...this.signatures];
    }

    /**
     * Get signatures for a specific page
     */
    getForPage(pageNumber: number): SignaturePosition[] {
        return this.signatures.filter(sig => sig.page === pageNumber);
    }

    /**
     * Group signatures by page
     */
    groupByPage(): Map<number, SignaturePosition[]> {
        return groupBy(this.signatures, sig => sig.page);
    }

    /**
     * Get total signature count
     */
    getCount(): number {
        return this.signatures.length;
    }

    /**
     * Update signature position
     */
    updatePosition(id: string, x: number, y: number): void {
        const signature = this.signatures.find(sig => sig.id === id);
        if (signature) {
            signature.x = x;
            signature.y = y;
        }
    }

    /**
     * Update signature size
     */
    updateSize(id: string, width: number, height: number): void {
        const signature = this.signatures.find(sig => sig.id === id);
        if (signature) {
            signature.width = width;
            signature.height = height;
        }
    }
}
