"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { readDateNightProject } from "@/lib/date-night/project-storage";

/**
 * Arrivée à l'onboarding sans projet dans l'URL (lien de confirmation qui a
 * perdu ses paramètres, reconnexion…) : on recharge la page avec le projet
 * Date Night conservé dans le navigateur, s'il existe. Les paramètres sont
 * revalidés côté serveur (parseHandoff).
 */
export function RestoreProject() {
  const router = useRouter();

  useEffect(() => {
    const query = readDateNightProject();
    if (query && Object.keys(query).length > 0) {
      router.replace({ pathname: "/onboarding", query });
    }
  }, [router]);

  return null;
}
