import { describe, expect, it } from "vitest";
import { progressRatio, weddingPhase } from "./progress";

describe("weddingPhase", () => {
  it("suit le temps restant avant le mariage", () => {
    expect(weddingPhase(700)).toBe("foundations");
    expect(weddingPhase(366)).toBe("foundations");
    expect(weddingPhase(365)).toBe("bookings");
    expect(weddingPhase(181)).toBe("bookings");
    expect(weddingPhase(180)).toBe("details");
    expect(weddingPhase(31)).toBe("details");
    expect(weddingPhase(30)).toBe("finalStretch");
    expect(weddingPhase(0)).toBe("finalStretch");
  });

  it("n'affiche rien sans date ou après le mariage", () => {
    expect(weddingPhase(null)).toBeNull();
    expect(weddingPhase(-1)).toBeNull();
  });
});

describe("progressRatio", () => {
  it("rapporte les étapes terminées au total", () => {
    expect(progressRatio({ done: 7, total: 28 })).toBe(0.25);
    expect(progressRatio({ done: 0, total: 0 })).toBeNull();
  });
});
