/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import PdfEditor from './components/PdfEditor';
import { Annotation, Whiteout, FONT_OPTIONS, ImageAnnotation } from './types';
import { Upload, Download, Type, FileEdit, X, FileText, Image as ImageIcon, Undo2, ShieldCheck } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import './pdf-init';

function AdBanner() {
  useEffect(() => {
    try {
      // @ts-ignore
      const adsbygoogle = window.adsbygoogle || [];
      // Only push if there's an uninitialized ad slot
      const uninitializedAds = document.querySelectorAll('ins.adsbygoogle:not([data-ad-status="unfilled"]):not([data-ad-status="done"])');
      if (uninitializedAds.length > 0) {
        adsbygoogle.push({});
      }
    } catch (e: any) {
      // Suppress the specific "already have ads" error which happens in React Strict Mode
      if (e.message && e.message.includes('already have ads')) return;
      console.error("AdSense error", e);
    }
  }, []);

  return (
    <div className="mt-4 w-full h-[250px] bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
      <ins className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%' }}
        data-ad-client="ca-pub-9679283710951418"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('edited_document');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [whiteouts, setWhiteouts] = useState<Whiteout[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotation[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Undo History Logic ---
  const [history, setHistory] = useState<{
    annotations: Annotation[];
    whiteouts: Whiteout[];
    imageAnnotations: ImageAnnotation[];
  }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoing = useRef(false);
  const isFirstRender = useRef(true);

  // Save history when annotations change
  useEffect(() => {
    // Skip saving if this change was triggered by an undo action
    if (isUndoing.current) {
      isUndoing.current = false;
      return;
    }
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setHistory(prev => {
      // If we made a new change after undoing some steps, truncate the future history
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Don't push if it's the exact same state (by reference or deep equal, but for now reference is okay since state updates usually mean new references)
      const lastState = newHistory[newHistory.length - 1];
      if (lastState && 
          lastState.annotations === annotations && 
          lastState.whiteouts === whiteouts && 
          lastState.imageAnnotations === imageAnnotations) {
        return prev;
      }

      newHistory.push({ annotations, whiteouts, imageAnnotations });
      
      // Keep only last 50 steps
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
  }, [annotations, whiteouts, imageAnnotations, historyIndex]);

  useEffect(() => {
    setHistoryIndex(prev => prev >= 49 ? 49 : prev + 1);
  }, [history]);

  const undo = () => {
    if (historyIndex > 0) {
      isUndoing.current = true;
      const newIndex = historyIndex - 1;
      const prevState = history[newIndex];
      setAnnotations(prevState.annotations);
      setWhiteouts(prevState.whiteouts);
      setImageAnnotations(prevState.imageAnnotations);
      setHistoryIndex(newIndex);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return; // Let native undo work in text inputs
        }
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);
  // --------------------------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
      setFileName(uploadedFile.name.replace(/\.pdf$/i, '') + '_edited');
      setAnnotations([]);
      setWhiteouts([]);
      setImageAnnotations([]);
      setHistory([{ annotations: [], whiteouts: [], imageAnnotations: [] }]);
      setHistoryIndex(0);
      isUndoing.current = false;
    } else if (uploadedFile) {
      alert('PDF 파일만 업로드 가능합니다.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        // We need original dimensions to maintain aspect ratio, but we can set defaults and let the editor component figure it out.
        // For simplicity, let's create an Image object to get dimensions
        const img = new Image();
        img.onload = () => {
          const newImage: ImageAnnotation = {
            id: crypto.randomUUID(),
            pageIndex: 0,
            dataUrl,
            x: 0.1,
            y: 0.1,
            width: 0.3, // default 30% of page width
            height: 0.3 * (img.height / img.width), // proportional height
          };
          setImageAnnotations([...imageAnnotations, newImage]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(uploadedFile);
    }
    // reset input
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const addTextAnnotation = () => {
    if (!file) return;
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      pageIndex: 0, // Default to first page, ideally we'd track current visible page
      text: '',
      x: 0.1, // 10% from left
      y: 0.1, // 10% from top
      fontSize: 16,
      color: '#000000',
      fontFamily: FONT_OPTIONS[0].value,
      fontWeight: '500',
    };
    setAnnotations([...annotations, newAnnotation]);
  };

  const updateAnnotationPosition = (id: string, dx: number, dy: number) => {
    setAnnotations(prev => prev.map(a => 
      a.id === id ? { ...a, x: Math.max(0, Math.min(1, a.x + dx)), y: Math.max(0, Math.min(1, a.y + dy)) } : a
    ));
  };

  const updateImageDataUrl = (id: string, dataUrl: string) => {
    setImageAnnotations(prev => prev.map(a => 
      a.id === id ? { ...a, dataUrl } : a
    ));
  };

  const exportPdf = async () => {
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      pdfDoc.registerFontkit(await import('@pdf-lib/fontkit').then(m => m.default));
      
      const { StandardFonts } = await import('pdf-lib');
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Determine which fonts we actually need based on the annotations
      const fontsToLoad = new Set<string>(); // "regular|fontValue" or "bold|fontValue"
      annotations.forEach(ann => {
        if (ann.text.trim() !== '') {
          const font = FONT_OPTIONS.find(f => ann.fontFamily?.includes(f.value.split(',')[0].replace(/'/g, ''))) || FONT_OPTIONS[0];
          const isBold = ann.fontWeight === 'bold';
          fontsToLoad.add(`${isBold ? 'bold' : 'regular'}|${font.value}`);
        }
      });

      if (fontsToLoad.size === 0) {
        fontsToLoad.add(`regular|${FONT_OPTIONS[0].value}`); // Default
      }

      // Load all required fonts
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const loadedFonts: Record<string, any> = {}; // key: "regular|value" or "bold|value"
      
      for (const fontEntry of Array.from(fontsToLoad)) {
        const [weightStr, fontValue] = fontEntry.split('|');
        const isBold = weightStr === 'bold';
        const fontConfig = FONT_OPTIONS.find(f => f.value === fontValue)!;
        
        if (fontConfig.url === 'HELVETICA') {
          loadedFonts[fontEntry] = isBold ? helveticaBoldFont : helveticaFont;
        } else {
          try {
            const fetchUrl = (isBold && fontConfig.boldUrl) ? fontConfig.boldUrl : fontConfig.url;
            const fontBytes = await fetch(fetchUrl).then(res => res.arrayBuffer());
            loadedFonts[fontEntry] = await pdfDoc.embedFont(fontBytes);
          } catch (err) {
            console.error(`Failed to load font (${weightStr}):`, fontConfig.label, err);
            // Fallback to Noto Sans KR if failed
            const fallbackKey = `${weightStr}|${FONT_OPTIONS[0].value}`;
            if (!loadedFonts[fallbackKey] && fontValue !== FONT_OPTIONS[0].value) {
               const fbUrl = (isBold && FONT_OPTIONS[0].boldUrl) ? FONT_OPTIONS[0].boldUrl : FONT_OPTIONS[0].url;
               const fbBytes = await fetch(fbUrl).then(res => res.arrayBuffer());
               loadedFonts[fallbackKey] = await pdfDoc.embedFont(fbBytes);
            }
            loadedFonts[fontEntry] = loadedFonts[fallbackKey];
          }
        }
      }

      // Check if we need a fallback for Korean characters in Helvetica
      const fallbackKoreanFont = loadedFonts[`regular|${FONT_OPTIONS[0].value}`] || (await (async () => {
         const fbBytes = await fetch(FONT_OPTIONS[0].url).then(res => res.arrayBuffer());
         const font = await pdfDoc.embedFont(fbBytes);
         loadedFonts[`regular|${FONT_OPTIONS[0].value}`] = font;
         return font;
      })());
      const fallbackKoreanFontBold = loadedFonts[`bold|${FONT_OPTIONS[0].value}`] || (await (async () => {
         const fbUrl = FONT_OPTIONS[0].boldUrl || FONT_OPTIONS[0].url;
         const fbBytes = await fetch(fbUrl).then(res => res.arrayBuffer());
         const font = await pdfDoc.embedFont(fbBytes);
         loadedFonts[`bold|${FONT_OPTIONS[0].value}`] = font;
         return font;
      })());

      whiteouts.forEach(w => {
        if (w.pageIndex < pages.length) {
          const page = pages[w.pageIndex];
          const { width, height } = page.getSize();
          
          const rectX = w.x * width;
          const rectW = w.width * width;
          const rectH = w.height * height;
          const rectY = height - (w.y * height) - rectH;

          page.drawRectangle({
            x: rectX,
            y: rectY,
            width: rectW,
            height: rectH,
            color: rgb(1, 1, 1), // White
          });
        }
      });

      annotations.forEach(ann => {
        if (ann.pageIndex < pages.length && ann.text.trim() !== '') {
          const page = pages[ann.pageIndex];
          const { width, height } = page.getSize();
          
          // Parse hex color
          const r = parseInt(ann.color.slice(1, 3), 16) / 255;
          const g = parseInt(ann.color.slice(3, 5), 16) / 255;
          const b = parseInt(ann.color.slice(5, 7), 16) / 255;

          // Note: pdf-lib (0,0) is bottom-left. 
          // Browser DOM (0,0) is top-left.
          // ann.y is percentage from top.
          const xPos = ann.x * width;
          // Calculate y pos: from bottom. We subtract fontSize to align baselines roughly
          const yPos = height - (ann.y * height) - ann.fontSize;

          const fontConfig = FONT_OPTIONS.find(f => ann.fontFamily?.includes(f.value.split(',')[0].replace(/'/g, ''))) || FONT_OPTIONS[0];
          const isBold = ann.fontWeight === 'bold';
          let fontToUse = loadedFonts[`${isBold ? 'bold' : 'regular'}|${fontConfig.value}`];

          // If Arial is chosen but user typed Korean, Helvetica will fail. Fallback to Noto Sans KR.
          if (fontConfig.url === 'HELVETICA' && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(ann.text)) {
            fontToUse = isBold ? fallbackKoreanFontBold : fallbackKoreanFont;
          }

          page.drawText(ann.text, {
            x: xPos,
            y: yPos,
            size: ann.fontSize,
            font: fontToUse || fallbackKoreanFont,
            color: rgb(r, g, b),
          });
        }
      });

      // Embed and draw images
      for (const imgAnn of imageAnnotations) {
        if (imgAnn.pageIndex < pages.length) {
          const page = pages[imgAnn.pageIndex];
          const { width, height } = page.getSize();
          
          let pdfImage;
          if (imgAnn.dataUrl.startsWith('data:image/jpeg')) {
            pdfImage = await pdfDoc.embedJpg(imgAnn.dataUrl);
          } else if (imgAnn.dataUrl.startsWith('data:image/png')) {
            pdfImage = await pdfDoc.embedPng(imgAnn.dataUrl);
          } else {
            console.warn('Unsupported image type:', imgAnn.dataUrl.substring(0, 30));
            continue;
          }

          const imgW = imgAnn.width * width;
          const imgH = imgAnn.height * height;
          const imgX = imgAnn.x * width;
          const imgY = height - (imgAnn.y * height) - imgH;

          page.drawImage(pdfImage, {
            x: imgX,
            y: imgY,
            width: imgW,
            height: imgH,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-10 gap-3 md:gap-0">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-5 w-full md:w-auto">
          <div className="flex items-center gap-2 text-blue-600">
            <FileEdit className="w-5 h-5 md:w-6 md:h-6" />
            <h1 className="text-lg md:text-xl font-bold tracking-tight">심플 PDF 에디터</h1>
          </div>
          
          <div className="hidden md:block h-5 w-px bg-slate-200"></div>

          <a 
            href="https://www.jyelabs.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
            title="JYE LABS 홈페이지 방문"
          >
            <span className="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5">POWERED BY</span>
            <div className="flex items-center">
              <span className="text-sm font-black tracking-tighter text-slate-800">JYE</span>
              <span className="text-sm font-bold tracking-tight text-blue-600">LABS</span>
            </div>
          </a>
        </div>
        
        {file && (
          <div className="flex items-stretch md:items-center gap-2 md:gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all flex-1 md:flex-none">
              <span className="text-xs md:text-sm text-slate-500 hidden sm:inline whitespace-nowrap">파일명:</span>
              <input 
                type="text" 
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 w-full min-w-[50px] md:w-48"
                placeholder="저장할 파일명"
              />
              <span className="text-xs md:text-sm text-slate-500">.pdf</span>
            </div>
            
            <button 
              onClick={exportPdf}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap text-sm md:text-base flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">다운로드</span>
            </button>
            <button 
              onClick={() => setFile(null)}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {!file ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div 
              className="max-w-md w-full bg-white rounded-2xl shadow-sm border-2 border-dashed border-blue-200 p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">PDF 파일 업로드</h2>
              <p className="text-slate-500 mb-6">수정할 PDF 문서를 선택하거나 이곳으로 드래그하세요.</p>
              <button className="bg-blue-50 text-blue-600 font-semibold px-6 py-2.5 rounded-full hover:bg-blue-100 transition-colors">
                파일 찾아보기
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="application/pdf"
                className="hidden" 
              />
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-1.5 text-slate-500 bg-white/50 px-4 py-2 rounded-full text-xs font-medium border border-slate-200/50 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              업로드한 파일은 서버에 일체 저장 및 공유되지 않습니다
            </div>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3 sm:gap-8 text-slate-400 text-sm">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> 별도 설치 없음</div>
              <div className="flex items-center gap-2"><Type className="w-4 h-4" /> 자유로운 텍스트 추가</div>
              <div className="flex items-center gap-2"><Download className="w-4 h-4" /> 즉시 다운로드</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Toolbar */}
            <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3 md:p-4 flex flex-row md:flex-col gap-2 md:gap-4 shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-10 overflow-x-auto flex-shrink-0">
              <h3 className="hidden md:block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">도구</h3>
              
              <div className="flex gap-2 md:gap-4 flex-row md:flex-col flex-nowrap w-full">
                <button 
                  onClick={addTextAnnotation}
                  className="flex items-center justify-center md:justify-start gap-2 md:gap-3 flex-1 p-2 md:p-3 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition-colors border border-transparent hover:border-blue-100 text-center md:text-left font-medium text-sm md:text-base whitespace-nowrap"
                >
                  <div className="bg-blue-100 p-1.5 md:p-2 rounded-lg text-blue-600">
                    <Type className="w-4 h-4" />
                  </div>
                  텍스트 추가
                </button>

                <button 
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center justify-center md:justify-start gap-2 md:gap-3 flex-1 p-2 md:p-3 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition-colors border border-transparent hover:border-blue-100 text-center md:text-left font-medium text-sm md:text-base whitespace-nowrap"
                >
                  <div className="bg-blue-100 p-1.5 md:p-2 rounded-lg text-blue-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  이미지 추가
                </button>
                
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className={`md:hidden flex items-center justify-center gap-1.5 p-2 rounded-xl transition-colors flex-shrink-0 ${historyIndex > 0 ? 'text-slate-600 hover:bg-slate-100 active:bg-slate-200' : 'text-slate-300'}`}
                  title="되돌리기"
                >
                  <Undo2 className="w-5 h-5" />
                </button>
              </div>

              <div className="hidden md:flex mt-2 justify-end px-2">
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${historyIndex > 0 ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed'}`}
                  title="되돌리기 (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                  되돌리기
                </button>
              </div>

              <input 
                type="file" 
                ref={imageInputRef} 
                onChange={handleImageUpload} 
                accept="image/jpeg, image/png"
                className="hidden" 
              />
              
              <div className="hidden md:block mt-auto bg-slate-50 p-4 rounded-xl text-sm text-slate-500">
                <p className="font-medium text-slate-700 mb-1">사용 방법</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>PDF의 기존 텍스트를 <strong>클릭</strong>하여 수정할 수 있습니다.</li>
                  <li><strong>텍스트/이미지 추가</strong> 버튼으로 내용을 추가하세요.</li>
                  <li>나타난 상자를 드래그하여 이동하세요.</li>
                  <li>이미지는 모서리를 드래그하거나 치수를 입력해 크기를 조절할 수 있습니다.</li>
                  <li>우측 상단 파일명을 적고 다운로드 하세요.</li>
                </ul>
              </div>

              {/* Google AdSense Banner Area */}
              <div className="hidden md:block">
                <AdBanner />
              </div>
            </div>
            
            {/* Editor Area */}
            <PdfEditor 
              file={file} 
              annotations={annotations} 
              setAnnotations={setAnnotations} 
              whiteouts={whiteouts}
              setWhiteouts={setWhiteouts}
              imageAnnotations={imageAnnotations}
              setImageAnnotations={setImageAnnotations}
              updateAnnotationPosition={updateAnnotationPosition}
              updateImageDataUrl={updateImageDataUrl}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 flex flex-col items-center justify-center text-center border-t border-slate-200/50 bg-slate-50/50">
        <a 
          href="https://privacy.jyelabs.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[11px] text-slate-400 hover:text-slate-500 hover:underline transition-colors"
        >
          개인정보처리방침 및 이용약관
        </a>
      </footer>
    </div>
  );
}
