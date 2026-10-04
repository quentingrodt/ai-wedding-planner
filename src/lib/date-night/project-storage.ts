/**
 * Copie locale du projet Date Night (navigateur), en secours du relais par
 * URL : si la confirmation d'email ou une reconnexion perd les paramètres,
 * l'onboarding peut encore retrouver le projet sur le même appareil.
 */
const STORAGE_KEY = "celeste.dateNight.project";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type StoredProject = { savedAt: number; query: Record<string, string> };

export function storeDateNightProject(query: Record<string, string | number>) {
  try {
    const value: StoredProject = {
      savedAt: Date.now(),
      query: Object.fromEntries(Object.entries(query).map(([key, v]) => [key, String(v)])),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée…) : le relais par URL suffit.
  }
}

/** Query du projet enregistré, ou null s'il est absent, illisible ou trop ancien. */
export function readDateNightProject(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredProject>;
    if (typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > MAX_AGE_MS) {
      return null;
    }
    return stored.query && typeof stored.query === "object" ? stored.query : null;
  } catch {
    return null;
  }
}
