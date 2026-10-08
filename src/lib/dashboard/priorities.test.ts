import { describe, expect, it } from "vitest";
import type { BudgetItem } from "@/lib/budget/schema";
import type { CalendarEvent } from "@/lib/calendar/schema";
import type { UpcomingPayment } from "@/lib/vendors/payments";
import type { Vendor } from "@/lib/vendors/schema";
import { addDaysToIsoDate } from "@/lib/weddings/dates";
import { budgetHighlights, buildPriorities, isLate, MAX_PRIORITIES, type PriorityInput } from "./priorities";

const TODAY = "2026-10-08";

const payment = (days: number | null): UpcomingPayment => ({
  kind: "deposit",
  amount: 500,
  due: days === null ? null : addDaysToIsoDate(TODAY, days),
  paid: false,
  days,
  vendor: { id: `v${days}`, name: "Traiteur", category: "catering" } as Vendor,
});

const event = (date: string): CalendarEvent => ({
  id: date,
  kind: "tasting",
  title: "Dégustation",
  event_date: date,
  start_time: null,
  location: null,
  notes: null,
});

const input = (overrides: Partial<PriorityInput>): PriorityInput => ({
  today: TODAY,
  overdueTasks: 0,
  payments: [],
  events: [],
  pendingGuests: null,
  ...overrides,
});

describe("buildPriorities", () => {
  it("ne remonte rien quand tout est à jour", () => {
    expect(buildPriorities(input({}))).toEqual([]);
  });

  it("classe les retards avant le reste", () => {
    const priorities = buildPriorities(
      input({
        overdueTasks: 2,
        payments: [payment(5), payment(-3)],
        events: [event("2026-10-10")],
      }),
    );
    expect(priorities.map((priority) => priority.kind)).toEqual(["payment", "overdueTasks", "event", "payment"]);
    expect(priorities.filter(isLate)).toHaveLength(2);
  });

  it("garde les échéances lointaines mais ignore les versements sans date", () => {
    const priorities = buildPriorities(input({ payments: [payment(400), payment(null)] }));
    expect(priorities).toHaveLength(1);
    expect(priorities[0]).toMatchObject({ kind: "payment", payment: { days: 400, due: "2027-11-12" } });
  });

  it("mêle versements et rendez-vous dans l'ordre chronologique, sans les rendez-vous passés", () => {
    const priorities = buildPriorities(
      input({
        payments: [payment(200)],
        events: [event("2026-10-01"), event("2027-01-15"), event("2027-09-01")],
      }),
    );
    expect(priorities.map((priority) => (priority.kind === "event" ? priority.days : priority.kind))).toEqual([
      99,
      "payment",
      328,
    ]);
  });

  it("place les réponses attendues après les échéances datées", () => {
    const priorities = buildPriorities(input({ pendingGuests: 12, events: [event("2027-06-01")] }));
    expect(priorities.map((priority) => priority.kind)).toEqual(["event", "rsvp"]);
  });

  it(`n'affiche pas plus de ${MAX_PRIORITIES} priorités`, () => {
    const payments = [1, 2, 3, 4, 5, 6].map(payment);
    expect(buildPriorities(input({ payments }))).toHaveLength(MAX_PRIORITIES);
  });
});

const item = (id: string, estimated: number, actual: number | null) =>
  ({ id, category: "other", estimated_amount: estimated, actual_amount: actual }) as BudgetItem;

describe("budgetHighlights", () => {
  it("met en avant les dépassements, du plus fort au plus faible", () => {
    const highlights = budgetHighlights([item("a", 1000, 1100), item("b", 500, 400), item("c", 200, 600)]);
    expect(highlights.mode).toBe("over");
    expect(highlights.items.map((line) => line.id)).toEqual(["c", "a"]);
  });

  it("montre sinon les trois plus gros postes prévus", () => {
    const highlights = budgetHighlights([
      item("a", 100, null),
      item("b", 900, null),
      item("c", 0, null),
      item("d", 400, 400),
      item("e", 600, null),
    ]);
    expect(highlights.mode).toBe("largest");
    expect(highlights.items.map((line) => line.id)).toEqual(["b", "e", "d"]);
  });
});
