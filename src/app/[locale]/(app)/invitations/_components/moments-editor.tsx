"use client";

import { ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MomentIconSvg } from "@/lib/invitations/icons";
import {
  DEFAULT_MOMENT_ICONS,
  INVITATION_LIMITS,
  MAX_MOMENTS,
  MOMENT_ICONS,
  type InvitationMoment,
  type MomentIcon,
} from "@/lib/invitations/schema";

type MomentsEditorProps = {
  moments: InvitationMoment[];
  onChange: (moments: InvitationMoment[]) => void;
};

const TEXT_FIELDS = ["time", "title", "venue", "address"] as const;

/** Programme de la journée : jusqu'à quatre moments, dans l'ordre. */
export function MomentsEditor({ moments, onChange }: MomentsEditorProps) {
  const t = useTranslations("Invitations");

  const update = (index: number, patch: Partial<InvitationMoment>) =>
    onChange(moments.map((moment, i) => (i === index ? { ...moment, ...patch } : moment)));
  const remove = (index: number) => onChange(moments.filter((_, i) => i !== index));
  const moveUp = (index: number) => {
    const next = [...moments];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };
  const add = () =>
    onChange([
      ...moments,
      {
        time: "",
        title: "",
        venue: "",
        address: "",
        icon: DEFAULT_MOMENT_ICONS[moments.length] ?? "glass",
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {moments.length === 0 && (
        <p className="rounded-2xl bg-linen/70 px-4 py-3 text-sm text-stone">{t("program.empty")}</p>
      )}

      <ol className="flex flex-col gap-3">
        {moments.map((moment, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <Select
                value={moment.icon}
                onValueChange={(value) => update(index, { icon: value as MomentIcon })}
              >
                <SelectTrigger
                  aria-label={t("program.icon")}
                  className="h-10 w-fit gap-2 rounded-full bg-linen/50 px-3 data-[size=default]:h-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOMENT_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <MomentIconSvg icon={icon} color="currentColor" size={22} />
                      {t(`program.icons.${icon}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex-1" />
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("program.moveUp")}
                  onClick={() => moveUp(index)}
                  className="rounded-full text-stone"
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("program.remove")}
                onClick={() => remove(index)}
                className="rounded-full text-stone hover:text-terracotta"
              >
                <XIcon aria-hidden />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              {TEXT_FIELDS.map((field) => {
                const id = `moment-${index}-${field}`;
                const limit = field === "title" ? INVITATION_LIMITS.momentTitle : INVITATION_LIMITS[field];
                return (
                  <div
                    key={field}
                    className={field === "venue" || field === "address" ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}
                  >
                    <Label htmlFor={id} className="text-xs text-stone">
                      {t(`program.fields.${field}`)}
                    </Label>
                    <Input
                      id={id}
                      value={moment[field]}
                      maxLength={limit}
                      placeholder={t(`program.placeholders.${field}`)}
                      onChange={(event) => update(index, { [field]: event.target.value })}
                      className="h-10 rounded-xl bg-card text-base"
                    />
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {moments.length < MAX_MOMENTS ? (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="h-10 w-fit rounded-full px-4"
        >
          <PlusIcon aria-hidden />
          {t("program.add")}
        </Button>
      ) : (
        <p className="text-xs text-stone">{t("program.max", { count: MAX_MOMENTS })}</p>
      )}
    </div>
  );
}
