import type { InspirationOption, InspirationStep } from "./catalog";

/*
 * Photos du swipe d'inspiration (licences Unsplash et Pexels : usage libre,
 * crédit apprécié). Recadrage portrait fixe, identique au `search` autorisé
 * dans next.config.ts (images.remotePatterns).
 */
const UNSPLASH_QUERY = "?auto=format&fit=crop&w=1200&h=1600&q=80";
const PEXELS_QUERY = "?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=1600";

export type InspirationPhoto = {
  src: string;
  credit: {
    /** Inconnu pour Pexels, dont la licence n'exige pas d'attribution. */
    author?: string;
    source: "Unsplash" | "Pexels";
    url: string;
  };
};

const unsplash = (photo: string, author: string, pageId: string): InspirationPhoto => ({
  src: `https://images.unsplash.com/${photo}${UNSPLASH_QUERY}`,
  credit: { author, source: "Unsplash", url: `https://unsplash.com/photos/${pageId}` },
});

const pexels = (id: number): InspirationPhoto => ({
  src: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg${PEXELS_QUERY}`,
  credit: { source: "Pexels", url: `https://www.pexels.com/photo/${id}/` },
});

export const INSPIRATION_PHOTOS: {
  [S in InspirationStep]: Record<InspirationOption<S>, InspirationPhoto>;
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
  dessert: {
    croquembouche: pexels(9328799),
    tieredCake: unsplash("photo-1574538860416-baadc5d4ec57", "Scott Osborn", "TAtTPzM95nk"),
    dessertBar: unsplash("photo-1774660811213-37f1b8e8f00c", "Alexander Mass", "eLkVXFJxF_0"),
    nakedCake: unsplash("photo-1542007920-992d2c424d09", "James Coleman", "5HR1gItc7Gs"),
  },
  brideAttire: {
    princess: unsplash("photo-1776013114452-1c44daeb47c7", "Quinces Perfectos", "vSrnzkZg1QY"),
    sheath: unsplash("photo-1740589389656-789130dd6a05", "Elist Nguyen", "irBcFUcxnuQ"),
    boho: unsplash("photo-1654266552357-c743547d54dd", "Oksana Zub", "T_L4dVzo0so"),
    pantsuit: pexels(27927668),
  },
  groomAttire: {
    threePiece: pexels(15536113),
    tuxedo: pexels(31619528),
    linen: pexels(4558789),
    velvet: pexels(12386604),
  },
  bridesmaids: {
    matching: pexels(32187159),
    mixMatch: pexels(32075005),
    pastel: pexels(16228863),
    freeStyle: pexels(33434577),
  },
  groomsmen: {
    matching: pexels(34327717),
    suspenders: pexels(20024338),
    linen: pexels(12358431),
    accessory: pexels(29858929),
  },
  bacheloretteParty: {
    spa: pexels(11179573),
    cityTrip: pexels(904742),
    workshop: pexels(6223132),
    poolParty: pexels(5303406),
  },
  bachelorParty: {
    adventure: pexels(33986451),
    karting: pexels(32491797),
    cityTrip: pexels(5858203),
    tasting: pexels(14641303),
  },
  transport: {
    luxury: pexels(37828108),
    vintage: pexels(19773707),
    carriage: pexels(18416304),
    shuttle: pexels(23153107),
  },
  honeymoon: {
    island: pexels(3293192),
    roadTrip: pexels(6271672),
    cityBreak: pexels(39305263),
    safari: pexels(10740862),
  },
};
