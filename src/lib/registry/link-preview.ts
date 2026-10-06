import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseProductPage, type ProductPreview } from "./product-page";

/*
 * Récupération d'une page produit à partir d'un lien collé par les mariés.
 * Côté serveur uniquement. Le lien vient de l'utilisateur : on refuse toute
 * adresse interne (SSRF), à chaque redirection, et on borne temps et taille.
 * Limite connue : entre la vérification DNS et la requête, un hôte malveillant
 * pourrait changer d'adresse (rebinding) ; la page lue n'est jamais renvoyée
 * telle quelle, seuls titre, prix et image en sont extraits.
 */

const TIMEOUT_MS = 6000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

/** Adresses privées, locales ou réservées, en IPv4 et IPv6. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const value = address.toLowerCase();
  if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80") ||
    value.startsWith("ff")
  );
}

/** Le lien pointe-t-il vers un hôte public, en http(s) sur le port standard ? */
async function isPublicUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.port !== "" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
}

/** Corps de la réponse, coupé au-delà de MAX_BYTES. */
async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

export type LinkPreviewResult =
  | { ok: true; preview: ProductPreview }
  | { ok: false; error: "invalid" | "unreachable" };

/** Titre, prix et image d'une page produit, ou une erreur explicite. */
export async function fetchProductPreview(rawUrl: string): Promise<LinkPreviewResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "invalid" };
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicUrl(url))) return { ok: false, error: hop === 0 ? "invalid" : "unreachable" };
      const response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          // Certaines boutiques ne servent leurs balises qu'à un navigateur identifié.
          "User-Agent": "Mozilla/5.0 (compatible; CelesteBot/1.0; +https://celeste.app)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        // Chaque redirection est revérifiée : elle pourrait viser le réseau interne.
        url = new URL(location, url);
        continue;
      }
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) {
        return { ok: false, error: "unreachable" };
      }
      return { ok: true, preview: parseProductPage(await readLimited(response), url.toString()) };
    }
    return { ok: false, error: "unreachable" };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}
