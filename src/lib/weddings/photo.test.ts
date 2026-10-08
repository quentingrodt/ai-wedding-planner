import { describe, expect, it } from "vitest";
import { photoFolderOf, weddingPhotoPathSchema } from "./photo";
import { centeredSquare } from "./photo-crop";

const WEDDING = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const FILE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("centeredSquare", () => {
  it("garde le centre d'une photo en hauteur ou en largeur", () => {
    expect(centeredSquare(3000, 4000)).toEqual({ x: 0, y: 500, side: 3000 });
    expect(centeredSquare(1920, 1080)).toEqual({ x: 420, y: 0, side: 1080 });
    expect(centeredSquare(800, 800)).toEqual({ x: 0, y: 0, side: 800 });
  });
});

describe("weddingPhotoPathSchema", () => {
  it("n'accepte qu'un JPEG rangé dans le dossier d'un mariage", () => {
    expect(weddingPhotoPathSchema.safeParse(`${WEDDING}/${FILE}.jpg`).success).toBe(true);
    expect(weddingPhotoPathSchema.safeParse(`${WEDDING}/${FILE}.png`).success).toBe(false);
    expect(weddingPhotoPathSchema.safeParse(`${WEDDING}/../${FILE}.jpg`).success).toBe(false);
    expect(weddingPhotoPathSchema.safeParse(`${FILE}.jpg`).success).toBe(false);
  });

  it("lit le dossier du mariage", () => {
    expect(photoFolderOf(`${WEDDING}/${FILE}.jpg`)).toBe(WEDDING);
  });
});
