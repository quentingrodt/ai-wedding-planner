import * as Sentry from "@sentry/nextjs";
import { startAnalytics } from "@/lib/monitoring/analytics";
import { sharedSentryOptions } from "@/lib/monitoring/sentry-options";

// Erreurs du navigateur. Pas d'enregistrement de session : les pages
// contiennent les noms des invités et le budget du couple.
Sentry.init(sharedSentryOptions);

// Pages vues, sans cookies (éteinte sans clé PostHog).
startAnalytics();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
