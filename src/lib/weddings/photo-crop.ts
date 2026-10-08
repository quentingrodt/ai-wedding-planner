import { WEDDING_PHOTO_SIZE } from "./photo";

/** Zone source d'un recadrage carré centré (pixels de l'image d'origine). */
export type SquareCrop = { x: number; y: number; side: number };

/** Le plus grand carré centré de l'image : le portrait rond n'en montre pas plus. */
export function centeredSquare(width: number, height: number): SquareCrop {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

/**
 * Recadre la photo choisie en carré JPEG de WEDDING_PHOTO_SIZE px, dans le
 * navigateur : l'envoi reste léger, même depuis l'appareil photo d'un téléphone.
 * Rejette si le navigateur ne sait pas décoder le fichier.
 */
export async function cropToSquareJpeg(file: Blob): Promise<Blob> {
  // L'orientation EXIF est appliquée par défaut (photos de téléphone).
  const bitmap = await createImageBitmap(file);
  try {
    const crop = centeredSquare(bitmap.width, bitmap.height);
    const size = Math.min(WEDDING_PHOTO_SIZE, crop.side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/jpeg", 0.88),
    );
  } finally {
    bitmap.close();
  }
}
