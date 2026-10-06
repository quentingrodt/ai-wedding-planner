import { describe, expect, it } from "vitest";
import { addMonths, monthGrid, monthsBetween, WEEKDAY_SAMPLE } from "./month";

describe("monthGrid", () => {
  it("commence un lundi et couvre tout le mois", () => {
    // Octobre 2026 : du jeudi 1er au samedi 31.
    const weeks = monthGrid("2026-10");
    expect(weeks[0][0]).toEqual({ date: "2026-09-28", inMonth: false });
    expect(weeks[0][3]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(weeks.at(-1)?.at(-1)).toEqual({ date: "2026-11-01", inMonth: false });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(weeks).toHaveLength(5);
  });

  it("gère un mois de 4 et de 6 semaines", () => {
    // Février 2027 commence un lundi et dure 28 jours.
    expect(monthGrid("2027-02")).toHaveLength(4);
    // Août 2027 commence un dimanche.
    expect(monthGrid("2027-08")).toHaveLength(6);
  });
});

describe("addMonths / monthsBetween", () => {
  it("passe les années", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(monthsBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(monthsBetween("2027-02", "2026-11")).toEqual([]);
  });

  it("fournit une semaine type commençant un lundi", () => {
    expect(WEEKDAY_SAMPLE[0]).toBe("2024-01-01");
    expect(new Date(`${WEEKDAY_SAMPLE[0]}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});
