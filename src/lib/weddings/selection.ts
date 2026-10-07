import { cookies } from "next/headers";
import { z } from "zod";

/*
 * Mariage choisi par l'utilisateur quand il en a plusieurs (le sien, et celui
 * d'amis dont il est témoin). Le cookie ne fait que mémoriser un choix :
 * getCurrentWedding vérifie toujours l'appartenance, et la RLS reste la
 * garantie. Un cookie trafiqué ou périmé est simplement ignoré.
 */

export const SELECTED_WEDDING_COOKIE = "celeste_wedding";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Identifiant du mariage choisi, ou null (absent ou illisible). */
export async function readSelectedWeddingId(): Promise<string | null> {
  const value = (await cookies()).get(SELECTED_WEDDING_COOKIE)?.value;
  const parsed = z.uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Mémorise le mariage choisi (Server Action ou Route Handler uniquement). */
export async function rememberSelectedWedding(weddingId: string) {
  (await cookies()).set(SELECTED_WEDDING_COOKIE, weddingId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
