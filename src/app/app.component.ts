import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {NgIf} from "@angular/common";
import {FormsModule} from "@angular/forms";

declare const pdfjsLib: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    NgIf,
    FormsModule
  ],
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('pdfCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  title = 'pdf-viewer-app';

  // PDF properties
  pdfDoc: any = null;
  pageNum = 1;
  totalPages = 0;
  pageRendering = false;
  pageNumPending: number | null = null;
  scale = 1.0;
  isLoaded = false;
  error = '';

  pdfUrl = 'assets/test2.pdf';

  ngOnInit() {
    this.loadPdfJs().then(() => {
      this.loadPdf();
    }).catch(err => {
      this.error = 'Failed to load PDF.js librarys';
      console.error('PDF.js loading error:', err);
    });
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
        // Set worker source
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
      this.isLoaded = true;

      // Render the first page
      this.renderPage(this.pageNum);

    } catch (error: any) {
      this.error = `Failed to load PDF: ${error.message}`;
      console.error('PDF loading error:', error);
    }
  }

  private renderPage(num: number) {
    this.pageRendering = true;

    // Get page
    this.pdfDoc.getPage(num).then((page: any) => {
      const canvas = this.canvasRef.nativeElement;
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: this.scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);

      // Wait for rendering to finish
      renderTask.promise.then(() => {
        this.pageRendering = false;
        if (this.pageNumPending !== null) {
          // New page rendering is pending
          this.renderPage(this.pageNumPending);
          this.pageNumPending = null;
        }
      }).catch((error: any) => {
        this.pageRendering = false;
        this.error = `Failed to render page: ${error.message}`;
      });
    }).catch((error: any) => {
      this.pageRendering = false;
      this.error = `Failed to get page: ${error.message}`;
    });
  }

  private queueRenderPage(num: number) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPage(num);
    }
  }

  // Navigation methods
  previousPage() {
    if (this.pageNum <= 1) {
      return;
    }
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  nextPage() {
    if (this.pageNum >= this.totalPages) {
      return;
    }
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  // Zoom methods
  zoomIn() {
    this.scale += 0.1;
    this.queueRenderPage(this.pageNum);
  }

  zoomOut() {
    if (this.scale <= 0.3) {
      return;
    }
    this.scale -= 0.1;
    this.queueRenderPage(this.pageNum);
  }

  resetZoom() {
    this.scale = 1.0;
    this.queueRenderPage(this.pageNum);
  }

  // Go to specific page
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.pageNum = page;
    this.queueRenderPage(this.pageNum);
  }

  retry() {
    this.error = '';
    this.isLoaded = false;
    this.loadPdf();
  }
}
