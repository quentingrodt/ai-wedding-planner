import type { DateNightStep, InspirationOption } from "./catalog";

/**
 * Recadrage portrait demandé à Unsplash ; doit rester identique au `search`
 * autorisé dans next.config.ts (images.remotePatterns).
 */
const PHOTO_QUERY = "?auto=format&fit=crop&w=1200&h=1600&q=80";

export type InspirationPhoto = {
  src: string;
  /** Page Unsplash de la photo (licence Unsplash, crédit apprécié). */
  credit: { author: string; url: string };
};

const unsplash = (photo: string, author: string, pageId: string): InspirationPhoto => ({
  src: `https://images.unsplash.com/${photo}${PHOTO_QUERY}`,
  credit: { author, url: `https://unsplash.com/photos/${pageId}` },
});

/** Photos des étapes Date Night ; celles du carnet viendront avec lui. */
export const INSPIRATION_PHOTOS: {
  [S in DateNightStep]: Record<InspirationOption<S>, InspirationPhoto>;
} = {
  venue: {
    chateau: unsplash("photo-1526815170550-79f226886ef3", "Dorian Mongel", "X8bwXanmSOo"),
    countryside: unsplash("photo-1780728953673-5752e3dffe12", "Troy Olson", "io3xcNfhAmE"),
    beach: unsplash("photo-1718152220007-6fb2c02fec95", "Josh Withers", "2I2URmDE16k"),
    urban: unsplash("photo-1723832348105-2e69f948135a", "Jennifer Kalenberg", "Rkj0ms67lio"),
  },
  ceremony: {
    secular: unsplash("photo-1769812344081-92b3e2ac39c0", "Jonathan Borba", "ckNjKI5cH_E"),
    religious: unsplash("photo-1714483061133-f04a47d45603", "Pauline Iakovleva", "lAG9pS3o7wg"),
    civil: unsplash("photo-1591700331354-f7eea65d1ce8", "Sinitta Leunen", "dS87qokCAC4"),
  },
  reception: {
    seated: unsplash("photo-1641834954859-5f211db537e6", "David Goldman", "UALNymlFeRo"),
    family: unsplash("photo-1774660811278-3a9710b375cd", "Alexander Mass", "qa0gEVBTyRY"),
    cocktail: unsplash("photo-1759646827349-bc2ac350d096", "Vlad Deep", "t4tb823FWYQ"),
    foodTrucks: unsplash("photo-1759503615129-54445a7b2f6a", "Jonathan Borba", "t8Arlmh7UNE"),
  },
};
