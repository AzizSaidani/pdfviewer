import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Firestore, doc, updateDoc, arrayUnion, getDoc } from '@angular/fire/firestore';
import { from, Observable, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

/**
 * Service to handle PDF upload to Firebase Storage and Firestore updates
 */
@Injectable({
    providedIn: 'root'
})
export class PdfService {

    constructor(
        private storage: Storage,
        private firestore: Firestore
    ) { }

    /**
     * Upload signed PDF to Firebase Storage and update Firestore
     * @param pdfBytes - The PDF file as Uint8Array
     * @param storagePath - The storage path (e.g., "envelopes/12345678/1.pdf")
     * @param envelopeId - The envelope ID for Firestore update
     * @param fileName - The file name (e.g., "1.pdf")
     * @returns Observable with the download URL
     */
    uploadSignedPDF(
        pdfBytes: Uint8Array,
        storagePath: string,
        envelopeId: string,
        fileName: string
    ): Observable<string> {
        console.log('Uploading signed PDF to:', storagePath);

        // Create a blob from the PDF bytes
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

        // Create storage reference
        const storageRef = ref(this.storage, storagePath);

        // Upload the file
        return from(uploadBytes(storageRef, blob)).pipe(
            switchMap(() => {
                console.log('PDF uploaded successfully, getting download URL...');
                return from(getDownloadURL(storageRef));
            }),
            switchMap(downloadUrl => {
                console.log('Download URL obtained:', downloadUrl);
                console.log('Updating Firestore for envelope:', envelopeId);

                // Update Firestore to mark the file as signed
                return this.updateEnvelopeFileSigned(envelopeId, fileName).pipe(
                    map(() => downloadUrl)
                );
            }),
            catchError(error => {
                console.error('Error uploading PDF or updating Firestore:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Update the Firestore envelope document to mark a file as signed
     * Also checks if all files are signed and updates envelope signed status
     * @param envelopeId - The envelope document ID
     * @param fileName - The file name to mark as signed
     */
    private updateEnvelopeFileSigned(envelopeId: string, fileName: string): Observable<void> {
        const envelopeRef = doc(this.firestore, `envelopes/${envelopeId}`);

        return from(getDoc(envelopeRef)).pipe(
            switchMap(docSnapshot => {
                if (!docSnapshot.exists()) {
                    throw new Error(`Envelope ${envelopeId} not found`);
                }

                const data = docSnapshot.data();
                const files = data['files'] || [];

                // Find the file and update its signed status
                const updatedFiles = files.map((file: any) => {
                    if (file.name === fileName) {
                        return { ...file, signed: true };
                    }
                    return file;
                });

                // Check if ALL files are now signed
                const allFilesSigned = updatedFiles.every((file: any) => file.signed === true);

                console.log('Updating files array:', updatedFiles);
                console.log('All files signed:', allFilesSigned);

                // Prepare update object
                const updateData: any = {
                    files: updatedFiles
                };

                // If all files are signed, mark the envelope as signed and update status
                if (allFilesSigned) {
                    updateData.signed = true;
                    updateData.status = 'finished';
                    console.log('All PDFs signed! Marking envelope as signed and status as finished.');
                }

                // Update the document with the modified files array and signed status
                return from(updateDoc(envelopeRef, updateData));
            }),
            catchError(error => {
                console.error('Error updating Firestore:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Extract storage path from Firebase Storage URL
     * @param url - The Firebase Storage download URL
     * @returns The storage path (e.g., "envelopes/12345678/1.pdf")
     */
    extractStoragePathFromUrl(url: string): string | null {
        try {
            // Firebase Storage URL format:
            // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);

            if (pathMatch && pathMatch[1]) {
                // Decode the path (Firebase encodes it)
                return decodeURIComponent(pathMatch[1]);
            }

            return null;
        } catch (error) {
            console.error('Error extracting storage path:', error);
            return null;
        }
    }

    /**
     * Extract file name from storage path
     * @param storagePath - The storage path (e.g., "envelopes/12345678/1.pdf")
     * @returns The file name (e.g., "1.pdf")
     */
    extractFileNameFromPath(storagePath: string): string {
        const parts = storagePath.split('/');
        return parts[parts.length - 1];
    }
}
