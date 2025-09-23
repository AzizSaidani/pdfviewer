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
  pdfDocument: any = null;
  currentPageNumber = 1;
  totalPages = 0;
  currentPageData: { width: number; height: number; scale: number; canvas?: HTMLCanvasElement } | null = null;
  signatures: SignaturePosition[] = [];
  currentSignature: string | null = null;

  draggedSignature: SignaturePosition | null = null;
  resizingSignature: SignaturePosition | null = null;
  dragOffset = { x: 0, y: 0 };
  resizeOffset = { x: 0, y: 0 };

  ngOnInit() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    this.loadDefaultSignature();
  }

  loadDefaultSignature() {
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

  async loadTestPDF() {
    try {
      const response = await fetch('assets/doc1.pdf');
      const arrayBuffer = await response.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
      this.totalPages = this.pdfDocument.numPages;
      this.currentPageNumber = 1;
      await this.renderCurrentPage();
      this.pdfLoaded = true;
      this.signatures = [];
    } catch (error) {
      console.error('Error loading test PDF:', error);
      alert('Error loading test PDF file');
    }
  }

  async renderCurrentPage() {
    if (!this.pdfDocument) return;

    // Calculate scale
    const baseScale = 1.5;
    const maxWidth = window.innerWidth <= 600 ? window.innerWidth * 0.9 : 1200;
    const scale = Math.min(baseScale, maxWidth / 595);

    const page = await this.pdfDocument.getPage(this.currentPageNumber);
    const viewport = page.getViewport({ scale });

    this.currentPageData = {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      scale
    };

    setTimeout(() => this.renderPage(), 100);
  }

  async renderPage() {
    if (!this.currentPageData || !this.pdfDocument) return;

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const context = canvas.getContext('2d')!;
    const page = await this.pdfDocument.getPage(this.currentPageNumber);
    const viewport = page.getViewport({ scale: this.currentPageData.scale });

    canvas.width = this.currentPageData.width;
    canvas.height = this.currentPageData.height;
    this.currentPageData.canvas = canvas;

    await page.render({ canvasContext: context, viewport }).promise;
    console.log(`Rendered page ${this.currentPageNumber}: Canvas width=${canvas.width}, height=${canvas.height}`);
  }

  // Navigation methods
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

  addSignature() {
    if (!this.currentSignature || !this.pdfLoaded || !this.currentPageData) return;

    const signature: SignaturePosition = {
      id: Date.now().toString(),
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      page: this.currentPageNumber,
      imageData: this.currentSignature
    };

    this.signatures.push(signature);
  }

  /** ---------------- DRAG / TOUCH ---------------- */
  startDrag(signature: SignaturePosition, event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.draggedSignature = signature;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOffset.x = clientX - rect.left;
    this.dragOffset.y = clientY - rect.top;

    const moveHandler = (e: MouseEvent | TouchEvent) => this.onDragMove(e);
    const endHandler = () => {
      document.removeEventListener('mousemove', moveHandler as any);
      document.removeEventListener('mouseup', endHandler);
      document.removeEventListener('touchmove', moveHandler as any);
      document.removeEventListener('touchend', endHandler);
      this.draggedSignature = null;
    };

    document.addEventListener('mousemove', moveHandler as any);
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchmove', moveHandler as any, { passive: false });
    document.addEventListener('touchend', endHandler);
  }

  onDragMove(event: MouseEvent | TouchEvent) {
    if (!this.draggedSignature || !this.currentPageData) return;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    const newX = (clientX - rect.left - this.dragOffset.x) / scaleX;
    const newY = (clientY - rect.top - this.dragOffset.y) / scaleY;

    this.draggedSignature.x = Math.max(0, Math.min(newX, this.currentPageData.width - this.draggedSignature.width));
    this.draggedSignature.y = Math.max(0, Math.min(newY, this.currentPageData.height - this.draggedSignature.height));
  }

  /** ---------------- RESIZE / TOUCH ---------------- */
  startResize(signature: SignaturePosition, event: MouseEvent | TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.resizingSignature = signature;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.resizeOffset.x = clientX - rect.left;
    this.resizeOffset.y = clientY - rect.top;

    const moveHandler = (e: MouseEvent | TouchEvent) => this.onResizeMove(e);
    const endHandler = () => {
      document.removeEventListener('mousemove', moveHandler as any);
      document.removeEventListener('mouseup', endHandler);
      document.removeEventListener('touchmove', moveHandler as any);
      document.removeEventListener('touchend', endHandler);
      this.resizingSignature = null;
    };

    document.addEventListener('mousemove', moveHandler as any);
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchmove', moveHandler as any, { passive: false });
    document.addEventListener('touchend', endHandler);
  }

  onResizeMove(event: MouseEvent | TouchEvent) {
    if (!this.resizingSignature || !this.currentPageData) return;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    const newWidth = Math.max(50, (clientX - rect.left - this.resizingSignature.x) / scaleX);
    const newHeight = Math.max(25, (clientY - rect.top - this.resizingSignature.y) / scaleY);

    this.resizingSignature.width = Math.min(newWidth, this.currentPageData.width - this.resizingSignature.x);
    this.resizingSignature.height = Math.min(newHeight, this.currentPageData.height - this.resizingSignature.y);
  }

  getSignaturesForCurrentPage() {
    return this.signatures.filter(sig => sig.page === this.currentPageNumber);
  }

  getTotalSignaturesCount() {
    return this.signatures.length;
  }

  getSignaturesCountForPage(pageNumber: number) {
    return this.signatures.filter(sig => sig.page === pageNumber).length;
  }

  removeSignature(id: string) {
    this.signatures = this.signatures.filter(sig => sig.id !== id);
  }

  clearSignatures() {
    this.signatures = [];
  }

  private dataURLToBytes(dataURL: string): Uint8Array {
    const base64 = dataURL.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async savePDF() {
    if (!this.pdfDocument || this.signatures.length === 0) return;

    try {
      const { PDFDocument } = await import('pdf-lib');
      const existingPdfBytes = await this.pdfDocument.getData();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      const signaturesByPage = new Map<number, SignaturePosition[]>();
      this.signatures.forEach(sig => {
        if (!signaturesByPage.has(sig.page)) signaturesByPage.set(sig.page, []);
        signaturesByPage.get(sig.page)!.push(sig);
      });

      // We need to get the scale for each page when saving
      const baseScale = 1.5;
      const maxWidth = window.innerWidth <= 600 ? window.innerWidth * 0.9 : 1200;
      const scale = Math.min(baseScale, maxWidth / 595);

      for (const [pageNum, pageSignatures] of signaturesByPage) {
        const page = pdfDoc.getPage(pageNum - 1);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();

        for (const sig of pageSignatures) {
          try {
            const imageBytes = this.dataURLToBytes(sig.imageData);
            const image = sig.imageData.includes('data:image/png')
              ? await pdfDoc.embedPng(imageBytes)
              : await pdfDoc.embedJpg(imageBytes);

            const scaledX = sig.x / scale;
            const scaledY = sig.y / scale;
            const scaledWidth = sig.width / scale;
            const scaledHeight = sig.height / scale;
            const pdfY = pdfHeight - scaledY - scaledHeight;

            page.drawImage(image, {
              x: scaledX,
              y: pdfY,
              width: scaledWidth,
              height: scaledHeight
            });
          } catch (error) {
            console.error('Error adding signature to page:', error);
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'signed-document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Error saving PDF. Please try again.');
    }
  }
}
