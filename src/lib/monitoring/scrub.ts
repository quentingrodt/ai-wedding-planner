/*
 * Nettoyage des adresses avant leur envoi aux outils de suivi (Sentry,
 * mesure d'audience) : les liens personnels des invités et des témoins
 * portent un jeton secret, et les paramètres peuvent contenir un code de
 * connexion. Ni l'un ni l'autre ne quitte Céleste.
 */

// /i/<jeton>, /invite/<jeton>, avec ou sans préfixe de langue (/en/i/<jeton>).
const TOKEN_SEGMENT = /(\/(?:i|invite)\/)[^/?#]+/g;

/** Chemin ou adresse complète, jeton masqué, sans paramètres ni ancre. */
export function scrubUrl(url: string): string {
  const withoutQuery = url.replace(/[?#].*$/, "");
  return withoutQuery.replace(TOKEN_SEGMENT, "$1[token]");
}
