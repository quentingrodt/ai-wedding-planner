/**
 * Lecture d'une page produit : titre, prix et image, d'après les données
 * structurées (schema.org Product en JSON-LD) puis les balises Open Graph.
 * Fonction pure, sans réseau : la récupération de la page vit dans
 * link-preview.ts.
 */

export type ProductPreview = {
  title: string | null;
  /** Prix arrondi à l'unité, dans la devise de la page. */
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));

/** Contenu d'une balise <meta property|name="…" content="…">, quel que soit l'ordre des attributs. */
function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value?.trim()) return decodeEntities(value.trim());
  }
  return null;
}

/** « 1 299,90 » ou « 1,299.90 » → 1300 ; null si illisible. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  let value = raw.replace(/[^\d.,]/g, "");
  if (!value) return null;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  // Le dernier séparateur suivi de 1 ou 2 chiffres est le séparateur décimal.
  const decimal = Math.max(lastComma, lastDot);
  if (decimal !== -1 && value.length - decimal - 1 <= 2) {
    value = `${value.slice(0, decimal).replace(/[.,]/g, "")}.${value.slice(decimal + 1)}`;
  } else {
    value = value.replace(/[.,]/g, "");
  }
  const price = Number(value);
  return Number.isFinite(price) ? Math.round(price) : null;
}

type JsonLdNode = Record<string, unknown>;

/** Nœuds JSON-LD de la page, @graph et tableaux aplatis. */
function jsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const node = value as JsonLdNode;
      nodes.push(node);
      if (node["@graph"]) visit(node["@graph"]);
    }
  };
  for (const [, body] of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(body));
    } catch {
      // JSON-LD mal formé : on passe aux balises suivantes.
    }
  }
  return nodes;
}

const isProduct = (node: JsonLdNode) => {
  const type = node["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
};

const firstString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === "object") return firstString((value as JsonLdNode).url);
  return null;
};

/** Adresse absolue en https, ou null (les images non sécurisées sont écartées). */
function absoluteHttps(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value), baseUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseProductPage(html: string, baseUrl: string): ProductPreview {
  const product = jsonLdNodes(html).find(isProduct);
  const offers = product?.offers;
  const offer = (Array.isArray(offers) ? offers[0] : offers) as JsonLdNode | undefined;

  const title =
    (typeof product?.name === "string" ? decodeEntities(product.name) : null) ??
    meta(html, "og:title") ??
    meta(html, "twitter:title") ??
    (() => {
      const raw = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
      return raw ? decodeEntities(raw) : null;
    })();

  const price =
    parsePrice(offer?.price ?? offer?.lowPrice) ??
    parsePrice(meta(html, "product:price:amount") ?? meta(html, "og:price:amount"));
  const currency =
    (typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null) ??
    meta(html, "product:price:currency") ??
    meta(html, "og:price:currency");

  const imageUrl = absoluteHttps(
    firstString(product?.image) ?? meta(html, "og:image") ?? meta(html, "twitter:image"),
    baseUrl,
  );

  return {
    title: title ? title.replace(/\s+/g, " ").slice(0, 120) : null,
    price,
    currency: currency ? currency.toUpperCase().slice(0, 3) : null,
    imageUrl,
  };
}
