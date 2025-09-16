import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';

interface SignaturePosition {
  id: string;
  x: number; // Always store in actual PDF coordinates (not scaled)
  y: number; // Always store in actual PDF coordinates (not scaled)
  width: number; // Always store in actual PDF coordinates (not scaled)
  height: number; // Always store in actual PDF coordinates (not scaled)
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
  pdfPages: Array<{
    width: number; // Original PDF width
    height: number; // Original PDF height
    scale: number;
    canvas?: HTMLCanvasElement;
    actualWidth?: number; // Rendered width on screen
    actualHeight?: number; // Rendered height on screen
  }> = [];
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
      const response = await fetch('assets/test.pdf');
      const arrayBuffer = await response.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
      await this.renderPDF();
      this.pdfLoaded = true;
      this.signatures = [];
    } catch (error) {
      console.error('Error loading test PDF:', error);
      alert('Error loading test PDF file');
    }
  }

  async renderPDF() {
    this.pdfPages = [];
    const scale = 1.5;

    for (let i = 1; i <= this.pdfDocument.numPages; i++) {
      const page = await this.pdfDocument.getPage(i);
      const viewport = page.getViewport({ scale });
      this.pdfPages.push({
        width: viewport.width,
        height: viewport.height,
        scale
      });
    }

    setTimeout(() => this.renderAllPages(), 100);
  }

  async renderAllPages() {
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < this.pdfDocument.numPages; i++) {
      const page = await this.pdfDocument.getPage(i + 1);
      const canvas = canvases[i] as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      const viewport = page.getViewport({ scale: this.pdfPages[i].scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Store actual rendered dimensions
      this.pdfPages[i].actualWidth = canvas.offsetWidth;
      this.pdfPages[i].actualHeight = canvas.offsetHeight;

      await page.render({ canvasContext: context, viewport }).promise;
      this.pdfPages[i].canvas = canvas;
    }
  }

  // Get the scale factors for a page
  private getPageScaleFactors(pageIndex: number): { scaleX: number; scaleY: number } {
    const pageData = this.pdfPages[pageIndex];
    const canvas = pageData.canvas;

    if (!canvas) {
      return { scaleX: 1, scaleY: 1 };
    }

    // Calculate the actual scale based on rendered size vs original size
    const scaleX = canvas.offsetWidth / pageData.width;
    const scaleY = canvas.offsetHeight / pageData.height;

    return { scaleX, scaleY };
  }

  // Convert screen coordinates to PDF coordinates
  private screenToPdfCoords(screenX: number, screenY: number, pageIndex: number): { x: number; y: number } {
    const { scaleX, scaleY } = this.getPageScaleFactors(pageIndex);
    return {
      x: screenX / scaleX,
      y: screenY / scaleY
    };
  }

  // Convert PDF coordinates to screen coordinates
  private pdfToScreenCoords(pdfX: number, pdfY: number, pageIndex: number): { x: number; y: number } {
    const { scaleX, scaleY } = this.getPageScaleFactors(pageIndex);
    return {
      x: pdfX * scaleX,
      y: pdfY * scaleY
    };
  }

  addSignature() {
    if (!this.currentSignature || !this.pdfLoaded) return;

    const viewer = this.pdfViewer.nativeElement;
    const scrollTop = viewer.scrollTop;
    let currentPage = 1;
    let cumulativeHeight = 0;

    for (let i = 0; i < this.pdfPages.length; i++) {
      const { actualHeight } = this.pdfPages[i];
      cumulativeHeight += (actualHeight || this.pdfPages[i].height) + 120;
      if (scrollTop < cumulativeHeight) {
        currentPage = i + 1;
        break;
      }
    }

    // Store coordinates in PDF space (not screen space)
    const signature: SignaturePosition = {
      id: Date.now().toString(),
      x: 50, // PDF coordinates
      y: 50, // PDF coordinates
      width: 100, // PDF coordinates
      height: 50, // PDF coordinates
      page: currentPage,
      imageData: this.currentSignature
    };

    this.signatures.push(signature);
  }

  // Get display coordinates for a signature
  getSignatureDisplayCoords(signature: SignaturePosition) {
    const pageIndex = signature.page - 1;
    const screenCoords = this.pdfToScreenCoords(signature.x, signature.y, pageIndex);
    const screenSize = this.pdfToScreenCoords(signature.width, signature.height, pageIndex);

    return {
      left: screenCoords.x,
      top: screenCoords.y,
      width: screenSize.x,
      height: screenSize.y
    };
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
    if (!this.draggedSignature) return;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const pageIndex = this.draggedSignature.page - 1;
    const pageContainer = this.getPageContainer(pageIndex);
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();

    // Calculate screen coordinates
    const screenX = clientX - rect.left - this.dragOffset.x;
    const screenY = clientY - rect.top - this.dragOffset.y;

    // Convert to PDF coordinates
    const pdfCoords = this.screenToPdfCoords(screenX, screenY, pageIndex);

    // Apply bounds checking in PDF space
    this.draggedSignature.x = Math.max(0, Math.min(pdfCoords.x, this.pdfPages[pageIndex].width - this.draggedSignature.width));
    this.draggedSignature.y = Math.max(0, Math.min(pdfCoords.y, this.pdfPages[pageIndex].height - this.draggedSignature.height));
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
    if (!this.resizingSignature) return;

    let clientX = 0, clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const pageIndex = this.resizingSignature.page - 1;
    const pageContainer = this.getPageContainer(pageIndex);
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();

    // Calculate screen coordinates
    const screenWidth = clientX - rect.left - this.resizingSignature.x * this.getPageScaleFactors(pageIndex).scaleX;
    const screenHeight = clientY - rect.top - this.resizingSignature.y * this.getPageScaleFactors(pageIndex).scaleY;

    // Convert to PDF coordinates
    const pdfSize = this.screenToPdfCoords(screenWidth, screenHeight, pageIndex);

    // Apply bounds checking in PDF space
    const newWidth = Math.max(50, pdfSize.x);
    const newHeight = Math.max(25, pdfSize.y);

    this.resizingSignature.width = Math.min(newWidth, this.pdfPages[pageIndex].width - this.resizingSignature.x);
    this.resizingSignature.height = Math.min(newHeight, this.pdfPages[pageIndex].height - this.resizingSignature.y);
  }

  private getPageContainer(pageIndex: number): HTMLElement | null {
    return document.querySelector(`.page-canvas-container:nth-child(${pageIndex + 2})`) as HTMLElement;
  }

  getSignaturesForPage(pageNumber: number) {
    return this.signatures.filter(sig => sig.page === pageNumber);
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

      for (const [pageNum, pageSignatures] of signaturesByPage) {
        const page = pdfDoc.getPage(pageNum - 1);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();

        for (const sig of pageSignatures) {
          try {
            const imageBytes = this.dataURLToBytes(sig.imageData);
            const image = sig.imageData.includes('data:image/png')
              ? await pdfDoc.embedPng(imageBytes)
              : await pdfDoc.embedJpg(imageBytes);

            // Coordinates are already in PDF space, just need to flip Y axis
            const pdfY = pdfHeight - sig.y - sig.height;

            page.drawImage(image, {
              x: sig.x,
              y: pdfY,
              width: sig.width,
              height: sig.height
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
