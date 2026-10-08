import { describe, expect, it } from "vitest";
import {
  durationParts,
  formatTrackDuration,
  groupBySection,
  newTrackSchema,
  playlistDuration,
  type PlaylistTrack,
} from "./schema";

const track = (id: string, overrides: Partial<PlaylistTrack> = {}): PlaylistTrack => ({
  id,
  spotify_id: id.padEnd(22, "0"),
  name: id,
  artist: "Artiste",
  cover_url: null,
  duration_ms: 180_000,
  section: "party",
  status: "approved",
  created_by: "user",
  created_at: "2026-10-08T10:00:00Z",
  ...overrides,
});

describe("groupBySection", () => {
  it("suit l'ordre de la journée, omet les moments vides et les propositions", () => {
    const groups = groupBySection([
      track("a", { section: "party" }),
      track("b", { section: "do_not_play" }),
      track("c", { section: "ceremony_entrance" }),
      track("d", { section: "party", status: "suggested" }),
      track("e", { section: "party" }),
    ]);
    expect(groups.map((group) => [group.section, group.tracks.map((item) => item.id)])).toEqual([
      ["ceremony_entrance", ["c"]],
      ["party", ["a", "e"]],
      ["do_not_play", ["b"]],
    ]);
  });
});

describe("playlistDuration", () => {
  it("compte les morceaux validés à jouer seulement", () => {
    expect(
      playlistDuration([
        track("a"),
        track("b", { duration_ms: null }),
        track("c", { section: "do_not_play" }),
        track("d", { status: "suggested" }),
        track("e", { duration_ms: 60_000 }),
      ]),
    ).toBe(240_000);
  });
});

describe("durationParts", () => {
  it("découpe en heures et minutes sur deux chiffres", () => {
    expect(durationParts(8_100_000)).toEqual({ hours: 2, minutes: "15" });
    expect(durationParts(1_500_000)).toEqual({ hours: 0, minutes: "25" });
    expect(durationParts(3_629_000)).toEqual({ hours: 1, minutes: "00" });
  });
});

describe("formatTrackDuration", () => {
  it("écrit minutes et secondes", () => {
    expect(formatTrackDuration(207_400)).toBe("3:27");
    expect(formatTrackDuration(59_600)).toBe("1:00");
  });
});

describe("newTrackSchema", () => {
  const valid = {
    spotify_id: "0tgVpDi06FyKpA1z0VMD4v",
    name: "Perfect",
    artist: "Ed Sheeran",
    cover_url: "https://i.scdn.co/image/ab67616d00001e02ba5db46f4b838ef6027e6f96",
    duration_ms: 263_400,
    section: "first_dance",
  };

  it("accepte un morceau du catalogue", () => {
    expect(newTrackSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse une pochette hors du CDN Spotify ou un moment inconnu", () => {
    expect(newTrackSchema.safeParse({ ...valid, cover_url: "https://example.com/x.jpg" }).success).toBe(false);
    expect(newTrackSchema.safeParse({ ...valid, section: "brunch" }).success).toBe(false);
    expect(newTrackSchema.safeParse({ ...valid, spotify_id: "short" }).success).toBe(false);
  });
});
