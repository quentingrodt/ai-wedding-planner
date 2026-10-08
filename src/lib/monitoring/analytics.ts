import type { CaptureResult } from "posthog-js";
import { scrubUrl } from "./scrub";

/*
 * Mesure d'audience (PostHog, hébergement UE) : pages vues seulement, pour
 * suivre le parcours Date Night → inscription → onboarding → tableau de bord.
 * Sans cookies ni stockage dans le navigateur (cookieless_mode) : pas de
 * bandeau de consentement nécessaire. Éteinte sans NEXT_PUBLIC_POSTHOG_KEY.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

const URL_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$initial_referrer",
  "$prev_pageview_pathname",
] as const;

/** Retire jetons et paramètres de chaque adresse envoyée. */
export function scrubCapture(capture: CaptureResult | null): CaptureResult | null {
  if (!capture) return capture;
  for (const key of URL_PROPERTIES) {
    const value = capture.properties[key];
    if (typeof value === "string") capture.properties[key] = scrubUrl(value);
  }
  return capture;
}

/** Charge PostHog à la demande : rien n'est téléchargé tant qu'il est éteint. */
export function startAnalytics() {
  if (!POSTHOG_KEY) return;
  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        cookieless_mode: "always",
        person_profiles: "never",
        capture_pageview: "history_change",
        capture_pageleave: false,
        // Ni clics ni textes : les pages affichent noms d'invités et budget.
        autocapture: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        rageclick: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        mask_personal_data_properties: true,
        before_send: scrubCapture,
      });
    })
    .catch(() => {
      // Bloqué par un bloqueur de publicité : l'application n'en dépend pas.
    });
}
