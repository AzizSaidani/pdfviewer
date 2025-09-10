import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  isSelected: boolean;
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

  pdfDoc: any = null;
  totalPages = 0;
  isLoaded = false;
  error = '';
  pages: number[] = [];
  pdfUrl = 'assets/test2.pdf';

  draggableImages: DraggableImage[] = [];
  private dragOffset = { x: 0, y: 0 };
  private currentDragImage: DraggableImage | null = null;
  private imageIdCounter = 0;

  ngOnInit() {
    this.loadPdfJs().then(() => this.loadPdf())
      .catch(err => {
        this.error = 'Failed to load PDF.js library';
        console.error('PDF.js loading error:', err);
      });

    this.setupTouchEvents();
    this.setupGlobalClickListener();
  }

  private setupTouchEvents() {
    document.addEventListener('touchmove', e => {
      if (this.currentDragImage) e.preventDefault();
    }, { passive: false });
  }

  private setupGlobalClickListener() {
    document.addEventListener('click', (event) => this.handleGlobalClick(event));
    document.addEventListener('touchend', (event) => this.handleGlobalClick(event));
  }

  private handleGlobalClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.closest('.draggable-image') || target.closest('.toolbar') || this.currentDragImage) return;
    this.draggableImages.forEach(img => img.isSelected = false);
  }

  private loadPdfJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') return resolve();

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
      setTimeout(() => this.renderAllPages(), 0);
    } catch (error: any) {
      this.error = `Failed to load PDF: ${error.message}`;
    }
  }

  private renderAllPages() {
    this.pages.forEach((pageNum, index) => {
      this.pdfDoc.getPage(pageNum).then((page: any) => {
        const canvas = this.canvasRefs.toArray()[index].nativeElement;
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({ canvasContext: ctx, viewport });
      });
    });
  }

  retry() {
    this.error = '';
    this.isLoaded = false;
    this.loadPdf();
  }

  addInitial() { this.addImage('assets/initial.png'); }
  addSignature() { this.addImage('assets/signature.png'); }

  private addImage(src: string) {
    this.draggableImages.forEach(img => img.isSelected = false);

    const container = document.querySelector('.canvas-container') as HTMLElement;

    const visiblePageIndex = this.canvasRefs.toArray().findIndex(canvasRef => {
      const rect = canvasRef.nativeElement.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });

    const pageIndex = visiblePageIndex >= 0 ? visiblePageIndex : 0;
    const pageCanvas = this.canvasRefs.toArray()[pageIndex].nativeElement;
    const pageRect = pageCanvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate position relative to container
    const centerX = pageRect.left - containerRect.left + pageCanvas.width / 2;
    const centerY = pageRect.top - containerRect.top + pageCanvas.height / 2;

    const newImage: DraggableImage = {
      id: `img_${this.imageIdCounter++}`,
      src,
      x: centerX - 60,
      y: centerY - 30,
      width: 120,
      height: 60,
      pageIndex,
      isDragging: false,
      isResizing: false,
      isSelected: true
    };

    this.draggableImages.push(newImage);

    setTimeout(() => {
      container.scrollTo({
        top: newImage.y - container.clientHeight / 2 + newImage.height / 2,
        behavior: 'smooth'
      });
    }, 0);
  }

  onImageMouseDown(event: MouseEvent | TouchEvent, image: DraggableImage) {
    event.preventDefault();
    event.stopPropagation();
    this.selectImage(image);

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isResizeHandle = (clientX > rect.right - 20) && (clientY > rect.bottom - 20);

    if (isResizeHandle) {
      image.isResizing = true;
    } else {
      image.isDragging = true;
      const container = document.querySelector('.canvas-container') as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      this.dragOffset.x = clientX - (containerRect.left + image.x);
      this.dragOffset.y = clientY - (containerRect.top + image.y);
    }
    this.currentDragImage = image;

    if (event instanceof MouseEvent) {
      document.addEventListener('mousemove', this.onGlobalMouseMove);
      document.addEventListener('mouseup', this.onGlobalMouseUp);
    } else {
      document.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', this.onGlobalTouchEnd);
    }
  }

  private selectImage(image: DraggableImage) {
    this.draggableImages.forEach(img => img.isSelected = false);
    image.isSelected = true;
  }

  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.currentDragImage) this.updateImagePosition(event.clientX, event.clientY);
  };

  private onGlobalTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    if (this.currentDragImage)
      this.updateImagePosition(event.touches[0].clientX, event.touches[0].clientY);
  };

  private updateImagePosition(clientX: number, clientY: number) {
    if (!this.currentDragImage) return;

    const container = document.querySelector('.canvas-container') as HTMLElement;
    const containerRect = container.getBoundingClientRect();

    if (this.currentDragImage.isResizing) {
      this.currentDragImage.width = Math.max(30, clientX - (containerRect.left + this.currentDragImage.x));
      this.currentDragImage.height = Math.max(20, clientY - (containerRect.top + this.currentDragImage.y));
    } else if (this.currentDragImage.isDragging) {
      this.currentDragImage.x = clientX - containerRect.left - this.dragOffset.x;
      this.currentDragImage.y = clientY - containerRect.top - this.dragOffset.y;
    }
  }

  private onGlobalMouseUp = () => {
    this.resetDragState();
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
  };

  private onGlobalTouchEnd = () => {
    this.resetDragState();
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  };

  private resetDragState() {
    if (this.currentDragImage) {
      this.currentDragImage.isDragging = false;
      this.currentDragImage.isResizing = false;
      this.currentDragImage = null;
    }
  }

  removeImage(image: DraggableImage) {
    this.draggableImages = this.draggableImages.filter(img => img !== image);
  }

  clearAllImages() {
    this.draggableImages = [];
  }
}
