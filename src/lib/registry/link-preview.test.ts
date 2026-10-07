import { describe, expect, it } from "vitest";
import { fetchProductPreview, isPrivateAddress } from "./link-preview";

describe("adresses internes (SSRF)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.10",
    "169.254.169.254",
    "::",
    "::1",
    "fd12::1",
    "fe80::1%eth0",
    "ff02::1",
    // IPv4 cachées dans une IPv6, telles que les écrit une URL normalisée.
    "::ffff:7f00:1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "::7f00:1",
    "64:ff9b::7f00:1",
    "0:0:0:0:0:ffff:c0a8:0101",
    // Illisible : refusée par prudence.
    "1::2::3",
  ])("refuse %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "::ffff:5db8:d822", "64:ff9b::5db8:d822"])(
    "accepte l'adresse publique %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it("refuse un lien vers la machine elle-même écrit en IPv6", async () => {
    expect(await fetchProductPreview("http://[::ffff:127.0.0.1]/")).toEqual({ ok: false, error: "invalid" });
    expect(await fetchProductPreview("http://[::1]/")).toEqual({ ok: false, error: "invalid" });
  });
});
