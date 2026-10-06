"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TASK_CATEGORIES } from "@/lib/planning/schema";
import { addTask } from "@/lib/tasks/actions";
import {
  TASK_TITLE_MAX,
  addTaskSchema,
  type AddTaskField,
  type AddTaskInput,
} from "@/lib/tasks/schema";

type AddTaskDialogProps = {
  /** Première date proposée (aujourd'hui) et dernière possible (veille du mariage). */
  minDate: string;
  latestDate: string | null;
};

/** Ajout d'une étape personnelle au rétroplanning, en modale. */
export function AddTaskDialog({ minDate, latestDate }: AddTaskDialogProps) {
  const t = useTranslations("Planning.add");
  const tCategories = useTranslations("Planning.categories");
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<AddTaskField, true>>>({});
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: AddTaskInput = {
      title: String(data.get("title") ?? ""),
      dueDate: String(data.get("dueDate") ?? ""),
      category: String(data.get("category") ?? "") as AddTaskInput["category"],
    };
    const parsed = addTaskSchema.safeParse(input);
    if (!parsed.success) {
      const next: Partial<Record<AddTaskField, true>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "title" || field === "dueDate") next[field] = true;
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof addTask>>;
      try {
        result = await addTask(input);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (!result.ok) {
        if (result.error === "tooLate") {
          setErrors({ dueDate: true });
          return;
        }
        toast.error(t("error"));
        return;
      }
      toast.success(t("added", { task: parsed.data.title }));
      changeOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-sage-deep px-5 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
        >
          <PlusIcon aria-hidden className="size-4" />
          {t("trigger")}
        </button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate aria-busy={pending}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">{t("fields.title")}</Label>
            <Input
              id="task-title"
              name="title"
              autoComplete="off"
              placeholder={t("fields.titlePlaceholder")}
              maxLength={TASK_TITLE_MAX}
              required
              aria-invalid={errors.title}
              aria-describedby={errors.title ? "task-title-error" : undefined}
              className="h-11 text-base"
            />
            {errors.title && (
              <p id="task-title-error" className="text-sm text-destructive">
                {t("errors.title")}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-dueDate">{t("fields.dueDate")}</Label>
              <Input
                id="task-dueDate"
                name="dueDate"
                type="date"
                min={minDate}
                max={latestDate ?? undefined}
                required
                aria-invalid={errors.dueDate}
                aria-describedby={errors.dueDate ? "task-dueDate-error" : undefined}
                className="h-11 text-base tabular-nums"
              />
              {errors.dueDate && (
                <p id="task-dueDate-error" className="text-sm text-destructive">
                  {t("errors.dueDate")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-category">{t("fields.category")}</Label>
              <select
                id="task-category"
                name="category"
                defaultValue=""
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">{t("fields.noCategory")}</option>
                {TASK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {tCategories(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
