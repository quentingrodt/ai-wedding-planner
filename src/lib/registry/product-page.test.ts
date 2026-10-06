import { describe, expect, it } from "vitest";
import { parsePrice, parseProductPage } from "./product-page";

describe("parseProductPage", () => {
  it("lit les données structurées schema.org en priorité", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Titre Open Graph">
        <script type="application/ld+json">
          {"@context":"https://schema.org","@graph":[{"@type":"Organization"},
           {"@type":"Product","name":"Cocotte en fonte 24 cm","image":["https://cdn.example.com/cocotte.jpg"],
            "offers":{"@type":"Offer","price":"229.90","priceCurrency":"EUR"}}]}
        </script>
      </head></html>`;
    expect(parseProductPage(html, "https://shop.example.com/p/1")).toEqual({
      title: "Cocotte en fonte 24 cm",
      price: 230,
      currency: "EUR",
      imageUrl: "https://cdn.example.com/cocotte.jpg",
    });
  });

  it("se rabat sur les balises Open Graph, attributs dans n'importe quel ordre", () => {
    const html = `
      <meta content="Plaid en laine &amp; cachemire" property="og:title" />
      <meta property="og:image" content="/images/plaid.jpg">
      <meta property="product:price:amount" content="89,00">
      <meta property="product:price:currency" content="eur">`;
    expect(parseProductPage(html, "https://maison.example.fr/plaid")).toEqual({
      title: "Plaid en laine & cachemire",
      price: 89,
      currency: "EUR",
      imageUrl: "https://maison.example.fr/images/plaid.jpg",
    });
  });

  it("garde au moins le titre de la page et écarte les images non sécurisées", () => {
    const html = `<title>  Vase   en grès </title><meta property="og:image" content="http://insecure.example.com/a.jpg">`;
    expect(parseProductPage(html, "https://example.com")).toEqual({
      title: "Vase en grès",
      price: null,
      currency: null,
      imageUrl: null,
    });
  });

  it("ignore un JSON-LD mal formé", () => {
    const html = `<script type="application/ld+json">{oops</script><meta property="og:title" content="Lampe">`;
    expect(parseProductPage(html, "https://example.com").title).toBe("Lampe");
  });
});

describe("parsePrice", () => {
  it.each([
    ["1 299,90 €", 1300],
    ["1,299.90", 1300],
    ["1.299", 1299],
    ["49", 49],
    [129.5, 130],
    ["", null],
    [null, null],
  ])("%s → %s", (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });
});
