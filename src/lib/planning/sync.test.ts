import { describe, expect, it } from "vitest";
import type { ScheduledTask } from "./schedule";
import { planTaskSync, type ExistingTask } from "./sync";

const scheduled = (key: ScheduledTask["key"], dueDate: string, daysBefore: number): ScheduledTask => ({
  key,
  category: "vendors",
  priority: 1,
  dependsOn: null,
  href: null,
  daysBefore,
  targetOffsetDays: -daysBefore,
  dueDate,
  pace: "comfortable",
});

const row = (overrides: Partial<ExistingTask> & { id: string }): ExistingTask => ({
  template_key: "book_photographer",
  status: "todo",
  rescheduled: false,
  due_date: "2027-01-01",
  target_offset_days: -300,
  category: "vendors",
  depends_on_key: null,
  ...overrides,
});

describe("planTaskSync", () => {
  it("crée les tâches absentes et recale celles qui restent à faire", () => {
    const plan = planTaskSync(
      [row({ id: "a" })],
      [scheduled("book_photographer", "2027-02-01", 270), scheduled("book_cake", "2027-06-01", 150)],
    );
    expect(plan.inserts.map((task) => task.key)).toEqual(["book_cake"]);
    expect(plan.updates).toEqual([
      { id: "a", values: { due_date: "2027-02-01", target_offset_days: -270 } },
    ]);
    expect(plan.deletes).toEqual([]);
  });

  it("préserve l'échéance d'une tâche terminée ou déplacée à la main", () => {
    const plan = planTaskSync(
      [
        row({ id: "done", status: "done" }),
        row({ id: "moved", template_key: "book_cake", rescheduled: true, category: null }),
      ],
      [scheduled("book_photographer", "2027-02-01", 270), scheduled("book_cake", "2027-06-01", 150)],
    );
    expect(plan.updates).toEqual([{ id: "moved", values: { category: "vendors" } }]);
  });

  it("supprime les tâches écartées qui restent à faire, garde celles terminées", () => {
    const plan = planTaskSync(
      [
        row({ id: "dj", template_key: "book_dj" }),
        row({ id: "dj-done", template_key: "book_catering", status: "done" }),
        row({ id: "free", template_key: null }),
      ],
      [],
    );
    expect(plan.deletes).toEqual(["dj"]);
  });

  it("coche les étapes déjà réglées, sans jamais décocher", () => {
    const plan = planTaskSync(
      [row({ id: "a" }), row({ id: "b", template_key: "book_cake", status: "done" })],
      [
        scheduled("book_photographer", "2027-01-01", 300),
        scheduled("book_cake", "2027-06-01", 150),
        scheduled("book_venue", "2026-11-01", 330),
      ],
      new Set(["book_photographer", "book_venue"]),
    );
    expect(plan.updates).toEqual([{ id: "a", values: { status: "done" } }]);
    expect(plan.inserts.map(({ key, done }) => ({ key, done }))).toEqual([
      { key: "book_venue", done: true },
    ]);
  });

  it("supprime un doublon resté à faire", () => {
    const plan = planTaskSync(
      [row({ id: "a" }), row({ id: "b" })],
      [scheduled("book_photographer", "2027-01-01", 300)],
    );
    expect(plan.deletes).toEqual(["b"]);
    expect(plan.updates).toEqual([]);
  });
});
