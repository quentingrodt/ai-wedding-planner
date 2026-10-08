import { describe, expect, it } from "vitest";
import { scrubUrl } from "./scrub";

describe("scrubUrl", () => {
  it("masque le jeton des liens invités et témoins", () => {
    expect(scrubUrl("/i/abc123")).toBe("/i/[token]");
    expect(scrubUrl("/en/i/abc123/registry")).toBe("/en/i/[token]/registry");
    expect(scrubUrl("https://celeste.app/invite/XyZ-9_")).toBe("https://celeste.app/invite/[token]");
  });

  it("retire les paramètres et l'ancre", () => {
    expect(scrubUrl("/auth/callback?code=secret&next=/dashboard")).toBe("/auth/callback");
    expect(scrubUrl("/guests#row-4")).toBe("/guests");
  });

  it("laisse les autres pages intactes", () => {
    expect(scrubUrl("/dashboard")).toBe("/dashboard");
    expect(scrubUrl("/inspiration")).toBe("/inspiration");
  });
});
