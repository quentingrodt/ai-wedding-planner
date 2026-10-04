import { headers } from "next/headers";
import type { Locale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { withHandoff, type Handoff } from "@/lib/onboarding/schema";

/** Origine publique de la requête, pour les liens envoyés par email. */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  return headerList.get("origin") ?? `https://${headerList.get("host")}`;
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
