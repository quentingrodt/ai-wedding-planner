"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanOf } from "@/lib/vendors/plans";
import { gettingReadySchedule, READY_MARGIN_MINUTES, type ReadySlot } from "@/lib/vendors/tools";
import { onlyDigits } from "../vendor-form-sections";
import { PlanCard, usePlan } from "./plan-card";

const MAX_PEOPLE = 20;

/** Le matin du mariage : qui passe chez la coiffeuse et la maquilleuse, et à quelle heure. */
export function GettingReadyTools({ initial }: { initial: PlanOf<"hair"> }) {
  const t = useTranslations("Vendors.tools.ready");
  const tTools = useTranslations("Vendors.tools");
  const { plan, setPlan, dirty, pending, save } = usePlan("hair", initial);
  // La mariée ouvre toujours la liste ; elle passera en dernier.
  const people = plan.people.length > 0 ? plan.people : [{ name: t("bride"), hair: true, makeup: true }];
  const update = (next: typeof people) => setPlan({ ...plan, people: next });
  const schedule = plan.readyBy
    ? gettingReadySchedule(people, plan.readyBy, { hair: plan.hairMinutes, makeup: plan.makeupMinutes })
    : null;

  const minutesField = (key: "hairMinutes" | "makeupMinutes") => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{t(key)}</span>
      <span className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={String(plan[key])}
          onChange={(event) => {
            const value = Number.parseInt(onlyDigits(event.target.value, 3), 10);
            setPlan({ ...plan, [key]: Number.isFinite(value) ? Math.min(180, value) : 10 });
          }}
          className="h-10 w-20 rounded-xl bg-card"
        />
        <span className="text-sm text-stone">{t("minutes")}</span>
      </span>
    </label>
  );

  return (
    <PlanCard title={t("title")} lead={t("lead")} dirty={dirty} pending={pending} onSave={save}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("readyBy")}</span>
          <Input
            type="time"
            value={plan.readyBy}
            onChange={(event) => setPlan({ ...plan, readyBy: event.target.value })}
            className="h-10 w-32 rounded-xl bg-card"
          />
        </label>
        {minutesField("hairMinutes")}
        {minutesField("makeupMinutes")}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("people")}</p>
        <ul className="flex flex-col gap-2">
          {people.map((person, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 rounded-xl bg-linen/50 px-3 py-2">
              <Input
                value={person.name}
                maxLength={60}
                placeholder={t("personPlaceholder")}
                aria-label={t("personPlaceholder")}
                onChange={(event) =>
                  update(people.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))
                }
                className="h-9 min-w-32 flex-1 rounded-lg bg-card"
              />
              {(["hair", "makeup"] as const).map((service) => (
                <label key={service} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={person[service]}
                    onChange={(event) =>
                      update(
                        people.map((entry, position) =>
                          position === index ? { ...entry, [service]: event.target.checked } : entry,
                        ),
                      )
                    }
                    className="size-4 accent-sage-deep"
                  />
                  {t(service)}
                </label>
              ))}
              {index > 0 && (
                <button
                  type="button"
                  aria-label={tTools("remove")}
                  onClick={() => update(people.filter((_, position) => position !== index))}
                  className="rounded-full p-1 text-stone hover:text-terracotta"
                >
                  <XIcon aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {people.length < MAX_PEOPLE && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit rounded-full"
            onClick={() => update([...people, { name: "", hair: true, makeup: true }])}
          >
            <PlusIcon aria-hidden />
            {tTools("add")}
          </Button>
        )}
      </div>

      {schedule ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-sage-soft/40 p-4">
          {schedule.start && <p className="font-serif text-xl">{t("start", { time: schedule.start })}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Lane title={t("hair")} slots={schedule.hair} />
            <Lane title={t("makeup")} slots={schedule.makeup} />
          </div>
          <p className="text-xs text-stone">{t("margin", { minutes: READY_MARGIN_MINUTES })}</p>
        </div>
      ) : (
        <p className="text-sm text-stone">{t("needTime")}</p>
      )}
    </PlanCard>
  );
}

function Lane({ title, slots }: { title: string; slots: ReadySlot[] }) {
  const t = useTranslations("Vendors.tools.ready");
  if (slots.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">{title}</p>
      <ol className="flex flex-col gap-1">
        {slots.map((slot, index) => (
          <li key={`${slot.name}-${index}`} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{slot.name || "—"}</span>
            <span className="shrink-0 text-stone tabular-nums">{t("slot", { start: slot.start, end: slot.end })}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
