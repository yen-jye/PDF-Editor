import { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Annotation, Whiteout, FONT_OPTIONS, ImageAnnotation } from '../types';
import Draggable from 'react-draggable';
import { Trash2, GripHorizontal, Move, Image as ImageIcon, FlipHorizontal, FlipVertical, Wand2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';

// Add some custom styling to make the resize handles more visible
const customStyles = `
  .react-resizable-handle {
    background-color: white !important;
    border: 1px solid #94a3b8 !important;
    border-radius: 50%;
    width: 10px !important;
    height: 10px !important;
    padding: 0 !important;
    background-image: none !important;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .group:hover .react-resizable-handle {
    opacity: 1;
  }
  .react-resizable-handle-se {
    bottom: -5px !important;
    right: -5px !important;
    cursor: se-resize;
  }
  .react-resizable-handle-e {
    top: 50% !important;
    right: -5px !important;
    margin-top: -5px;
    cursor: e-resize;
  }
  .react-resizable-handle-s {
    bottom: -5px !important;
    left: 50% !important;
    margin-left: -5px;
    cursor: s-resize;
  }
`;

interface PdfEditorProps {
  file: File;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  whiteouts: Whiteout[];
  setWhiteouts: React.Dispatch<React.SetStateAction<Whiteout[]>>;
  imageAnnotations: ImageAnnotation[];
  setImageAnnotations: React.Dispatch<React.SetStateAction<ImageAnnotation[]>>;
  updateAnnotationPosition: (id: string, dx: number, dy: number) => void;
  updateImageDataUrl: (id: string, dataUrl: string) => void;
}

export default function PdfEditor({ 
  file, annotations, setAnnotations, whiteouts, setWhiteouts, 
  imageAnnotations, setImageAnnotations, updateAnnotationPosition, updateImageDataUrl 
}: PdfEditorProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Default to a smaller scale on mobile (e.g. max width of 100vw), or simply use 1.0/1.5
  const [scale, setScale] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 0.75 : 1.25);

  const handleZoomIn = () => setScale(s => Math.min(3.0, s + 0.25));
  const handleZoomOut = () => setScale(s => Math.max(0.25, s - 0.25));
  const handleZoomReset = () => setScale(typeof window !== 'undefined' && window.innerWidth < 768 ? 0.75 : 1.25);

  const loadPdf = async (pwd?: string) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(arrayBuffer),
        password: pwd
      });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPasswordNeeded(false);
      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      if (error.name === 'PasswordException') {
        setPasswordNeeded(true);
        if (pwd) {
          setErrorMsg('비밀번호가 올바르지 않습니다.');
        }
      } else {
        setErrorMsg('PDF를 불러오는 중 오류가 발생했습니다: ' + error.message);
        console.error(error);
      }
    }
  };

  useEffect(() => {
    setPdfDoc(null);
    setPasswordNeeded(false);
    setPassword('');
    setErrorMsg('');
    loadPdf();
  }, [file]);

  if (passwordNeeded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">암호화된 PDF입니다</h2>
          <p className="text-slate-500 mb-6 text-sm">문서를 열려면 비밀번호를 입력해주세요.</p>
          
          <form onSubmit={(e) => { e.preventDefault(); loadPdf(password); }} className="flex flex-col gap-4">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {errorMsg && <p className="text-red-500 text-sm text-left">{errorMsg}</p>}
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (errorMsg && !passwordNeeded) {
    return <div className="flex-1 flex items-center justify-center bg-gray-50"><p className="text-red-500">{errorMsg}</p></div>;
  }

  if (isLoading || !pdfDoc) {
    return <div className="flex-1 flex items-center justify-center bg-gray-50"><p className="text-gray-500 animate-pulse">Loading PDF...</p></div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-100 p-2 md:p-8 relative">
      <style>{customStyles}</style>
      
      {/* Zoom Controls */}
      <div className="sticky top-0 right-0 z-50 flex justify-end p-2 md:p-4 mb-[-40px] md:mb-[-60px] pointer-events-none">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-1 flex items-center gap-1 pointer-events-auto">
          <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="축소">
            <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button onClick={handleZoomReset} className="px-2 md:px-3 text-xs md:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg h-full transition-colors" title="기본 크기">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="확대">
            <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-8 w-max mx-auto mt-4 md:mt-8">
        {Array.from({ length: numPages }, (_, index) => (
          <PdfPage 
            key={index} 
            pageIndex={index} 
            pdfDoc={pdfDoc} 
            scale={scale}
            annotations={annotations.filter(a => a.pageIndex === index)}
            setAnnotations={setAnnotations}
            whiteouts={whiteouts.filter(w => w.pageIndex === index)}
            setWhiteouts={setWhiteouts}
            imageAnnotations={imageAnnotations.filter(i => i.pageIndex === index)}
            setImageAnnotations={setImageAnnotations}
            updateAnnotationPosition={updateAnnotationPosition}
            updateImageDataUrl={updateImageDataUrl}
          />
        ))}
      </div>
    </div>
  );
}

interface PdfPageProps {
  pageIndex: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  scale: number;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  whiteouts: Whiteout[];
  setWhiteouts: React.Dispatch<React.SetStateAction<Whiteout[]>>;
  imageAnnotations: ImageAnnotation[];
  setImageAnnotations: React.Dispatch<React.SetStateAction<ImageAnnotation[]>>;
  updateAnnotationPosition: (id: string, dx: number, dy: number) => void;
  updateImageDataUrl: (id: string, dataUrl: string) => void;
}

interface DraggableAnnotationProps {
  ann: Annotation;
  pageDimensions: { width: number; height: number };
  scale: number;
  onDragStop: (id: string, e: any, data: any) => void;
  updateAnnotationText: (id: string, newText: string) => void;
  updateAnnotationFontFamily: (id: string, newFontFamily: string) => void;
  updateAnnotationFontWeight: (id: string, newFontWeight: string) => void;
  updateAnnotationFontSize: (id: string, newFontSize: number) => void;
  updateAnnotationColor: (id: string, newColor: string) => void;
  updateAnnotationPosition: (id: string, dx: number, dy: number) => void;
  removeAnnotation: (id: string) => void;
}

function DraggableAnnotation({ 
  ann, pageDimensions, scale, onDragStop, updateAnnotationText, 
  updateAnnotationFontFamily, updateAnnotationFontWeight, 
  updateAnnotationFontSize, updateAnnotationColor,
  updateAnnotationPosition, removeAnnotation 
}: DraggableAnnotationProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const isBold = ann.fontWeight === 'bold';
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) {
       const stepPx = e.shiftKey ? 10 : 1;
       let dx = 0, dy = 0;
       if (e.key === 'ArrowUp') dy = -stepPx;
       if (e.key === 'ArrowDown') dy = stepPx;
       if (e.key === 'ArrowLeft') dx = -stepPx;
       if (e.key === 'ArrowRight') dx = stepPx;
       
       if (dx !== 0 || dy !== 0) {
         e.preventDefault();
         updateAnnotationPosition(ann.id, dx / pageDimensions.width, dy / pageDimensions.height);
       }
    }
  };

  const nudge = (dxPx: number, dyPx: number) => {
    updateAnnotationPosition(ann.id, dxPx / pageDimensions.width, dyPx / pageDimensions.height);
  };
  
  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      position={{ x: ann.x * pageDimensions.width, y: ann.y * pageDimensions.height }}
      onStop={(e, data) => onDragStop(ann.id, e, data)}
      handle=".drag-handle"
      cancel=".no-drag, button, select, option"
    >
      <div ref={nodeRef} className="absolute top-0 left-0 group z-20 outline-none" tabIndex={-1}>
        <div className="relative pointer-events-auto outline-none">
          {/* CSS Grid trick to auto-size input to exactly fit its content */}
          <div 
            className="grid items-center drag-handle cursor-move rounded hover:bg-slate-500/10 transition-colors" 
            style={{ 
              fontSize: `${ann.fontSize * scale}px`, 
              fontFamily: ann.fontFamily || 'sans-serif',
              fontWeight: ann.fontWeight || 'normal',
              textShadow: isBold ? '0.2px 0 0 currentColor, -0.2px 0 0 currentColor' : 'none',
              lineHeight: 1.1,
              padding: '8px',
              margin: '-8px'
            }}
          >
            <span 
              className="invisible whitespace-pre"
              style={{ gridArea: '1 / 1', padding: '0', minWidth: '50px' }}
            >
              {ann.text || '텍스트 입력'}
            </span>
            <input
              type="text"
              autoFocus
              className="bg-transparent outline-none ring-0 whitespace-pre w-full h-full cursor-text no-drag"
              style={{ 
                gridArea: '1 / 1',
                padding: '0',
                margin: 0,
                color: ann.color,
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                outline: 'none'
              }}
              value={ann.text}
              onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="텍스트 입력"
            />
          </div>
          {/* Virtual border that doesn't affect flow/layout */}
          <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500 group-focus-within:border-blue-500 rounded -m-[2px] pointer-events-none transition-colors"></div>
          
          <div className="absolute -top-12 left-0 bg-white shadow-lg border border-slate-200 rounded-lg px-2 py-1.5 flex gap-1.5 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10 pointer-events-auto w-max">
            <div 
              className="drag-handle cursor-grab active:cursor-grabbing p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors outline-none"
              title="마우스로 끌어서 이동 (방향키 미세조정: Alt+방향키)"
            >
              <Move size={14} />
            </div>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <select 
              className="text-xs border border-slate-200 rounded px-1 py-1 outline-none bg-slate-50 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-0 transition-colors"
              value={FONT_OPTIONS.find(f => ann.fontFamily?.includes(f.value.split(',')[0].replace(/'/g, '')))?.value || FONT_OPTIONS[0].value}
              onChange={(e) => updateAnnotationFontFamily(ann.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {FONT_OPTIONS.map(font => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
            
            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <button
              className={`p-1 rounded text-xs font-bold w-6 h-6 flex items-center justify-center transition-colors ${isBold ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
              onClick={() => updateAnnotationFontWeight(ann.id, isBold ? '500' : 'bold')}
              onPointerDown={(e) => e.stopPropagation()}
              title="굵게 (B)"
            >
              B
            </button>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors">
              <button 
                className="px-1.5 py-1 text-slate-600 hover:text-blue-600 font-medium"
                onClick={() => updateAnnotationFontSize(ann.id, Math.max(8, ann.fontSize - 1))}
                onPointerDown={(e) => e.stopPropagation()}
                title="글자 크기 작게"
              >
                -
              </button>
              <input 
                type="number" 
                className="w-10 text-xs text-center bg-transparent border-none outline-none hide-spin-button"
                value={Math.round(ann.fontSize)}
                onChange={(e) => updateAnnotationFontSize(ann.id, Number(e.target.value))}
                onPointerDown={(e) => e.stopPropagation()}
                title="글자 크기 (직접 입력)"
              />
              <button 
                className="px-1.5 py-1 text-slate-600 hover:text-blue-600 font-medium"
                onClick={() => updateAnnotationFontSize(ann.id, ann.fontSize + 1)}
                onPointerDown={(e) => e.stopPropagation()}
                title="글자 크기 크게"
              >
                +
              </button>
            </div>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <div className="relative flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 overflow-hidden shadow-sm hover:scale-110 transition-transform cursor-pointer" title="글자 색상">
              <input 
                type="color"
                className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] cursor-pointer border-none p-0 bg-transparent"
                value={ann.color}
                onChange={(e) => updateAnnotationColor(ann.id, e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <button 
            className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto"
            onClick={() => removeAnnotation(ann.id)}
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking delete
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </Draggable>
  );
}

interface DraggableImageProps {
  ann: ImageAnnotation;
  pageDimensions: { width: number; height: number };
  onDragStop: (id: string, e: any, data: any) => void;
  updateImageSize: (id: string, newWidthPct: number, newHeightPct: number) => void;
  updateImageDataUrl: (id: string, dataUrl: string) => void;
  removeImageAnnotation: (id: string) => void;
}

function DraggableImage({ ann, pageDimensions, onDragStop, updateImageSize, updateImageDataUrl, removeImageAnnotation }: DraggableImageProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  const pixelWidth = ann.width * pageDimensions.width;
  const pixelHeight = ann.height * pageDimensions.height;

  const onResize = (e: React.SyntheticEvent, { size }: { size: { width: number, height: number } }) => {
    e.stopPropagation();
    updateImageSize(ann.id, size.width / pageDimensions.width, size.height / pageDimensions.height);
  };

  const processImage = (action: 'flipH' | 'flipV' | 'invert') => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (action === 'flipH') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      } else if (action === 'flipV') {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      } else if (action === 'invert') {
        ctx.filter = 'invert(100%)';
      }

      ctx.drawImage(img, 0, 0);
      updateImageDataUrl(ann.id, canvas.toDataURL('image/png'));
    };
    img.src = ann.dataUrl;
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      position={{ x: ann.x * pageDimensions.width, y: ann.y * pageDimensions.height }}
      onStop={(e, data) => onDragStop(ann.id, e, data)}
      handle=".drag-handle"
      cancel=".no-drag, button, select, option"
    >
      <div ref={nodeRef} className="absolute top-0 left-0 group z-20 outline-none" tabIndex={-1}>
        <div className="relative pointer-events-auto outline-none">
          <ResizableBox 
            width={pixelWidth} 
            height={pixelHeight} 
            onResize={onResize}
            minConstraints={[20, 20]}
            maxConstraints={[pageDimensions.width, pageDimensions.height]}
            resizeHandles={['se', 'e', 's']}
            className="box-border"
          >
            <div className="w-full h-full relative drag-handle cursor-move" style={{ width: pixelWidth, height: pixelHeight }}>
              <img 
                src={ann.dataUrl} 
                alt="annotation" 
                className="w-full h-full object-fill pointer-events-none" 
              />
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500 rounded -m-[2px] pointer-events-none transition-colors"></div>
            </div>
          </ResizableBox>

          <div className="absolute -top-12 left-0 bg-white shadow-lg border border-slate-200 rounded-lg px-2 py-1.5 flex gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto w-max">
            <div 
              className="drag-handle cursor-grab active:cursor-grabbing p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors outline-none"
              title="마우스로 끌어서 이동"
            >
              <Move size={14} />
            </div>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <div className="flex items-center gap-1 text-xs text-slate-500">
              <input 
                type="number"
                className="w-12 border border-slate-200 rounded px-1 text-center outline-none focus:border-blue-400"
                value={Math.round(pixelWidth)}
                onChange={(e) => updateImageSize(ann.id, Number(e.target.value) / pageDimensions.width, ann.height)}
                onPointerDown={(e) => e.stopPropagation()}
                title="너비 (px)"
              />
              <span>x</span>
              <input 
                type="number"
                className="w-12 border border-slate-200 rounded px-1 text-center outline-none focus:border-blue-400"
                value={Math.round(pixelHeight)}
                onChange={(e) => updateImageSize(ann.id, ann.width, Number(e.target.value) / pageDimensions.height)}
                onPointerDown={(e) => e.stopPropagation()}
                title="높이 (px)"
              />
            </div>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <button
              className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => processImage('flipH')}
              onPointerDown={(e) => e.stopPropagation()}
              title="좌우 반전"
            >
              <FlipHorizontal size={14} />
            </button>
            <button
              className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => processImage('flipV')}
              onPointerDown={(e) => e.stopPropagation()}
              title="상하 반전"
            >
              <FlipVertical size={14} />
            </button>
            <button
              className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => processImage('invert')}
              onPointerDown={(e) => e.stopPropagation()}
              title="색상 반전"
            >
              <Wand2 size={14} />
            </button>
          </div>

          <button 
            className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto"
            onClick={() => removeImageAnnotation(ann.id)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </Draggable>
  );
}

function PdfPage({ 
  pageIndex, pdfDoc, scale, annotations, setAnnotations, whiteouts, setWhiteouts, 
  imageAnnotations, setImageAnnotations, updateAnnotationPosition, updateImageDataUrl
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [textItems, setTextItems] = useState<any[]>([]);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    let page: pdfjsLib.PDFPageProxy;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        page = await pdfDoc.getPage(pageIndex + 1);
        if (isCancelled) return;
        
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        setPageDimensions({ width: viewport.width, height: viewport.height });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        if (isCancelled) return;

        const textContent = await page.getTextContent();
        if (isCancelled) return;
        
        const items = textContent.items.filter((i: any) => i.str.trim() !== '').map((item: any) => {
          // get the bounding box in canvas coordinates
          // item.transform is [scaleX, skewY, skewX, scaleY, tx, ty]
          const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const fontSize = Math.abs(item.transform[3]) * viewport.scale;
          const width = item.width * viewport.scale;
          
          let color = '#000000';
          if (item.color && item.color.length >= 3) {
            const rgb = item.color;
            color = `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
          }

          let rawFontFamily = 'sans-serif';
          let fontNameLower = (item.fontName || '').toLowerCase();
          if (item.fontName && textContent.styles[item.fontName]) {
            rawFontFamily = (textContent.styles[item.fontName].fontFamily || 'sans-serif').toLowerCase();
          }

          let mappedValue = FONT_OPTIONS[0].value; // Default Noto Sans
          if (rawFontFamily.includes('myeongjo') || rawFontFamily.includes('명조') || rawFontFamily.includes('serif') || rawFontFamily.includes('myungjo')) {
             mappedValue = FONT_OPTIONS[1].value; // Noto Serif
          } else if (rawFontFamily.includes('batang') || rawFontFamily.includes('바탕')) {
             mappedValue = FONT_OPTIONS[2].value;
          } else if (rawFontFamily.includes('dotum') || rawFontFamily.includes('돋움')) {
             mappedValue = FONT_OPTIONS[3].value;
          } else if (rawFontFamily.includes('gulim') || rawFontFamily.includes('굴림')) {
             mappedValue = FONT_OPTIONS[4].value;
          } else if (rawFontFamily.includes('gungsuh') || rawFontFamily.includes('궁서')) {
             mappedValue = FONT_OPTIONS[5].value;
          } else if (rawFontFamily.includes('malgun') || rawFontFamily.includes('맑은')) {
             mappedValue = FONT_OPTIONS[6].value;
          } else if (rawFontFamily.includes('times')) {
             mappedValue = FONT_OPTIONS[1].value;
          }

          let isBold = false;
          let isThin = false;
          const styleStr = item.fontName && textContent.styles[item.fontName] ? JSON.stringify(textContent.styles[item.fontName]).toLowerCase() : '';

          if (fontNameLower.includes('bold') || fontNameLower.includes('bld') || fontNameLower.includes('bd') || styleStr.includes('bold') || styleStr.includes('black') || styleStr.includes('heavy') || styleStr.includes('w700') || styleStr.includes('w800')) {
            isBold = true;
          } else if (fontNameLower.includes('thin') || fontNameLower.includes('light') || fontNameLower.includes('lt') || styleStr.includes('thin') || styleStr.includes('light') || styleStr.includes('w300') || styleStr.includes('w200') || styleStr.includes('w100')) {
            isThin = true;
          }
          
          return {
            id: crypto.randomUUID(),
            str: item.str,
            x: x / viewport.width,
            // pdf ty is baseline, so y in canvas is baseline. We approximate top by subtracting fontSize
            y: (y - (fontSize * 0.8)) / viewport.height, // adjusted from fontSize to fontSize * 0.8 to better match the visual top
            width: width / viewport.width,
            height: (fontSize * 1.3) / viewport.height, // adjusted from 1.2 to 1.3 to ensure it covers
            rawX: item.transform[4] / (viewport.width / viewport.scale),
            rawY: item.transform[5] / (viewport.height / viewport.scale),
            fontSize: Math.abs(item.transform[3]),
            color: color,
            fontFamily: mappedValue,
            fontWeight: isBold ? 'bold' : isThin ? 'normal' : '500'
          };
        });
        setTextItems(items);
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Failed to extract text content or render page", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pageIndex, pdfDoc]);

  const handleTextClick = (item: any) => {
    // Attempt to sample background color from the canvas
    let bgColor = '#ffffff';
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Sample a pixel just above the text bounding box (usually background color)
        // item x, y are percentages. 
        const px = Math.max(0, (item.x * canvas.width) - 2);
        const py = Math.max(0, (item.y * canvas.height) - 4);
        
        try {
          const pixelData = ctx.getImageData(px, py, 1, 1).data;
          // Ensure it's not fully transparent
          if (pixelData[3] > 0) {
            bgColor = `#${pixelData[0].toString(16).padStart(2, '0')}${pixelData[1].toString(16).padStart(2, '0')}${pixelData[2].toString(16).padStart(2, '0')}`;
          }
        } catch (e) {
          // Ignore canvas taint errors if any
          console.error("Could not sample canvas color", e);
        }
      }
    }

    // Hide the original text
    const newWhiteout: Whiteout = {
      id: item.id,
      pageIndex,
      x: item.x - (item.width * 0.02), // Expand slightly left
      y: item.y - (item.height * 0.1), // Move up to cover ascenders
      width: item.width * 1.04, // Make slightly wider
      height: item.height * 1.3, // Make much taller to cover everything
      color: bgColor
    };
    
    // Create an editable annotation on top
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      pageIndex,
      text: item.str,
      x: item.x,
      y: item.y, // Removed padding offset for exact match
      fontSize: item.fontSize,
      color: item.color || '#000000',
      fontFamily: item.fontFamily || FONT_OPTIONS[0].value,
      fontWeight: item.fontWeight || 'normal'
    };

    setWhiteouts(prev => [...prev, newWhiteout]);
    setAnnotations(prev => [...prev, newAnnotation]);
    // Remove the item from clickable text overlay so it doesn't get clicked again
    setTextItems(prev => prev.filter(t => t.id !== item.id));
  };

  const updateAnnotationText = (id: string, newText: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text: newText } : a));
  };

  const updateAnnotationFontFamily = (id: string, newFontFamily: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, fontFamily: newFontFamily } : a));
  };

  const updateAnnotationFontWeight = (id: string, newFontWeight: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, fontWeight: newFontWeight } : a));
  };

  const updateAnnotationFontSize = (id: string, newFontSize: number) => {
    if (isNaN(newFontSize) || newFontSize <= 0) return;
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, fontSize: newFontSize } : a));
  };

  const updateAnnotationColor = (id: string, newColor: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, color: newColor } : a));
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const onDragStop = (id: string, e: any, data: any) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    
    setAnnotations(prev => prev.map(a => {
      if (a.id === id) {
        // Calculate new percentage based on the dragged pixel position
        // react-draggable provides x and y in pixels relative to its bounds if we use bounded
        // Actually, let's use the delta to update percentage safely, or rely on absolute position
        return {
          ...a,
          x: Math.max(0, Math.min(1, data.x / width)),
          y: Math.max(0, Math.min(1, data.y / height))
        };
      }
      return a;
    }));
  };

  const onImageDragStop = (id: string, e: any, data: any) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setImageAnnotations(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          x: Math.max(0, Math.min(1, data.x / width)),
          y: Math.max(0, Math.min(1, data.y / height))
        };
      }
      return a;
    }));
  };

  const updateImageSize = (id: string, newWidthPct: number, newHeightPct: number) => {
    setImageAnnotations(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, width: newWidthPct, height: newHeightPct };
      }
      return a;
    }));
  };

  const removeImageAnnotation = (id: string) => {
    setImageAnnotations(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div 
      ref={containerRef} 
      className="relative shadow-lg bg-white overflow-hidden" 
      style={{ width: pageDimensions.width || 'auto', height: pageDimensions.height || 'auto' }}
    >
      <canvas ref={canvasRef} className="block" />
      
      {/* Whiteouts (visual only, for the UI) */}
      {pageDimensions.width > 0 && whiteouts.map(w => (
        <div 
          key={w.id}
          className="absolute"
          style={{
            backgroundColor: w.color || '#ffffff',
            left: `${w.x * 100}%`,
            top: `${w.y * 100}%`,
            width: `${w.width * 100}%`,
            height: `${w.height * 100}%`,
          }}
        />
      ))}

      {/* Clickable text overlays */}
      {pageDimensions.width > 0 && textItems.map(item => (
        <div
          key={item.id}
          className="absolute cursor-pointer border border-transparent hover:border-blue-400 hover:bg-blue-100/30 transition-colors z-10"
          style={{
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            width: `${item.width * 100}%`,
            height: `${item.height * 100}%`,
          }}
          onClick={() => handleTextClick(item)}
          title="클릭하여 텍스트 편집"
        />
      ))}

      {/* Existing user annotations */}
      {pageDimensions.width > 0 && annotations.map(ann => (
        <DraggableAnnotation
          key={ann.id}
          ann={ann}
          pageDimensions={pageDimensions}
          scale={scale}
          onDragStop={onDragStop}
          updateAnnotationText={updateAnnotationText}
          updateAnnotationFontFamily={updateAnnotationFontFamily}
          updateAnnotationFontWeight={updateAnnotationFontWeight}
          updateAnnotationFontSize={updateAnnotationFontSize}
          updateAnnotationColor={updateAnnotationColor}
          updateAnnotationPosition={updateAnnotationPosition}
          removeAnnotation={removeAnnotation}
        />
      ))}

      {/* Image annotations */}
      {pageDimensions.width > 0 && imageAnnotations.map(ann => (
        <DraggableImage
          key={ann.id}
          ann={ann}
          pageDimensions={pageDimensions}
          onDragStop={onImageDragStop}
          updateImageSize={updateImageSize}
          updateImageDataUrl={updateImageDataUrl}
          removeImageAnnotation={removeImageAnnotation}
        />
      ))}
    </div>
  );
}
