import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { scrubCapture } from "./analytics";

describe("scrubCapture", () => {
  it("masque le jeton et les paramètres de chaque adresse", () => {
    const capture = {
      uuid: "1",
      event: "$pageview",
      properties: {
        $current_url: "https://celeste.app/i/secret-token?lang=fr",
        $pathname: "/i/secret-token",
        $referrer: "https://celeste.app/auth/callback?code=abc",
        title: "Céleste",
      },
    } as CaptureResult;
    expect(scrubCapture(capture)?.properties).toEqual({
      $current_url: "https://celeste.app/i/[token]",
      $pathname: "/i/[token]",
      $referrer: "https://celeste.app/auth/callback",
      title: "Céleste",
    });
  });

  it("laisse passer un événement filtré", () => {
    expect(scrubCapture(null)).toBeNull();
  });
});
