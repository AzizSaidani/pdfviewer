import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
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

interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('pdfViewer') pdfViewer!: ElementRef<HTMLDivElement>;

  pdfLoaded = false;
  pdfDocument: any;
  currentPageNumber = 1;
  totalPages = 0;
  currentPageData: { width: number; height: number; scale: number; canvas?: HTMLCanvasElement } | null = null;

  signatures: SignaturePosition[] = [];
  currentSignature: string | null = null;

  // Original drag/resize properties
  draggedSignature: SignaturePosition | null = null;
  resizingSignature: SignaturePosition | null = null;
  dragOffset = { x: 0, y: 0 };
  resizeOffset = { x: 0, y: 0 };

  // New Flutter WebView compatibility properties
  private lastTouchPosition: TouchPosition | null = null;
  private touchStartTime = 0;
  private isDragging = false;
  private isResizing = false;
  private activePointerId: number | null = null;

  ngOnInit() {
    // pdf.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    this.loadDefaultSignature();
  }

  ngOnDestroy() {
    this.removeFlutterCompatibleListeners();
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

    // allow the view to update
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
    // TS wants the string union but most browsers support it — using any to satisfy TS
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

  /** Scale calculation */
  private getPageScale(): number {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;

    if (isMobile) {
      const availableWidth = window.innerWidth * 0.85;
      return Math.min(1.2, availableWidth / 595);
    } else if (isTablet) {
      const availableWidth = window.innerWidth * 0.9;
      return Math.min(1.4, availableWidth / 595);
    } else {
      return Math.min(1.6, 1200 / 595);
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

  /** Add signature */
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

  /**
   * Enhanced client coordinates that work better in Flutter WebView
   */
  private getClientCoordinates(event: any): { x: number; y: number } {
    // Try PointerEvent first
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }

    // Try TouchEvent
    if (event.touches && event.touches.length > 0) {
      const touch = event.touches[0];
      return { x: touch.clientX, y: touch.clientY };
    }

    // Try changedTouches for touchend
    if (event.changedTouches && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }

    // Fallback to pageX/pageY if available
    if (typeof event.pageX === 'number' && typeof event.pageY === 'number') {
      return { x: event.pageX, y: event.pageY };
    }

    return { x: 0, y: 0 };
  }

  /**
   * Flutter WebView compatible drag start
   */
  startDrag(signature: SignaturePosition, event: any) {
    // Prevent default browser behaviors
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();

    // Set flags
    this.isDragging = true;
    this.draggedSignature = signature;
    this.touchStartTime = Date.now();

    // Store pointer ID for tracking
    if (event.pointerId !== undefined) {
      this.activePointerId = event.pointerId;
    }

    const { x, y } = this.getClientCoordinates(event);
    this.lastTouchPosition = { x, y, timestamp: Date.now() };

    // Calculate offset from signature top-left corner
    const target = event.currentTarget || event.target;
    const rect = target.getBoundingClientRect();
    this.dragOffset = {
      x: x - rect.left,
      y: y - rect.top
    };

    // Add body class for preventing scroll
    document.body.classList.add('dragging');

    // Multiple event attachment strategies for Flutter WebView
    this.attachFlutterCompatibleListeners('drag');

    // Try to set pointer capture if available
    try {
      if (target.setPointerCapture && event.pointerId !== undefined) {
        target.setPointerCapture(event.pointerId);
      }
    } catch (e) {
      console.log('Pointer capture not available');
    }
  }

  /**
   * Flutter WebView compatible resize start
   */
  startResize(signature: SignaturePosition, event: any) {
    // Prevent event bubbling to drag handler
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();

    // Set flags
    this.isResizing = true;
    this.resizingSignature = signature;
    this.touchStartTime = Date.now();

    if (event.pointerId !== undefined) {
      this.activePointerId = event.pointerId;
    }

    const { x, y } = this.getClientCoordinates(event);
    this.lastTouchPosition = { x, y, timestamp: Date.now() };

    const target = event.currentTarget || event.target;
    const rect = target.getBoundingClientRect();
    this.resizeOffset = {
      x: x - rect.left,
      y: y - rect.top
    };

    // Add body class for preventing scroll
    document.body.classList.add('resizing');

    this.attachFlutterCompatibleListeners('resize');

    try {
      if (target.setPointerCapture && event.pointerId !== undefined) {
        target.setPointerCapture(event.pointerId);
      }
    } catch (e) {
      console.log('Pointer capture not available');
    }
  }

  /**
   * Unified move handler for both drag and resize
   */
  private handleMove = (event: any) => {
    if (!this.isDragging && !this.isResizing) return;

    // Prevent scrolling and other default behaviors
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();

    const { x, y } = this.getClientCoordinates(event);
    const currentTime = Date.now();

    // Update last touch position for velocity tracking
    this.lastTouchPosition = { x, y, timestamp: currentTime };

    if (this.isDragging && this.draggedSignature) {
      this.performDrag(x, y);
    } else if (this.isResizing && this.resizingSignature) {
      this.performResize(x, y);
    }
  }

  /**
   * Unified end handler
   */
  private handleEnd = (event: any) => {
    const wasInteracting = this.isDragging || this.isResizing;

    // Clean up state
    this.isDragging = false;
    this.isResizing = false;
    this.draggedSignature = null;
    this.resizingSignature = null;
    this.activePointerId = null;
    this.lastTouchPosition = null;

    // Remove body classes
    document.body.classList.remove('dragging', 'resizing');

    // Remove all listeners
    this.removeFlutterCompatibleListeners();

    // Release pointer capture
    try {
      if (event.target && event.target.releasePointerCapture && event.pointerId !== undefined) {
        event.target.releasePointerCapture(event.pointerId);
      }
    } catch (e) {
      // Ignore capture release errors
    }

    if (wasInteracting && event.preventDefault) {
      event.preventDefault();
    }
  }

  /**
   * Perform the actual drag operation
   */
  private performDrag(clientX: number, clientY: number) {
    if (!this.draggedSignature || !this.currentPageData) return;

    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();

    // Calculate scaling factors
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    // Calculate new position
    const newX = (clientX - rect.left - this.dragOffset.x) / scaleX;
    const newY = (clientY - rect.top - this.dragOffset.y) / scaleY;

    // Apply constraints
    this.draggedSignature.x = this.clamp(
      newX,
      0,
      this.currentPageData.width - this.draggedSignature.width
    );
    this.draggedSignature.y = this.clamp(
      newY,
      0,
      this.currentPageData.height - this.draggedSignature.height
    );
  }

  /**
   * Perform the actual resize operation
   */
  private performResize(clientX: number, clientY: number) {
    if (!this.resizingSignature || !this.currentPageData) return;

    const pageContainer = document.querySelector('.page-canvas-container') as HTMLElement;
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scaleX = pageContainer.offsetWidth / this.currentPageData.width;
    const scaleY = pageContainer.offsetHeight / this.currentPageData.height;

    // Calculate new dimensions
    const newWidth = Math.max(50, (clientX - rect.left - this.resizingSignature.x * scaleX) / scaleX);
    const newHeight = Math.max(25, (clientY - rect.top - this.resizingSignature.y * scaleY) / scaleY);

    // Apply constraints
    this.resizingSignature.width = this.clamp(
      newWidth,
      50,
      this.currentPageData.width - this.resizingSignature.x
    );
    this.resizingSignature.height = this.clamp(
      newHeight,
      25,
      this.currentPageData.height - this.resizingSignature.y
    );
  }

  /**
   * Attach multiple event listeners for maximum Flutter WebView compatibility
   */
  private attachFlutterCompatibleListeners(type: 'drag' | 'resize') {
    // Remove any existing listeners first
    this.removeFlutterCompatibleListeners();

    // Add pointer events (primary)
    document.addEventListener('pointermove', this.handleMove, { passive: false });
    document.addEventListener('pointerup', this.handleEnd, { passive: false });
    document.addEventListener('pointercancel', this.handleEnd, { passive: false });

    // Add touch events (fallback for Flutter WebView)
    document.addEventListener('touchmove', this.handleMove, { passive: false });
    document.addEventListener('touchend', this.handleEnd, { passive: false });
    document.addEventListener('touchcancel', this.handleEnd, { passive: false });

    // Add mouse events (additional fallback)
    document.addEventListener('mousemove', this.handleMove, { passive: false });
    document.addEventListener('mouseup', this.handleEnd, { passive: false });
    document.addEventListener('mouseleave', this.handleEnd, { passive: false });

    // Prevent context menu on long press (mobile)
    document.addEventListener('contextmenu', this.preventDefault, { passive: false });

    // Prevent text selection during drag
    document.addEventListener('selectstart', this.preventDefault, { passive: false });
  }

  /**
   * Remove all attached listeners
   */
  private removeFlutterCompatibleListeners() {
    // Remove pointer events
    document.removeEventListener('pointermove', this.handleMove);
    document.removeEventListener('pointerup', this.handleEnd);
    document.removeEventListener('pointercancel', this.handleEnd);

    // Remove touch events
    document.removeEventListener('touchmove', this.handleMove);
    document.removeEventListener('touchend', this.handleEnd);
    document.removeEventListener('touchcancel', this.handleEnd);

    // Remove mouse events
    document.removeEventListener('mousemove', this.handleMove);
    document.removeEventListener('mouseup', this.handleEnd);
    document.removeEventListener('mouseleave', this.handleEnd);

    // Remove prevention handlers
    document.removeEventListener('contextmenu', this.preventDefault);
    document.removeEventListener('selectstart', this.preventDefault);
  }

  /**
   * Helper to prevent default behavior
   */
  private preventDefault = (e: Event) => {
    if (this.isDragging || this.isResizing) {
      e.preventDefault();
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** Utilities */
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
      // pdf.js provides the original array buffer via getData() in many builds
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
}
