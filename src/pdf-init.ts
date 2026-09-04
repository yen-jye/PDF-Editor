import * as pdfjsLib from 'pdfjs-dist';

// Use unpkg to reliably load the worker script matching the exact version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const initPdf = () => console.log('PDF.js initialized', pdfjsLib.version);
