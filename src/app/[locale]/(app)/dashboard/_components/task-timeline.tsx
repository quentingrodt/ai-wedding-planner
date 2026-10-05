"use client";

import { CheckIcon, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { updateTaskDate } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";
import { toggleTask } from "../actions";

/** Tâche prête à afficher : libellé traduit et échéance formatée côté serveur. */
export type TimelineTask = {
  id: string;
  label: string;
  /** Échéance ISO (YYYY-MM-DD), pour l'éditeur de date. */
  dueDate: string | null;
  /** Échéance déjà formatée, ou null si le mariage n'a pas de date. */
  dueLabel: string | null;
  overdue: boolean;
  done: boolean;
};

type Toggle = { id: string; done: boolean };

type TaskTimelineProps = {
  tasks: TimelineTask[];
  /** Dernière échéance possible (veille du mariage), ou null sans date de mariage. */
  latestDate: string | null;
};

/**
 * Timeline verticale des prochaines tâches : cochables avec retour instantané,
 * et échéances modifiables (les tâches dépendantes suivent, cf. updateTaskDate).
 */
export function TaskTimeline({ tasks, latestDate }: TaskTimelineProps) {
  const t = useTranslations("Dashboard.timeline");
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyToggle] = useOptimistic(
    tasks,
    (state: TimelineTask[], { id, done }: Toggle) =>
      state.map((task) => (task.id === id ? { ...task, done } : task)),
  );

  function toggle(task: TimelineTask, done: boolean) {
    startTransition(async () => {
      // Sans effet si la tâche a déjà quitté la liste (annulation) :
      // la revalidation la fera réapparaître.
      applyToggle({ id: task.id, done });
      const result = await toggleTask({ taskId: task.id, done });
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      if (done) {
        toast(t("doneToast", { task: task.label }), {
          action: { label: t("undo"), onClick: () => toggle(task, false) },
        });
      }
    });
  }

  return (
    <section
      aria-labelledby="timeline-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">
          {t("eyebrow")}
        </p>
        <h2 id="timeline-title" className="text-2xl">
          {t("title")}
        </h2>
      </div>

      {optimisticTasks.length === 0 ? (
        <p className="text-stone">{t("empty")}</p>
      ) : (
        <ol className="relative flex flex-col gap-6 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-sand">
          {optimisticTasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "relative flex items-start gap-4 transition-opacity duration-500",
                task.done && "opacity-50",
              )}
            >
              <span className="relative grid size-6 shrink-0 place-items-center">
                <input
                  type="checkbox"
                  id={`task-${task.id}`}
                  checked={task.done}
                  onChange={(event) => toggle(task, event.target.checked)}
                  className="peer size-6 cursor-pointer appearance-none rounded-full border border-sage bg-card transition-colors duration-300 checked:border-sage checked:bg-sage hover:bg-sage-soft checked:hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                <CheckIcon
                  aria-hidden
                  strokeWidth={2.5}
                  className="pointer-events-none absolute size-3.5 text-ivory opacity-0 transition-opacity duration-300 peer-checked:opacity-100"
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                <label
                  htmlFor={`task-${task.id}`}
                  className={cn(
                    "cursor-pointer wrap-break-word decoration-sage transition-colors",
                    task.done && "line-through",
                  )}
                >
                  {task.label}
                </label>
                <DueDate task={task} latestDate={latestDate} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Échéance d'une tâche, modifiable en place via un champ date discret. */
function DueDate({ task, latestDate }: { task: TimelineTask; latestDate: string | null }) {
  const t = useTranslations("Dashboard.timeline");
  const tTasks = useTranslations("Tasks");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.dueDate ?? "");
  const [pending, startTransition] = useTransition();

  const label = task.overdue
    ? t("overdue")
    : task.dueLabel === null
      ? t("noDate")
      : t("due", { date: task.dueLabel });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateTaskDate>>;
      try {
        result = await updateTaskDate(task.id, value);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (!result.ok) {
        toast.error(tTasks(result.error === "invalid" ? "toasts.invalid" : "toasts.error"));
        return;
      }
      setEditing(false);
      if (result.unchanged) {
        toast(tTasks("toasts.unchanged"));
        return;
      }
      toast.success(
        result.dependents > 0
          ? tTasks("toasts.updatedWithImpacts", { count: result.dependents })
          : tTasks("toasts.updated"),
        { description: result.capped ? tTasks("toasts.capped") : undefined },
      );
    });
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5">
        <span
          className={cn("text-sm", task.overdue && !task.done ? "text-terracotta" : "text-stone")}
        >
          {label}
        </span>
        {!task.done && (
          <button
            type="button"
            onClick={() => {
              setValue(task.dueDate ?? "");
              setEditing(true);
            }}
            aria-label={tTasks("editDate", { task: task.label })}
            className="rounded-full p-1 text-stone/60 transition-colors hover:bg-linen hover:text-terracotta focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PencilLine className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </span>
    );
  }

  return (
    <form onSubmit={save} className="mt-1 flex flex-wrap items-center gap-2" aria-busy={pending}>
      <label className="sr-only" htmlFor={`due-${task.id}`}>
        {tTasks("dateLabel")}
      </label>
      <input
        id={`due-${task.id}`}
        type="date"
        value={value}
        max={latestDate ?? undefined}
        onChange={(event) => setValue(event.target.value)}
        disabled={pending}
        autoFocus
        className="h-9 rounded-lg border border-input bg-ivory px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring"
      />
      <button
        type="submit"
        disabled={pending || !value}
        className="h-9 rounded-full bg-sage-deep px-4 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f] disabled:opacity-60"
      >
        {tTasks("save")}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        className="h-9 rounded-full px-3 text-sm text-stone transition-colors hover:text-charcoal"
      >
        {tTasks("cancel")}
      </button>
      {latestDate && <p className="w-full text-xs text-stone/80">{tTasks("latestHint")}</p>}
    </form>
  );
}
