import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';

interface SignaturePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  imageData: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('pdfViewer') pdfViewer!: ElementRef<HTMLDivElement>;

  pdfLoaded = false;
  pdfDocument: any;
  currentPageNumber = 1;
  totalPages = 0;
  currentPageData: { width: number; height: number; scale: number; canvas?: HTMLCanvasElement } | null = null;

  signatures: SignaturePosition[] = [];
  currentSignature: string | null = null;

  draggedSignature: SignaturePosition | null = null;
  resizingSignature: SignaturePosition | null = null;
  dragOffset = { x: 0, y: 0 };
  resizeOffset = { x: 0, y: 0 };

  // swipe handling
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    this.loadDefaultSignature();
  }

  /** Load the default signature image and store it as a data URL */
  private loadDefaultSignature() {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      this.currentSignature = canvas.toDataURL();
    };
    img.src = 'assets/signature.png';
  }

  /** Load and render a test PDF */
  async loadTestPDF() {
    try {
      const response = await fetch('assets/doc1.pdf');
      const arrayBuffer = await response.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;

      this.totalPages = this.pdfDocument.numPages;
      this.currentPageNumber = 1;
      this.signatures = [];

      await this.renderCurrentPage();
      this.pdfLoaded = true;
    } catch (error) {
      console.error('Error loading test PDF:', error);
      alert('Error loading test PDF file');
    }
  }

  /** Calculate scale and render current page */
  async renderCurrentPage() {
    if (!this.pdfDocument) return;

    const scale = this.getPageScale();
    const page = await this.pdfDocument.getPage(this.currentPageNumber);
    const viewport = page.getViewport({ scale });

    this.currentPageData = {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      scale
    };

    setTimeout(() => this.renderPage(), 100);
  }

  /** Enhanced render page with high-quality mobile support */
  private async renderPage() {
    if (!this.currentPageData || !this.pdfDocument) return;

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const context = canvas.getContext('2d')!;
    const page = await this.pdfDocument.getPage(this.currentPageNumber);

    const devicePixelRatio = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth <= 768;

    const qualityScale = isMobile ? Math.max(devicePixelRatio, 2.0) : devicePixelRatio;
    const renderScale = this.currentPageData.scale * qualityScale;

    const viewport = page.getViewport({ scale: renderScale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    canvas.style.width = `${this.currentPageData.width}px`;
    canvas.style.height = `${this.currentPageData.height}px`;

    this.currentPageData.canvas = canvas;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      intent: 'display' as any,
      renderInteractiveForms: false,
      optionalContentConfigPromise: null,
      annotationMode: 0
    };

    await page.render(renderContext).promise;

    console.log(`Rendered page ${this.currentPageNumber} at scale ${renderScale} (quality: ${qualityScale}x)`);
  }

  /** Enhanced scale calculation for mobile devices */
  private getPageScale(): number {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;

    if (isMobile) {
      const availableWidth = window.innerWidth * 0.85;
      const baseScale = 1.2;
      return Math.min(baseScale, availableWidth / 595);
    } else if (isTablet) {
      const availableWidth = window.innerWidth * 0.9;
      const baseScale = 1.4;
      return Math.min(baseScale, availableWidth / 595);
    } else {
      const baseScale = 1.6;
      const maxWidth = 1200;
      return Math.min(baseScale, maxWidth / 595);
    }
  }

  /** Navigation */
  goToNextPage() {
    if (this.currentPageNumber < this.totalPages) {
      this.currentPageNumber++;
      this.renderCurrentPage();
    }
  }

  goToPreviousPage() {
    if (this.currentPageNumber > 1) {
      this.currentPageNumber--;
      this.renderCurrentPage();
    }
  }

  goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.currentPageNumber = pageNumber;
      this.renderCurrentPage();
    }
  }

  /** Add a signature to current page */
  addSignature() {
    if (!this.currentSignature || !this.pdfLoaded || !this.currentPageData) return;

    const signatureWidth = 100;
    const signatureHeight = 50;
    const centerX = (this.currentPageData.width - signatureWidth) / 2;
    const centerY = (this.currentPageData.height - signatureHeight) / 2;

    this.signatures.push({
      id: Date.now().toString(),
      x: centerX,
      y: centerY,
      width: signatureWidth,
      height: signatureHeight,
      page: this.currentPageNumber,
      imageData: this.currentSignature
    });
  }

  /** ---------------- DRAG / RESIZE ---------------- */
  private getClientCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  startDrag(signature: SignaturePosition, event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.draggedSignature = signature;

    const { x, y } = this.getClientCoordinates(event);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOffset = { x: x - rect.left, y: y - rect.top };

    this.attachListeners(
      e => this.onDragMove(e),
      () => (this.draggedSignature = null)
    );
  }

  onDragMove(event: MouseEvent | TouchEvent) {
    if (!this.draggedSignature || !this.currentPageData) return;

    const { x, y } = this.getClientCoordinates(event);
    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    this.draggedSignature.x = this.clamp((x - rect.left - this.dragOffset.x) / scaleX, 0, this.currentPageData.width - this.draggedSignature.width);
    this.draggedSignature.y = this.clamp((y - rect.top - this.dragOffset.y) / scaleY, 0, this.currentPageData.height - this.draggedSignature.height);
  }

  startResize(signature: SignaturePosition, event: MouseEvent | TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.resizingSignature = signature;

    const { x, y } = this.getClientCoordinates(event);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.resizeOffset = { x: x - rect.left, y: y - rect.top };

    this.attachListeners(
      e => this.onResizeMove(e),
      () => (this.resizingSignature = null)
    );
  }

  onResizeMove(event: MouseEvent | TouchEvent) {
    if (!this.resizingSignature || !this.currentPageData) return;

    const { x, y } = this.getClientCoordinates(event);
    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    const newWidth = Math.max(50, (x - rect.left - this.resizingSignature.x) / scaleX);
    const newHeight = Math.max(25, (y - rect.top - this.resizingSignature.y) / scaleY);

    this.resizingSignature.width = this.clamp(newWidth, 50, this.currentPageData.width - this.resizingSignature.x);
    this.resizingSignature.height = this.clamp(newHeight, 25, this.currentPageData.height - this.resizingSignature.y);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private attachListeners(moveHandler: (e: MouseEvent | TouchEvent) => void, endCallback: () => void) {
    const endHandler = () => {
      document.removeEventListener('mousemove', moveHandler as any);
      document.removeEventListener('mouseup', endHandler);
      document.removeEventListener('touchmove', moveHandler as any);
      document.removeEventListener('touchend', endHandler);
      endCallback();
    };

    document.addEventListener('mousemove', moveHandler as any);
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchmove', moveHandler as any, { passive: false });
    document.addEventListener('touchend', endHandler);
  }

  /** ---------------- SIGNATURE UTILITIES ---------------- */
  getSignaturesForCurrentPage() {
    return this.signatures.filter(sig => sig.page === this.currentPageNumber);
  }

  removeSignature(id: string) {
    this.signatures = this.signatures.filter(sig => sig.id !== id);
  }

  clearSignatures() {
    this.signatures = [];
  }

  private dataURLToBytes(dataURL: string): Uint8Array {
    const base64 = dataURL.split(',')[1];
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  async savePDF() {
    if (!this.pdfDocument || this.signatures.length === 0) return;

    try {
      const { PDFDocument } = await import('pdf-lib');
      const existingPdfBytes = await this.pdfDocument.getData();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      const scale = this.getPageScale();
      const signaturesByPage = this.groupSignaturesByPage();

      for (const [pageNum, pageSignatures] of signaturesByPage) {
        const page = pdfDoc.getPage(pageNum - 1);
        const { height: pdfHeight } = page.getSize();

        for (const sig of pageSignatures) {
          const imageBytes = this.dataURLToBytes(sig.imageData);
          const image = sig.imageData.includes('data:image/png')
            ? await pdfDoc.embedPng(imageBytes)
            : await pdfDoc.embedJpg(imageBytes);

          page.drawImage(image, {
            x: sig.x / scale,
            y: pdfHeight - sig.y / scale - sig.height / scale,
            width: sig.width / scale,
            height: sig.height / scale
          });
        }
      }

      this.downloadPDF(await pdfDoc.save());
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Error saving PDF. Please try again.');
    }
  }

  private groupSignaturesByPage(): Map<number, SignaturePosition[]> {
    const map = new Map<number, SignaturePosition[]>();
    this.signatures.forEach(sig => {
      if (!map.has(sig.page)) map.set(sig.page, []);
      map.get(sig.page)!.push(sig);
    });
    return map;
  }

  private downloadPDF(pdfBytes: Uint8Array) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** ---------------- SWIPE HANDLING ---------------- */
  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeThreshold = 50; // minimum px needed
    const diff = this.touchEndX - this.touchStartX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.goToPreviousPage();
      } else {
        this.goToNextPage();
      }
    }
  }
}
