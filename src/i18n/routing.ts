import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // fr (marché de lancement) sans préfixe : "/" ; les autres langues préfixées : "/en".
  localePrefix: "as-needed",
});
