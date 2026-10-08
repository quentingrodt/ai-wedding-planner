import { createAdminClient } from "@/utils/supabase/admin";
import {
  parseApiTrack,
  PLAYLIST_MAX_PAGES,
  PLAYLIST_PAGE_SIZE,
  playlistItemsResponseSchema,
  searchResponseSchema,
  SPOTIFY_SEARCH_LIMIT,
  toSpotifyTrack,
  tokenResponseSchema,
  type SpotifyActionError,
  type SpotifyTrack,
  type TokenResponse,
} from "./schema";

/*
 * Accès serveur à Spotify. Ce module n'est PAS un fichier "use server" :
 * ses fonctions (dont getValidAccessToken) ne doivent jamais devenir des
 * actions appelables depuis le navigateur.
 */

const ACCOUNTS_URL = "https://accounts.spotify.com";
const API_URL = "https://api.spotify.com/v1";
/** Marge avant expiration : un jeton qui expire dans moins d'une minute est renouvelé. */
const EXPIRY_MARGIN_MS = 60_000;

export class SpotifyError extends Error {
  constructor(readonly code: SpotifyActionError) {
    super(`Spotify: ${code}`);
  }
}

function credentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET doivent être définies (.env.local).",
    );
  }
  return { clientId, clientSecret };
}

export const spotifyClientId = () => credentials().clientId;

/**
 * Adresse de retour OAuth, à déclarer à l'identique dans le tableau de bord
 * Spotify. En local, Spotify refuse « localhost » : ouvrir l'app sur
 * http://127.0.0.1:3000.
 */
export function spotifyRedirectUri(origin: string): string {
  return process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/spotify/callback`;
}

/** POST /api/token, authentifié par l'identifiant et le secret de l'app. */
async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    console.error("[spotify] token:", response.status, payload?.error);
    // invalid_grant : code expiré, ou accès retiré par le couple depuis Spotify.
    throw new SpotifyError(
      payload?.error === "invalid_grant"
        ? "disconnected"
        : response.status === 429
          ? "rateLimited"
          : "generic",
    );
  }
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new SpotifyError("generic");
  return parsed.data;
}

/** Jeton d'application en mémoire, partagé par toutes les requêtes du serveur. */
let appToken: { value: string; expiresAt: number } | null = null;

/**
 * Jeton d'application (client_credentials) : lit le catalogue Spotify sans
 * aucun compte utilisateur. La limite d'utilisateurs du Development Mode ne
 * s'y applique pas, puisque personne ne se connecte.
 */
async function getAppAccessToken(): Promise<string> {
  if (appToken && appToken.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return appToken.value;
  const token = await requestToken({ grant_type: "client_credentials" });
  appToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

/**
 * Recherche de morceaux dans le catalogue Spotify, avec le jeton
 * d'application. market : pays du mariage (ISO 3166-1), pour ne proposer que
 * des morceaux disponibles là-bas.
 */
export async function searchCatalog(query: string, market: string | null): Promise<SpotifyTrack[]> {
  const token = await getAppAccessToken();
  const params = new URLSearchParams({ q: query, type: "track", limit: String(SPOTIFY_SEARCH_LIMIT) });
  if (market && /^[A-Z]{2}$/.test(market)) params.set("market", market);
  const response = searchResponseSchema.safeParse(await spotifyApi(token, `/search?${params.toString()}`));
  if (!response.success) throw new SpotifyError("generic");
  return response.data.tracks.items.map(toSpotifyTrack);
}

/** Échange le code reçu au retour d'autorisation contre les jetons. */
export function exchangeCode(code: string, redirectUri: string) {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

const expiresAt = (expiresIn: number) => new Date(Date.now() + expiresIn * 1000).toISOString();

/**
 * Jeton d'accès valide pour le compte Spotify lié au mariage.
 *
 * Réutilise le jeton en cache tant qu'il est valable plus d'une minute ;
 * sinon le renouvelle avec le refresh token et enregistre le nouveau jeton
 * (et le nouveau refresh token si Spotify en a émis un). Si Spotify refuse
 * le refresh token, l'intégration est supprimée : le couple reconnecte.
 *
 * À n'appeler qu'après avoir vérifié que l'utilisateur appartient au mariage.
 */
export async function getValidAccessToken(weddingId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("spotify_integrations")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("wedding_id", weddingId)
    .maybeSingle<{
      refresh_token: string;
      access_token: string | null;
      access_token_expires_at: string | null;
    }>();

  if (error) {
    console.error("[spotify] getValidAccessToken:", error.code);
    throw new SpotifyError("generic");
  }
  if (!data) throw new SpotifyError("disconnected");

  if (
    data.access_token &&
    data.access_token_expires_at &&
    new Date(data.access_token_expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS
  ) {
    return data.access_token;
  }

  let token: TokenResponse;
  try {
    token = await requestToken({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  } catch (cause) {
    if (cause instanceof SpotifyError && cause.code === "disconnected") {
      await admin.from("spotify_integrations").delete().eq("wedding_id", weddingId);
    }
    throw cause;
  }

  const { error: updateError } = await admin
    .from("spotify_integrations")
    .update({
      access_token: token.access_token,
      access_token_expires_at: expiresAt(token.expires_in),
      ...(token.refresh_token ? { refresh_token: token.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("wedding_id", weddingId);
  if (updateError) console.error("[spotify] token cache:", updateError.code);

  return token.access_token;
}

/** Appel à l'API Web ; les statuts d'erreur deviennent des SpotifyError typées. */
export async function spotifyApi<T>(
  accessToken: string,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[spotify] api:", init.method ?? "GET", path.split("?")[0], response.status);
    throw new SpotifyError(
      response.status === 429
        ? "rateLimited"
        : response.status === 401
          ? "disconnected"
          : response.status === 404
            ? "playlistMissing"
            : response.status === 403
              ? "forbidden"
              : "generic",
    );
  }
  return (await response.json()) as T;
}

/**
 * Morceaux de la playlist, dans l'ordre de Spotify. L'API fait foi : le
 * lecteur « Embed » de Spotify sert des copies parfois en retard de plusieurs
 * morceaux. À n'appeler qu'après avoir vérifié l'appartenance au mariage.
 */
export async function getPlaylistTracks(
  weddingId: string,
  playlistId: string,
): Promise<{ total: number; tracks: SpotifyTrack[] }> {
  const token = await getValidAccessToken(weddingId);
  const tracks: SpotifyTrack[] = [];
  let total = 0;
  for (let page = 0; page < PLAYLIST_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      limit: String(PLAYLIST_PAGE_SIZE),
      offset: String(page * PLAYLIST_PAGE_SIZE),
      market: "from_token",
    });
    const parsed = playlistItemsResponseSchema.safeParse(
      await spotifyApi(token, `/playlists/${encodeURIComponent(playlistId)}/items?${params}`),
    );
    if (!parsed.success) throw new SpotifyError("generic");
    total = parsed.data.total;
    for (const entry of parsed.data.items) {
      if (entry.is_local || entry.item?.type !== "track") continue;
      const track = parseApiTrack(entry.item);
      if (track) tracks.push(toSpotifyTrack(track));
    }
    if (!parsed.data.next) break;
  }
  return { total, tracks };
}

/** Statut de la liaison, sans jamais lire les jetons. */
export async function getSpotifyIntegration(
  weddingId: string,
): Promise<{ playlistId: string | null } | null> {
  const { data, error } = await createAdminClient()
    .from("spotify_integrations")
    .select("playlist_id")
    .eq("wedding_id", weddingId)
    .maybeSingle<{ playlist_id: string | null }>();
  if (error) {
    console.error("[spotify] getSpotifyIntegration:", error.code);
    throw new Error("Unable to load Spotify integration");
  }
  return data ? { playlistId: data.playlist_id } : null;
}

/**
 * Lie le compte Spotify au mariage après autorisation : crée la playlist si
 * le mariage n'en a pas encore pour ce compte, puis enregistre les jetons.
 */
export async function connectSpotify({
  weddingId,
  token,
  playlistName,
  playlistDescription,
}: {
  weddingId: string;
  token: TokenResponse;
  playlistName: string;
  playlistDescription: string;
}): Promise<void> {
  if (!token.refresh_token) throw new SpotifyError("generic");
  const admin = createAdminClient();

  const me = await spotifyApi<{ id: string }>(token.access_token, "/me");

  // Reconnexion du même compte : on garde la playlist existante.
  const { data: existing } = await admin
    .from("spotify_integrations")
    .select("spotify_user_id, playlist_id")
    .eq("wedding_id", weddingId)
    .maybeSingle<{ spotify_user_id: string | null; playlist_id: string | null }>();

  let playlistId =
    existing?.spotify_user_id === me.id && existing.playlist_id ? existing.playlist_id : null;
  if (!playlistId) {
    const playlist = await spotifyApi<{ id: string }>(token.access_token, "/me/playlists", {
      method: "POST",
      body: { name: playlistName, description: playlistDescription, public: false },
    });
    playlistId = playlist.id;
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("spotify_integrations").upsert({
    wedding_id: weddingId,
    spotify_user_id: me.id,
    refresh_token: token.refresh_token,
    access_token: token.access_token,
    access_token_expires_at: expiresAt(token.expires_in),
    playlist_id: playlistId,
    updated_at: now,
  });
  if (error) {
    console.error("[spotify] connectSpotify:", error.code);
    throw new SpotifyError("generic");
  }
}

/** Retire la liaison (les jetons sont effacés ; la playlist reste chez Spotify). */
export async function disconnectSpotifyIntegration(weddingId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("spotify_integrations")
    .delete()
    .eq("wedding_id", weddingId);
  if (error) {
    console.error("[spotify] disconnect:", error.code);
    throw new SpotifyError("generic");
  }
}
