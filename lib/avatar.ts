/** Foto de perfil: recorta o centro em quadrado e reduz para um JPEG pequeno (data URL, ~10 KB). */
export const AVATAR_SIZE = 160;

export async function fileToAvatarDataUrl(file: File, size: number = AVATAR_SIZE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('Imagem inválida.');
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
