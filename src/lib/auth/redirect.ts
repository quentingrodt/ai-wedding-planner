import { headers } from "next/headers";
import type { Locale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { withHandoff, type Handoff } from "@/lib/onboarding/schema";

/** Adresse publique configurée du site, sans barre finale, ou null. */
export function configuredSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // Sur Vercel, le domaine de production est fourni par la plateforme.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}

/**
 * Origine publique du site, pour les liens envoyés par email ou partagés.
 * Jamais déduite des en-têtes Origin / Host en production : un attaquant
 * pourrait les falsifier pour faire envoyer un lien vers son propre domaine.
 */
export async function getRequestOrigin(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL doit être définie en production (ex. https://celeste.app).");
  }
  // En développement uniquement : l'adresse locale de la requête.
  const headerList = await headers();
  return headerList.get("origin") ?? `http://${headerList.get("host")}`;
}

/**
 * Destination après authentification : la page d'invitation pour un invité,
 * sinon l'onboarding (qui renvoie lui-même au dashboard si un mariage existe),
 * en conservant le projet Date Night éventuel.
 */
export function afterAuthPath(locale: Locale, handoff: Handoff, invite?: string): string {
  if (invite) return getPathname({ href: `/invite/${invite}`, locale });
  return withHandoff(getPathname({ href: "/onboarding", locale }), handoff);
}

/** URL absolue du callback d'auth, avec le relais Date Night et l'invitation. */
export async function authCallbackUrl(
  locale: Locale,
  handoff: Handoff,
  extra: Record<string, string> = {},
): Promise<string> {
  const path = withHandoff(getPathname({ href: "/auth/callback", locale }), handoff, extra);
  return `${await getRequestOrigin()}${path}`;
}
