import type { ErrorEvent } from "@sentry/nextjs";
import type { TransactionEvent } from "@sentry/core";
import { scrubUrl } from "./scrub";

/*
 * Réglages Sentry communs au navigateur, au serveur et à l'edge.
 * Sans NEXT_PUBLIC_SENTRY_DSN, Sentry reste éteint : rien n'est envoyé.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Retire jetons et paramètres des adresses, et toute donnée personnelle. */
function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      const { "user-agent": userAgent } = event.request.headers;
      event.request.headers = userAgent ? { "user-agent": userAgent } : {};
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const breadcrumb of event.breadcrumbs ?? []) {
    const data = breadcrumb.data;
    if (!data) continue;
    for (const key of ["url", "from", "to"] as const) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key]);
    }
  }
  return event;
}

export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  // Ni adresse IP ni cookies : seules les erreurs et leur contexte technique.
  sendDefaultPii: false,
  // Une navigation sur dix mesurée : de quoi repérer les lenteurs, à faible coût.
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeSendTransaction: (event: TransactionEvent) => {
    if (event.transaction) event.transaction = scrubUrl(event.transaction);
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    return event;
  },
};
