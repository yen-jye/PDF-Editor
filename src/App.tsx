/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import PdfEditor from './components/PdfEditor';
import { Annotation } from './types';
import { Upload, Download, Type, FileEdit, X, FileText } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import './pdf-init';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('edited_document');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [whiteouts, setWhiteouts] = useState<Whiteout[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
      setFileName(uploadedFile.name.replace(/\.pdf$/i, '') + '_edited');
      setAnnotations([]);
      setWhiteouts([]);
    } else if (uploadedFile) {
      alert('PDF 파일만 업로드 가능합니다.');
    }
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
      fontWeight: 'normal',
    };
    setAnnotations([...annotations, newAnnotation]);
  };

  const updateAnnotationPosition = (id: string, dx: number, dy: number) => {
    setAnnotations(prev => prev.map(a => 
      a.id === id ? { ...a, x: Math.max(0, Math.min(1, a.x + dx)), y: Math.max(0, Math.min(1, a.y + dy)) } : a
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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-blue-600">
          <FileEdit className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">심플 PDF 에디터</h1>
        </div>
        
        {file && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <span className="text-sm text-slate-500">파일명:</span>
              <input 
                type="text" 
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 w-48"
                placeholder="저장할 파일명"
              />
              <span className="text-sm text-slate-500">.pdf</span>
            </div>
            
            <button 
              onClick={exportPdf}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>
            <button 
              onClick={() => setFile(null)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
            <div className="mt-8 flex gap-8 text-slate-400 text-sm">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> 별도 설치 없음</div>
              <div className="flex items-center gap-2"><Type className="w-4 h-4" /> 자유로운 텍스트 추가</div>
              <div className="flex items-center gap-2"><Download className="w-4 h-4" /> 즉시 다운로드</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex">
            {/* Toolbar */}
            <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-4 shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-10">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">도구</h3>
              <button 
                onClick={addTextAnnotation}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition-colors border border-transparent hover:border-blue-100 text-left font-medium"
              >
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <Type className="w-4 h-4" />
                </div>
                텍스트 추가하기
              </button>
              
              <div className="mt-auto bg-slate-50 p-4 rounded-xl text-sm text-slate-500">
                <p className="font-medium text-slate-700 mb-1">사용 방법</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>PDF의 기존 텍스트를 <strong>클릭</strong>하여 수정할 수 있습니다.</li>
                  <li><strong>텍스트 추가</strong> 버튼으로 새 텍스트를 입력하세요.</li>
                  <li>나타난 상자를 드래그하여 이동하세요.</li>
                  <li>우측 상단 파일명을 적고 다운로드 하세요.</li>
                </ul>
              </div>
            </div>
            
            {/* Editor Area */}
            <PdfEditor 
              file={file} 
              annotations={annotations} 
              setAnnotations={setAnnotations} 
              whiteouts={whiteouts}
              setWhiteouts={setWhiteouts}
              updateAnnotationPosition={updateAnnotationPosition}
            />
          </div>
        )}
      </main>
    </div>
  );
}
