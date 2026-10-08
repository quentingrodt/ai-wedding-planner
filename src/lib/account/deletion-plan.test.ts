import { describe, expect, it } from "vitest";
import { planAccountDeletion } from "./deletion-plan";

const ME = "me";

describe("planAccountDeletion", () => {
  it("supprime le mariage dont la personne est seule à se marier, témoins compris", () => {
    const plan = planAccountDeletion(ME, [
      {
        id: "w1",
        title: "Léa & Tom",
        members: [
          { user_id: ME, role: "owner" },
          { user_id: "witness", role: "witness" },
        ],
      },
    ]);
    expect(plan).toEqual({ deleted: [{ id: "w1", title: "Léa & Tom" }], kept: [], left: [] });
  });

  it("garde le mariage pour l'autre marié et le rend propriétaire", () => {
    const plan = planAccountDeletion(ME, [
      {
        id: "w1",
        title: "Léa & Tom",
        members: [
          { user_id: ME, role: "owner" },
          { user_id: "partner", role: "partner" },
        ],
      },
    ]);
    expect(plan.kept).toEqual([{ id: "w1", title: "Léa & Tom", promote: "partner" }]);
    expect(plan.deleted).toEqual([]);
  });

  it("ne promeut personne si un propriétaire reste", () => {
    const plan = planAccountDeletion(ME, [
      {
        id: "w1",
        title: "Léa & Tom",
        members: [
          { user_id: "owner", role: "owner" },
          { user_id: ME, role: "partner" },
        ],
      },
    ]);
    expect(plan.kept).toEqual([{ id: "w1", title: "Léa & Tom", promote: null }]);
  });

  it("quitte simplement les mariages où la personne est témoin", () => {
    const plan = planAccountDeletion(ME, [
      {
        id: "w2",
        title: "Inès & Sam",
        members: [
          { user_id: "owner", role: "owner" },
          { user_id: ME, role: "witness" },
        ],
      },
    ]);
    expect(plan).toEqual({ deleted: [], kept: [], left: [{ id: "w2", title: "Inès & Sam" }] });
  });

  it("ignore un mariage dont la personne n'est pas membre", () => {
    const plan = planAccountDeletion(ME, [
      { id: "w3", title: "Autre", members: [{ user_id: "x", role: "owner" }] },
    ]);
    expect(plan).toEqual({ deleted: [], kept: [], left: [] });
  });
});
