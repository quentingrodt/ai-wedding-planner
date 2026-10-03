import type { routing } from "@/i18n/routing";
import type messages from "../messages/fr.json";

// Typage strict de next-intl : locales autorisées et clés de traduction
// vérifiées à la compilation (fr.json fait foi).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
