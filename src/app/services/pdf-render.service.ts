import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { PDF_CONSTANTS, SCALE_FACTORS, BREAKPOINTS } from '../constants/app.constants';
import { isMobile, isTablet, getDevicePixelRatio } from '../utils/pdf.utils';

export interface PageData {
    width: number;
    height: number;
    scale: number;
    canvas?: HTMLCanvasElement;
}

/**
 * Service responsible for PDF rendering operations
 */
@Injectable({
    providedIn: 'root'
})
export class PdfRenderService {

    constructor() {
        this.initializeWorker();
    }

    /**
     * Initialize PDF.js worker
     */
    private initializeWorker(): void {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_CONSTANTS.WORKER_SRC;
    }

    /**
     * Load PDF document from URL
     */
    async loadDocument(url: string): Promise<any> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return await pdfjsLib.getDocument(arrayBuffer).promise;
    }

    /**
     * Calculate optimal scale for current viewport
     */
    calculatePageScale(): number {
        if (isMobile()) {
            const availableWidth = window.innerWidth * SCALE_FACTORS.MOBILE;
            return Math.min(
                SCALE_FACTORS.MOBILE_MAX_SCALE,
                availableWidth / PDF_CONSTANTS.DEFAULT_PAGE_WIDTH
            );
        }

        if (isTablet()) {
            const availableWidth = window.innerWidth * SCALE_FACTORS.TABLET;
            return Math.min(
                SCALE_FACTORS.TABLET_MAX_SCALE,
                availableWidth / PDF_CONSTANTS.DEFAULT_PAGE_WIDTH
            );
        }

        return Math.min(
            SCALE_FACTORS.DESKTOP_MAX_SCALE,
            SCALE_FACTORS.DESKTOP_MAX_WIDTH / PDF_CONSTANTS.DEFAULT_PAGE_WIDTH
        );
    }

    /**
     * Get page data for rendering
     */
    async getPageData(pdfDocument: any, pageNumber: number): Promise<PageData> {
        const scale = this.calculatePageScale();
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        return {
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
            scale
        };
    }

    /**
     * Render page to canvas with high quality
     */
    async renderPageToCanvas(
        pdfDocument: any,
        pageNumber: number,
        canvas: HTMLCanvasElement,
        pageData: PageData
    ): Promise<void> {
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get canvas context');
        }

        const page = await pdfDocument.getPage(pageNumber);
        const devicePixelRatio = getDevicePixelRatio();
        const qualityScale = isMobile()
            ? Math.max(devicePixelRatio, PDF_CONSTANTS.QUALITY_SCALE_MOBILE)
            : devicePixelRatio;

        const renderScale = pageData.scale * qualityScale;
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${pageData.width}px`;
        canvas.style.height = `${pageData.height}px`;

        context.imageSmoothingEnabled = true;
        (context as any).imageSmoothingQuality = 'high';

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            intent: 'display' as any,
            renderInteractiveForms: false,
            optionalContentConfigPromise: null,
            annotationMode: 0
        };

        await page.render(renderContext).promise;
    }
}
