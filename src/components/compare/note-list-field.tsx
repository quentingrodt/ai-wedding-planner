"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Bornes de private.is_venue_note_list (000027), partagées par les lieux et les prestataires. */
export const NOTE_LIST_LIMITS = { item: 140, items: 12 } as const;

/** Liste d'avantages ou d'inconvénients : une ligne par point, ajoutée avec Entrée. */
export function NoteListField({
  id,
  kind,
  items,
  placeholder,
  onChange,
}: {
  id: string;
  kind: "pros" | "cons";
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const t = useTranslations("Compare.notes");
  const [draft, setDraft] = useState("");
  const full = items.length >= NOTE_LIST_LIMITS.items;
  const Icon = kind === "pros" ? PlusIcon : MinusIcon;

  function add() {
    const value = draft.trim();
    if (value === "" || full) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t(kind)}</Label>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border">
              <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${kind === "pros" ? "text-sage-deep" : "text-terracotta"}`} />
              <span className="min-w-0 flex-1 wrap-break-word">{item}</span>
              <button
                type="button"
                aria-label={t("remove", { note: item })}
                onClick={() => onChange(items.filter((_, position) => position !== index))}
                className="-my-0.5 rounded-full p-0.5 text-stone hover:text-terracotta"
              >
                <XIcon aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            maxLength={NOTE_LIST_LIMITS.item}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            // Un point saisi mais pas encore ajouté n'est pas perdu à l'enregistrement.
            onBlur={add}
            className="h-10 rounded-xl bg-card text-base"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label={t(`${kind}Add`)}
            onClick={add}
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Avantages ou inconvénients en lecture, sur une carte. */
export function NoteList({ items, kind }: { items: string[]; kind: "pros" | "cons" }) {
  const t = useTranslations("Compare.notes");
  if (items.length === 0) return null;
  const Icon = kind === "pros" ? PlusIcon : MinusIcon;
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-linen/70 p-3">
      <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">{t(kind)}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex items-start gap-1.5 text-sm leading-5">
            <Icon aria-hidden className={`mt-0.5 size-3.5 shrink-0 ${kind === "pros" ? "text-sage-deep" : "text-terracotta"}`} />
            <span className="min-w-0 wrap-break-word">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
