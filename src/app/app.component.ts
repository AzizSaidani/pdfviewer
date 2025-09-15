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
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('signatureInput') signatureInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfViewer') pdfViewer!: ElementRef<HTMLDivElement>;

  pdfLoaded = false;
  pdfDocument: any = null;
  pdfPages: Array<{width: number, height: number, scale: number, canvas?: HTMLCanvasElement}> = [];
  signatures: SignaturePosition[] = [];
  currentSignature: string | null = null;
  draggedSignature: SignaturePosition | null = null;
  resizingSignature: SignaturePosition | null = null;
  dragOffset = { x: 0, y: 0 };
  resizeOffset = { x: 0, y: 0 };

  ngOnInit() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
      await this.renderPDF();
      this.pdfLoaded = true;
      this.signatures = [];
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error loading PDF file');
    }
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

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      this.pdfPages[i].canvas = canvas;
    }
  }

  onSignatureSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentSignature = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  addSignature() {
    if (!this.currentSignature || !this.pdfLoaded) return;

    // Determine the current page based on scroll position
    const viewer = this.pdfViewer.nativeElement;
    const scrollTop = viewer.scrollTop;
    let currentPage = 1;

    let cumulativeHeight = 0;
    for (let i = 0; i < this.pdfPages.length; i++) {
      cumulativeHeight += this.pdfPages[i].height + 120; // Account for margins and headers
      if (scrollTop < cumulativeHeight) {
        currentPage = i + 1;
        break;
      }
    }

    const signature: SignaturePosition = {
      id: Date.now().toString(),
      x: 50, // Fixed position at top-left
      y: 50,
      width: 100,
      height: 50,
      page: currentPage,
      imageData: this.currentSignature
    };

    this.signatures.push(signature);
  }

  startDrag(signature: SignaturePosition, event: MouseEvent) {
    event.preventDefault();
    this.draggedSignature = signature;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOffset.x = event.clientX - rect.left;
    this.dragOffset.y = event.clientY - rect.top;

    const mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    const mouseUpHandler = () => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      this.draggedSignature = null;
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }

  startResize(signature: SignaturePosition, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.resizingSignature = signature;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.resizeOffset.x = event.clientX - rect.left;
    this.resizeOffset.y = event.clientY - rect.top;

    const mouseMoveHandler = (e: MouseEvent) => this.onResizeMove(e);
    const mouseUpHandler = () => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      this.resizingSignature = null;
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }

  onMouseMove(event: MouseEvent) {
    if (!this.draggedSignature) return;

    const pageContainer = document.querySelector(`[style*="width: ${this.pdfPages[this.draggedSignature.page - 1].width}px"]`) as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const newX = event.clientX - rect.left - this.dragOffset.x;
    const newY = event.clientY - rect.top - this.dragOffset.y;

    this.draggedSignature.x = Math.max(0, Math.min(newX, this.pdfPages[this.draggedSignature.page - 1].width - this.draggedSignature.width));
    this.draggedSignature.y = Math.max(0, Math.min(newY, this.pdfPages[this.draggedSignature.page - 1].height - this.draggedSignature.height));
  }

  onResizeMove(event: MouseEvent) {
    if (!this.resizingSignature) return;

    const pageContainer = document.querySelector(`[style*="width: ${this.pdfPages[this.resizingSignature.page - 1].width}px"]`) as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const newWidth = Math.max(50, event.clientX - rect.left - this.resizingSignature.x);
    const newHeight = Math.max(25, event.clientY - rect.top - this.resizingSignature.y);

    this.resizingSignature.width = Math.min(newWidth, this.pdfPages[this.resizingSignature.page - 1].width - this.resizingSignature.x);
    this.resizingSignature.height = Math.min(newHeight, this.pdfPages[this.resizingSignature.page - 1].height - this.resizingSignature.y);
  }

  getSignaturesForPage(pageNumber: number): SignaturePosition[] {
    return this.signatures.filter(sig => sig.page === pageNumber);
  }

  selectSignature(id: string) {
    const signature = this.signatures.find(sig => sig.id === id);
    if (signature) {
      this.currentSignature = signature.imageData;
    }
  }

  removeSignature(id: string) {
    this.signatures = this.signatures.filter(sig => sig.id !== id);
  }

  clearSignatures() {
    this.signatures = [];
  }

  trackSignature(index: number, signature: SignaturePosition): string {
    return signature.id;
  }

  private dataURLToBytes(dataURL: string): Uint8Array {
    const base64 = dataURL.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
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
        if (!signaturesByPage.has(sig.page)) {
          signaturesByPage.set(sig.page, []);
        }
        signaturesByPage.get(sig.page)!.push(sig);
      });

      for (const [pageNum, pageSignatures] of signaturesByPage) {
        const page = pdfDoc.getPage(pageNum - 1);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();
        const pageScale = this.pdfPages[pageNum - 1].scale;

        for (const sig of pageSignatures) {
          try {
            const imageBytes = this.dataURLToBytes(sig.imageData);
            let image;
            if (sig.imageData.includes('data:image/png')) {
              image = await pdfDoc.embedPng(imageBytes);
            } else {
              image = await pdfDoc.embedJpg(imageBytes);
            }

            const scaledX = sig.x / pageScale;
            const scaledY = sig.y / pageScale;
            const scaledWidth = sig.width / pageScale;
            const scaledHeight = sig.height / pageScale;

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
