"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import messages from "../../messages/global-error.json";

/**
 * Dernier recours, quand la mise en page elle-même échoue : sans elle, ni
 * polices ni dictionnaire next-intl. D'où un petit dictionnaire à part et
 * des styles en ligne aux couleurs de Céleste.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Les autres langues sont préfixées (/en/...) ; le français ne l'est pas.
  const [locale] = useState<keyof typeof messages>(() =>
    typeof window !== "undefined" && /^\/en(\/|$)/.test(window.location.pathname) ? "en" : "fr",
  );
  const t = messages[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f8f6",
          color: "#2b2a28",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32, margin: "0 0 16px" }}>
            {t.title}
          </h1>
          <p style={{ color: "#6b665f", lineHeight: 1.7, margin: "0 0 24px" }}>{t.description}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#3f4a3b",
              color: "#f9f8f6",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
