/** « Quentin & Aurore » → « Q&A » ; un seul prénom → sa première lettre. */
export function monogram(title: string): string {
  const names = title
    .split(/\s*(?:&|\+|\bet\b|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return names
    .slice(0, 2)
    .map((name) => name.charAt(0).toLocaleUpperCase())
    .join("&");
}
