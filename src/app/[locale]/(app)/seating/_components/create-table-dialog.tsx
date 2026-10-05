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
import {
  SEATING_LIMITS,
  type TableField,
  type TableFieldError,
} from "@/lib/seating/schema";
import { createTable } from "../actions";

type FieldErrors = Partial<Record<TableField, TableFieldError>>;

const DEFAULT_CAPACITY = 8;

/** Bouton « Nouvelle table » et son formulaire en modale. */
export function CreateTableDialog() {
  const t = useTranslations("Seating");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Le contenu de la modale est démonté à la fermeture : la saisie repart à zéro.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setFieldErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    // Saisie vide ou invalide → NaN, refusé par le schéma Zod.
    const capacity = Number.parseInt(String(data.get("capacity") ?? ""), 10);

    startTransition(async () => {
      const result = await createTable(name, capacity);
      if (result.ok) {
        toast(t("create.success", { name: name.trim() }));
        changeOpen(false);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      if (result.error !== "invalid") toast.error(t(`errors.${result.error}`, { name }));
    });
  }

  const fieldProps = (field: TableField) => {
    const error = fieldErrors[field];
    return {
      id: `table-${field}`,
      name: field,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `table-${field}-error` : undefined,
    };
  };

  const fieldError = (field: TableField) => {
    const error = fieldErrors[field];
    return error ? (
      <p id={`table-${field}-error`} className="text-sm text-destructive">
        {t(`fieldErrors.${error}`, { max: SEATING_LIMITS.capacity })}
      </p>
    ) : null;
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 rounded-full px-5">
          <PlusIcon aria-hidden />
          {t("create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("create.close")}
        className="gap-6 rounded-3xl p-6 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="table-name">{t("create.name")}</Label>
            <Input
              {...fieldProps("name")}
              type="text"
              autoComplete="off"
              placeholder={t("create.namePlaceholder")}
              maxLength={SEATING_LIMITS.name}
              required
              className="h-11 text-base"
            />
            {fieldError("name")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="table-capacity">{t("create.capacity")}</Label>
            <Input
              {...fieldProps("capacity")}
              type="number"
              inputMode="numeric"
              min={1}
              max={SEATING_LIMITS.capacity}
              step={1}
              defaultValue={DEFAULT_CAPACITY}
              required
              className="h-11 w-32 text-base"
            />
            {fieldError("capacity")}
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("create.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 rounded-full px-6"
            >
              {pending ? t("create.submitting") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
