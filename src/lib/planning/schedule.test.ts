import { describe, expect, it } from "vitest";
import { addDaysToIsoDate } from "@/lib/weddings/dates";
import { DONE_OPTION_TASKS, TASK_CATALOG } from "./catalog";
import { buildSchedule, type PlanningSchedule } from "./schedule";
import { DEFAULT_PLANNING_ANSWERS, DONE_OPTIONS, type PlanningAnswers } from "./schema";

const TODAY = "2026-10-06";

function plan(
  horizonDays: number,
  answers: Partial<PlanningAnswers> = {},
  countryCode: string | null = "FR",
): PlanningSchedule {
  return buildSchedule({
    weddingDate: addDaysToIsoDate(TODAY, horizonDays),
    today: TODAY,
    answers: { ...DEFAULT_PLANNING_ANSWERS, ...answers },
    countryCode,
  });
}

const task = (schedule: PlanningSchedule, key: string) =>
  schedule.tasks.find((candidate) => candidate.key === key);

describe("TASK_CATALOG", () => {
  it("a des clés uniques au format template_key", () => {
    const keys = TASK_CATALOG.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]{0,63}$/);
  });

  it("place chaque parente avant ses dépendantes", () => {
    const seen = new Set<string>();
    for (const definition of TASK_CATALOG) {
      if ("dependsOn" in definition) expect(seen).toContain(definition.dependsOn);
      seen.add(definition.key);
    }
  });

  it("a des délais cohérents (1 ≤ plancher ≤ idéal ≤ 1000)", () => {
    for (const { floor, ideal } of TASK_CATALOG) {
      expect(floor).toBeGreaterThanOrEqual(1);
      expect(floor).toBeLessThanOrEqual(ideal);
      expect(ideal).toBeLessThanOrEqual(1000);
    }
  });

  it("rattache chaque étape « déjà réglée » à des tâches du catalogue", () => {
    const keys = new Set<string>(TASK_CATALOG.map((definition) => definition.key));
    for (const option of DONE_OPTIONS) {
      for (const key of DONE_OPTION_TASKS[option]) expect(keys).toContain(key);
    }
  });
});

describe("buildSchedule", () => {
  it("ne planifie rien si le mariage est demain ou passé", () => {
    expect(plan(1).tasks).toEqual([]);
    expect(plan(-10).tasks).toEqual([]);
  });

  it("respecte les échéances idéales avec plus d'un an devant soi", () => {
    const schedule = plan(500);
    expect(schedule.compression).toBe(1);
    expect(task(schedule, "book_photographer")?.daysBefore).toBe(270);
    expect(task(schedule, "send_invitations")?.daysBefore).toBe(120);
    expect(task(schedule, "seating_plan")?.daysBefore).toBe(30);
    expect(schedule.tasks.every((t) => t.pace === "comfortable")).toBe(true);
  });

  it("lance budget, invités et mairie sous deux semaines, même à deux ans", () => {
    const schedule = plan(730);
    const inTwoWeeks = addDaysToIsoDate(TODAY, 14);
    expect(task(schedule, "set_budget")?.dueDate).toBe(inTwoWeeks);
    expect(task(schedule, "guest_list")?.dueDate).toBe(inTwoWeeks);
    expect(task(schedule, "book_town_hall")?.dueDate).toBe(inTwoWeeks);
    // Le lieu suit la liste d'invités d'une semaine.
    expect(task(schedule, "book_venue")?.dueDate).toBe(addDaysToIsoDate(TODAY, 21));
  });

  it("compresse un mariage dans 3 mois sans tâche irréaliste", () => {
    const schedule = plan(90);
    expect(schedule.tasks.some((t) => t.pace === "urgent")).toBe(false);
    expect(task(schedule, "book_venue")?.pace).toBe("tight");
    // Les faire-part gardent leur plancher (J-42) en ligne de mire.
    expect(task(schedule, "send_invitations")?.daysBefore).toBeGreaterThanOrEqual(42);
    expect(task(schedule, "save_the_date")).toBeUndefined();
  });

  it("signale les tâches intenables à 6 semaines", () => {
    const schedule = plan(42);
    expect(task(schedule, "book_venue")?.pace).toBe("urgent");
    expect(task(schedule, "send_invitations")?.pace).toBe("urgent");
    expect(task(schedule, "emergency_kit")?.pace).not.toBe("urgent");
  });

  it("étale la file des tâches à lancer tout de suite, deux par jour", () => {
    // À 3 mois, le premier jour possible est J-83 (une semaine pour démarrer).
    const schedule = plan(90);
    const firstDay = schedule.tasks.filter((t) => t.daysBefore === 83);
    expect(firstDay.length).toBeGreaterThan(0);
    expect(firstDay.length).toBeLessThanOrEqual(2);
  });

  it("allonge les délais des tenues sur mesure", () => {
    const ready = plan(500, { attire: "ready" });
    const custom = plan(500, { attire: "custom" });
    expect(task(custom, "order_attire")!.daysBefore).toBeGreaterThan(
      task(ready, "order_attire")!.daysBefore,
    );
  });

  it("ajoute les étapes des traditions choisies", () => {
    expect(task(plan(365, { traditions: [] }), "order_favors")).toBeUndefined();
    expect(task(plan(365, { traditions: ["favors"] }), "order_favors")).toBeDefined();
    expect(task(plan(365, { traditions: [] }), "bachelor_parties")).toBeUndefined();
  });

  it.each([2, 5, 10, 30, 60, 90, 180, 270, 365, 500, 730, 900])(
    "à J-%i : échéances entre demain et la veille, dépendances respectées",
    (horizon) => {
      const schedule = plan(horizon, {
        religiousCeremony: true,
        secularCeremony: true,
        videographer: true,
        guestAccommodation: true,
        marriageContract: true,
      });
      const wedding = addDaysToIsoDate(TODAY, horizon);
      for (const t of schedule.tasks) {
        expect(t.dueDate > TODAY).toBe(true);
        expect(t.dueDate < wedding).toBe(true);
        expect(t.targetOffsetDays).toBe(-t.daysBefore);
        if (t.dependsOn) {
          const parent = task(schedule, t.dependsOn);
          expect(parent).toBeDefined();
          expect(t.daysBefore < parent!.daysBefore || t.daysBefore === 1).toBe(true);
        }
      }
      const dates = schedule.tasks.map((t) => t.dueDate);
      expect(dates).toEqual([...dates].sort());
    },
  );

  it("adapte la liste aux réponses du questionnaire", () => {
    const base = plan(365);
    expect(task(base, "book_officiant")).toBeUndefined();
    expect(task(base, "religious_preparation")).toBeUndefined();

    const tailored = plan(365, {
      religiousCeremony: true,
      cateringByVenue: true,
      music: "none",
    });
    expect(task(tailored, "book_officiant")).toBeDefined();
    expect(task(tailored, "religious_preparation")).toBeDefined();
    expect(task(tailored, "book_catering")).toBeUndefined();
    expect(task(tailored, "taste_menu")?.dependsOn).toBeNull();
    expect(task(tailored, "book_dj")).toBeUndefined();
    expect(task(tailored, "playlist")).toBeUndefined();
  });

  it("retire les démarches françaises hors de France", () => {
    const schedule = plan(365, {}, "BE");
    expect(task(schedule, "town_hall_file")).toBeUndefined();
    expect(task(schedule, "book_town_hall")).toBeUndefined();
    expect(task(schedule, "book_venue")).toBeDefined();
  });
});
