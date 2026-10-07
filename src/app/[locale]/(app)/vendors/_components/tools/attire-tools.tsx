"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEASUREMENTS, type PlanOf } from "@/lib/vendors/plans";
import { PlanCard, usePlan } from "./plan-card";

const MAX_ROWS = 20;
const cell = "h-9 min-w-0 rounded-lg bg-card text-sm";

/** Alliances : la taille de chacune. */
export function RingsTools({ initial }: { initial: PlanOf<"rings"> }) {
  const t = useTranslations("Vendors.tools.rings");
  const { plan, setPlan, dirty, pending, save } = usePlan("rings", initial);
  return (
    <PlanCard title={t("title")} dirty={dirty} pending={pending} onSave={save}>
      <div className="flex flex-wrap gap-4">
        {(["brideSize", "groomSize"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t(key)}</span>
            <Input
              value={plan[key]}
              maxLength={10}
              onChange={(event) => setPlan({ ...plan, [key]: event.target.value })}
              className="h-10 w-28 rounded-xl bg-card"
            />
          </label>
        ))}
      </div>
    </PlanCard>
  );
}

/** Demoiselles d'honneur : taille et couleur de chacune. */
export function BridesmaidsTools({ initial }: { initial: PlanOf<"bridesmaids"> }) {
  const t = useTranslations("Vendors.tools");
  const { plan, setPlan, dirty, pending, save } = usePlan("bridesmaids", initial);
  const rows = plan.members;
  const update = (members: typeof rows) => setPlan({ ...plan, members });
  const columns = ["name", "size", "style"] as const;

  return (
    <PlanCard title={t("bridesmaids.title")} dirty={dirty} pending={pending} onSave={save}>
      <RowsTable
        headers={columns.map((column) => t(`bridesmaids.${column}`))}
        rows={rows.map((row, index) => (
          <Row key={index} onRemove={() => update(rows.filter((_, position) => position !== index))}>
            {columns.map((column) => (
              <Input
                key={column}
                value={row[column]}
                maxLength={column === "name" ? 60 : column === "size" ? 20 : 80}
                aria-label={t(`bridesmaids.${column}`)}
                onChange={(event) =>
                  update(rows.map((entry, position) => (position === index ? { ...entry, [column]: event.target.value } : entry)))
                }
                className={cell}
              />
            ))}
          </Row>
        ))}
        canAdd={rows.length < MAX_ROWS}
        onAdd={() => update([...rows, { name: "", size: "", style: "" }])}
        columns="grid-cols-[2fr_1fr_2fr_auto]"
      />
    </PlanCard>
  );
}

/** Costume du marié : ses mensurations. */
export function GroomSuitTools({ initial }: { initial: PlanOf<"groom_suit"> }) {
  const t = useTranslations("Vendors.tools.measures");
  const { plan, setPlan, dirty, pending, save } = usePlan("groom_suit", initial);
  return (
    <PlanCard title={t("groomTitle")} dirty={dirty} pending={pending} onSave={save}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {MEASUREMENTS.map((key) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t(`fields.${key}`)}</span>
            <Input
              value={plan.measures[key] ?? ""}
              maxLength={20}
              onChange={(event) => setPlan({ ...plan, measures: { ...plan.measures, [key]: event.target.value } })}
              className="h-10 rounded-xl bg-card"
            />
          </label>
        ))}
      </div>
    </PlanCard>
  );
}

/** Garçons d'honneur : les mensurations de chacun. */
export function GroomsmenTools({ initial }: { initial: PlanOf<"groomsmen"> }) {
  const t = useTranslations("Vendors.tools.measures");
  const { plan, setPlan, dirty, pending, save } = usePlan("groomsmen", initial);
  const rows = plan.members;
  const update = (members: typeof rows) => setPlan({ ...plan, members });
  const columns = ["name", ...MEASUREMENTS, "notes"] as const;
  const label = (column: (typeof columns)[number]) =>
    column === "name" || column === "notes" ? t(column) : t(`fields.${column}`);

  return (
    <PlanCard title={t("groomsmenTitle")} dirty={dirty} pending={pending} onSave={save}>
      <div className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <RowsTable
            headers={columns.map(label)}
            rows={rows.map((row, index) => (
              <Row key={index} onRemove={() => update(rows.filter((_, position) => position !== index))}>
                {columns.map((column) => (
                  <Input
                    key={column}
                    value={row[column] ?? ""}
                    maxLength={column === "name" ? 60 : column === "notes" ? 120 : 20}
                    aria-label={label(column)}
                    onChange={(event) =>
                      update(rows.map((entry, position) => (position === index ? { ...entry, [column]: event.target.value } : entry)))
                    }
                    className={cell}
                  />
                ))}
              </Row>
            ))}
            canAdd={rows.length < MAX_ROWS}
            onAdd={() => update([...rows, { name: "", notes: "" }])}
            columns="grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_2fr_auto]"
          />
        </div>
      </div>
    </PlanCard>
  );
}

function RowsTable({
  headers,
  rows,
  canAdd,
  onAdd,
  columns,
}: {
  headers: string[];
  rows: ReactNode[];
  canAdd: boolean;
  onAdd: () => void;
  /** Gabarit de grille partagé par l'en-tête et les lignes. */
  columns: string;
}) {
  const t = useTranslations("Vendors.tools");
  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div className={`grid ${columns} gap-2 px-1 text-xs text-stone`}>
          {headers.map((header) => (
            <span key={header} className="truncate">{header}</span>
          ))}
          <span className="w-7" />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={index} className={`grid ${columns} items-center gap-2`}>
            {row}
          </li>
        ))}
      </ul>
      {canAdd && (
        <Button variant="outline" size="sm" className="w-fit rounded-full" onClick={onAdd}>
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
      )}
    </div>
  );
}

/** Contenu d'une ligne : ses champs puis le bouton pour la retirer. */
function Row({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const t = useTranslations("Vendors.tools");
  return (
    <>
      {children}
      <button
        type="button"
        aria-label={t("remove")}
        onClick={onRemove}
        className="flex size-7 items-center justify-center rounded-full text-stone hover:text-terracotta"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </>
  );
}
