import * as Sentry from "@sentry/nextjs";

/** Démarre Sentry côté serveur, dans l'environnement d'exécution en cours. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Erreurs des Server Components, Server Actions, routes et du proxy.
export const onRequestError = Sentry.captureRequestError;
