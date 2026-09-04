import * as pdfjsLib from 'pdfjs-dist';

// Mock test to check methods on viewport
const page = {
  getViewport: (options: any) => {
    // Just a stub, can't easily test without a real PDF
  }
}
