import { CoverImageAsset } from '../types/booklet';

const MAX_DIM = 900;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode uploaded image file.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function renderLogoToPngDataUrl(
  sourceDataUrl: string,
  grayscale: boolean
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImageElement(sourceDataUrl);
  const naturalW = img.naturalWidth || 400;
  const naturalH = img.naturalHeight || 400;

  const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
  const targetW = Math.max(1, Math.round(naturalW * scale));
  const targetH = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  if (grayscale) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: targetW,
    height: targetH,
  };
}

export async function processCoverImageFile(
  file: File,
  grayscale = true
): Promise<CoverImageAsset> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const original = await renderLogoToPngDataUrl(rawDataUrl, false);
  const processed = grayscale
    ? await renderLogoToPngDataUrl(original.dataUrl, true)
    : original;

  return {
    filename: file.name,
    dataUrl: processed.dataUrl,
    originalDataUrl: original.dataUrl,
    grayscale,
    width: processed.width,
    height: processed.height,
  };
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
