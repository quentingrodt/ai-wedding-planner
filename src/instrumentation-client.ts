import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/monitoring/sentry-options";

// Erreurs du navigateur. Pas d'enregistrement de session : les pages
// contiennent les noms des invités et le budget du couple.
Sentry.init(sharedSentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
