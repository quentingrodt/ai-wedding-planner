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

function isPrivateIPv4(address: string): boolean {
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

/** Les huit groupes d'une adresse IPv6, « :: » et IPv4 finale compris ; null si illisible. */
function ipv6Groups(address: string): number[] | null {
  let value = address.toLowerCase().split("%")[0];
  // Fin en notation IPv4 (::ffff:127.0.0.1) : convertie en deux groupes hexadécimaux.
  const dotted = value.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (isIP(dotted[1]) !== 4) return null;
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    value = `${value.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail, extra] = value.split("::");
  if (extra !== undefined) return null;
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill("0"), ...right].map((group) =>
    /^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN,
  );
  return groups.some(Number.isNaN) ? null : groups;
}

/**
 * Adresses privées, locales ou réservées, en IPv4 et IPv6. Une IPv4 cachée
 * dans une IPv6 (::ffff:7f00:1, 64:ff9b::7f00:1…) est vérifiée comme une IPv4 :
 * l'URL normalise ::ffff:127.0.0.1 en ::ffff:7f00:1, qu'il faut donc décoder.
 */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIPv4(address);
  const groups = ipv6Groups(address);
  // Illisible : refusé par prudence.
  if (!groups) return true;
  const embedded = () => `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  const zeros = (count: number) => groups.slice(0, count).every((group) => group === 0);
  // ::ffff:a.b.c.d (mappée), ::a.b.c.d (compatible) et 64:ff9b::a.b.c.d (NAT64).
  if ((zeros(5) && groups[5] === 0xffff) || (zeros(6) && (groups[6] !== 0 || groups[7] > 1))) {
    return isPrivateIPv4(embedded());
  }
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) {
    return isPrivateIPv4(embedded());
  }
  const first = groups[0];
  return (
    zeros(8) || // ::
    (zeros(7) && groups[7] === 1) || // ::1
    (first & 0xfe00) === 0xfc00 || // fc00::/7, adresses locales uniques
    (first & 0xffc0) === 0xfe80 || // fe80::/10, lien local
    (first & 0xff00) === 0xff00 // ff00::/8, multidiffusion
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
