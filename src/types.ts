export interface Annotation {
  id: string;
  pageIndex: number;
  text: string;
  x: number; // percentage 0-1
  y: number; // percentage 0-1
  fontSize: number;
  color: string;
  fontFamily?: string;
  fontWeight?: string;
}

export interface ImageAnnotation {
  id: string;
  pageIndex: number;
  dataUrl: string;
  x: number; // percentage 0-1
  y: number; // percentage 0-1
  width: number; // percentage 0-1
  height: number; // percentage 0-1
}

export interface Whiteout {
  id: string;
  pageIndex: number;
  x: number; // percentage 0-1
  y: number; // percentage 0-1
  width: number; // percentage 0-1
  height: number; // percentage 0-1
  color?: string; // background color
}

export const FONT_OPTIONS = [
  { label: '고딕 (Noto Sans)', value: "'Noto Sans KR', sans-serif", url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/400Regular/NotoSansKR_400Regular.ttf', boldUrl: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/700Bold/NotoSansKR_700Bold.ttf' },
  { label: '명조 (Noto Serif)', value: "'Noto Serif KR', serif", url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-serif-kr@0.4.3/400Regular/NotoSerifKR_400Regular.ttf', boldUrl: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-serif-kr@0.4.3/700Bold/NotoSerifKR_700Bold.ttf' },
  { label: '돋움 스타일 (Dotum)', value: "'Gowun Dodum', Dotum, sans-serif", url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/gowun-dodum@0.4.1/400Regular/GowunDodum_400Regular.ttf', boldUrl: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/nanum-gothic@0.4.0/700Bold/NanumGothic_700Bold.ttf' },
  { label: '굴림 스타일 (Gulim)', value: "'Nanum Gothic', Gulim, sans-serif", url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/nanum-gothic@0.4.0/400Regular/NanumGothic_400Regular.ttf', boldUrl: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/nanum-gothic@0.4.0/700Bold/NanumGothic_700Bold.ttf' },
  { label: 'Arial (영문 전용)', value: "Arial, Helvetica, sans-serif", url: 'HELVETICA', boldUrl: 'HELVETICA_BOLD' }
];
