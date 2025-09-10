// app.component.ts
import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import {NgForOf, NgIf} from "@angular/common";
import { FormsModule } from "@angular/forms";

declare const pdfjsLib: any;

interface DraggableImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  isDragging: boolean;
  isResizing: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [NgIf, FormsModule, NgForOf],
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChildren('pdfCanvas') canvasRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  title = 'pdf-viewer-app';

  pdfDoc: any = null;
  totalPages = 0;
  scale = 1.0;
  isLoaded = false;
  error = '';

  pages: number[] = [];
  pdfUrl = 'assets/test2.pdf';

  // Signature functionality
  draggableImages: DraggableImage[] = [];
  private dragOffset = { x: 0, y: 0 };
  private currentDragImage: DraggableImage | null = null;
  private imageIdCounter = 0;

  ngOnInit() {
    this.loadPdfJs().then(() => {
      this.loadPdf();
    }).catch(err => {
      this.error = 'Failed to load PDF.js library';
      console.error('PDF.js loading error:', err);
    });

    // Add touch event listeners for mobile
    this.setupTouchEvents();
  }

  private setupTouchEvents() {
    // Prevent default touch behaviors that might interfere
    document.addEventListener('touchmove', (e) => {
      if (this.currentDragImage) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  private loadPdfJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  private async loadPdf() {
    try {
      this.error = '';
      const loadingTask = (window as any).pdfjsLib.getDocument(this.pdfUrl);
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
      this.isLoaded = true;

      setTimeout(() => {
        this.renderAllPages();
      }, 0);

    } catch (error: any) {
      this.error = `Failed to load PDF: ${error.message}`;
      console.error('PDF loading error:', error);
    }
  }

  private renderAllPages() {
    this.pages.forEach((pageNum, index) => {
      this.pdfDoc.getPage(pageNum).then((page: any) => {
        const canvas = this.canvasRefs.toArray()[index].nativeElement;
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: this.scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        page.render(renderContext);
      }).catch((error: any) => {
        this.error = `Failed to render page ${pageNum}: ${error.message}`;
      });
    });
  }

  // Zoom methods
  zoomIn() {
    this.scale += 0.1;
    this.updateImagesScale();
    this.renderAllPages();
  }

  zoomOut() {
    if (this.scale <= 0.3) return;
    this.scale -= 0.1;
    this.updateImagesScale();
    this.renderAllPages();
  }

  resetZoom() {
    this.scale = 1.0;
    this.updateImagesScale();
    this.renderAllPages();
  }

  private updateImagesScale() {
    // Update image positions and sizes based on new scale
    this.draggableImages.forEach(img => {
      // You might want to implement more sophisticated scaling logic here
    });
  }

  retry() {
    this.error = '';
    this.isLoaded = false;
    this.loadPdf();
  }

  // Signature functionality
  addInitial() {
    this.addImage('assets/initial.png');
  }

  addSignature() {
    this.addImage('assets/signature.png');
  }

  private addImage(src: string) {
    const newImage: DraggableImage = {
      id: `img_${this.imageIdCounter++}`,
      src: src,
      x: 50,
      y: 50,
      width: 120,
      height: 60,
      pageIndex: 0, // Add to first page by default
      isDragging: false,
      isResizing: false
    };
    this.draggableImages.push(newImage);
  }

  // Touch/Mouse event handlers
  onImageMouseDown(event: MouseEvent | TouchEvent, image: DraggableImage) {
    event.preventDefault();
    event.stopPropagation();

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    // Check if clicking on resize handle (bottom-right corner)
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isResizeHandle = (clientX > rect.right - 20) && (clientY > rect.bottom - 20);

    if (isResizeHandle) {
      image.isResizing = true;
      this.currentDragImage = image;
    } else {
      image.isDragging = true;
      this.currentDragImage = image;
      this.dragOffset.x = clientX - rect.left;
      this.dragOffset.y = clientY - rect.top;
    }

    // Add global listeners
    if (event instanceof MouseEvent) {
      document.addEventListener('mousemove', this.onGlobalMouseMove);
      document.addEventListener('mouseup', this.onGlobalMouseUp);
    } else {
      document.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', this.onGlobalTouchEnd);
    }
  }

  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.currentDragImage) {
      this.updateImagePosition(event.clientX, event.clientY);
    }
  }

  private onGlobalTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    if (this.currentDragImage) {
      this.updateImagePosition(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  private updateImagePosition(clientX: number, clientY: number) {
    if (!this.currentDragImage) return;

    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
    const containerRect = canvasContainer.getBoundingClientRect();

    if (this.currentDragImage.isResizing) {
      // Handle resizing
      const newWidth = Math.max(30, clientX - (containerRect.left + this.currentDragImage.x));
      const newHeight = Math.max(20, clientY - (containerRect.top + this.currentDragImage.y));
      this.currentDragImage.width = newWidth;
      this.currentDragImage.height = newHeight;
    } else if (this.currentDragImage.isDragging) {
      // Handle dragging
      this.currentDragImage.x = clientX - containerRect.left - this.dragOffset.x;
      this.currentDragImage.y = clientY - containerRect.top - this.dragOffset.y;

      // Keep within bounds
      this.currentDragImage.x = Math.max(0, Math.min(this.currentDragImage.x, containerRect.width - this.currentDragImage.width));
      this.currentDragImage.y = Math.max(0, Math.min(this.currentDragImage.y, containerRect.height - this.currentDragImage.height));
    }
  }

  private onGlobalMouseUp = () => {
    this.resetDragState();
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
  }

  private onGlobalTouchEnd = () => {
    this.resetDragState();
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  }

  private resetDragState() {
    if (this.currentDragImage) {
      this.currentDragImage.isDragging = false;
      this.currentDragImage.isResizing = false;
      this.currentDragImage = null;
    }
  }

  removeImage(image: DraggableImage) {
    const index = this.draggableImages.indexOf(image);
    if (index > -1) {
      this.draggableImages.splice(index, 1);
    }
  }

  clearAllImages() {
    this.draggableImages = [];
  }
}
