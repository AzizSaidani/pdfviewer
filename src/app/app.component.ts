import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import {NgForOf, NgIf} from "@angular/common";
import { FormsModule } from "@angular/forms";

declare const pdfjsLib: any;

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

  pages: number[] = []; // list of page numbers to render
  pdfUrl = 'assets/test2.pdf';

  ngOnInit() {
    this.loadPdfJs().then(() => {
      this.loadPdf();
    }).catch(err => {
      this.error = 'Failed to load PDF.js library';
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

      // wait for canvases to appear then render
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
    this.renderAllPages();
  }

  zoomOut() {
    if (this.scale <= 0.3) return;
    this.scale -= 0.1;
    this.renderAllPages();
  }

  resetZoom() {
    this.scale = 1.0;
    this.renderAllPages();
  }

  retry() {
    this.error = '';
    this.isLoaded = false;
    this.loadPdf();
  }
}
