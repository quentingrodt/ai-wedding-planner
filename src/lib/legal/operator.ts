/*
 * Éditeur de Céleste, repris dans les mentions légales et la politique de
 * confidentialité. À COMPLÉTER avant d'ouvrir l'application au public :
 * la loi (LCEN, art. 6) impose l'identité de l'éditeur et de l'hébergeur.
 * Tant qu'une valeur est vide, la page affiche « à compléter ».
 */
export const LEGAL_OPERATOR = {
  /** Nom et prénom, ou raison sociale (et numéro SIREN pour une société). */
  name: "",
  /** Adresse postale (ou domiciliation). */
  address: "",
  /** Adresse e-mail de contact, aussi utilisée pour les demandes RGPD. */
  email: "",
  /** Directeur ou directrice de la publication (souvent l'éditeur lui-même). */
  publicationDirector: "",
  /** Hébergeur de l'application : nom, adresse et téléphone (ex. Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis). */
  host: "",
};

/** Date de dernière mise à jour des deux pages (AAAA-MM-JJ). */
export const LEGAL_UPDATED_AT = "2026-10-08";
