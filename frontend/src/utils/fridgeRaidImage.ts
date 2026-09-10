export async function compressFridgeJpeg(file: File, maxEdge = 1280, quality = 0.82): Promise<{ base64: string; mime: string }> {
  const dataUrl = await readFileAsDataURL(file);
  if (typeof document === 'undefined') {
    return fromDataUrl(dataUrl);
  }
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return fromDataUrl(dataUrl);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  return fromDataUrl(jpeg || dataUrl);
}

function fromDataUrl(dataUrl: string): { base64: string; mime: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) {
    throw new Error('invalid image');
  }
  return { mime: m[1], base64: m[2] };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}
