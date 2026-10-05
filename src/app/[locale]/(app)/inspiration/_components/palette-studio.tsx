"use client";

import { CheckIcon, PlusIcon, StarIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isReadable,
  PALETTE_MAX_COLORS,
  paletteRoles,
  presetColors,
  suggestSwatches,
  SWATCH_FAMILIES,
  swatchIdOf,
  WEDDING_SWATCHES,
  type PalettePreset,
  type PaletteRoles,
} from "@/lib/inspiration/palette";
import { cn } from "@/lib/utils";
import { saveWeddingPalette } from "../actions";
import { PalettePreview } from "./palette-preview";

const ROLE_KEYS = ["main", "secondary", "accent", "light", "deep"] as const;

/** Composition de l'identité visuelle : couleurs choisies, palette calculée, aperçu. */
export function PaletteStudio({
  initialColors,
  presets,
  canEdit,
  names,
}: {
  initialColors: string[];
  /** Palettes prêtes, celles du lieu rêvé en premier. */
  presets: PalettePreset[];
  canEdit: boolean;
  /** Prénoms du mariage, pour l'aperçu du faire-part. */
  names: string;
}) {
  const t = useTranslations("Inspiration.palette");
  const [colors, setColors] = useState(initialColors);
  const [saved, setSaved] = useState(initialColors);
  const [custom, setCustom] = useState("#b8613f");
  const [saving, startSaving] = useTransition();

  const dirty = colors.join() !== saved.join();
  const full = colors.length >= PALETTE_MAX_COLORS;
  const roles = colors.length > 0 ? paletteRoles(colors) : null;
  const suggestions = suggestSwatches(colors);
  const colorName = (hex: string) => {
    const id = swatchIdOf(hex);
    return id ? t(`swatches.${id}`) : hex.toUpperCase();
  };

  function toggle(hex: string) {
    setColors((current) =>
      current.includes(hex)
        ? current.filter((color) => color !== hex)
        : current.length >= PALETTE_MAX_COLORS
          ? current
          : [...current, hex],
    );
  }

  const promote = (hex: string) =>
    setColors((current) => [hex, ...current.filter((color) => color !== hex)]);

  function save() {
    startSaving(async () => {
      const result = await saveWeddingPalette(colors);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      setSaved(colors);
      toast(t("saved"));
    });
  }

  return (
    <div className="flex flex-col gap-12">
      {/* Les couleurs retenues */}
      <section aria-labelledby="chosen-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="chosen-title" className="font-serif text-3xl">
              {t("chosen.title")}
            </h2>
            <p className="text-stone">{t("chosen.hint", { max: PALETTE_MAX_COLORS })}</p>
          </div>
          {canEdit && (
            <Button
              size="lg"
              onClick={save}
              disabled={!dirty || saving}
              className="h-11 rounded-full px-6"
            >
              {dirty ? t("save") : t("upToDate")}
            </Button>
          )}
        </div>

        {colors.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-8 text-center text-stone">
            {t("chosen.empty")}
          </p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {colors.map((hex, index) => (
              <li
                key={hex}
                className="flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border"
              >
                <span className="h-20" style={{ backgroundColor: hex }} />
                <span className="flex flex-col gap-0.5 px-3 pt-2.5 pb-1">
                  <span className="truncate text-sm text-charcoal">{colorName(hex)}</span>
                  <span className="text-xs text-stone">
                    {index === 0 ? t("chosen.main") : t("chosen.rank", { rank: index + 1 })}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex items-center justify-end gap-0.5 px-1.5 pb-1.5">
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => promote(hex)}
                        aria-label={t("chosen.promote", { name: colorName(hex) })}
                        className="text-stone hover:text-terracotta"
                      >
                        <StarIcon aria-hidden />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggle(hex)}
                      aria-label={t("chosen.remove", { name: colorName(hex) })}
                      className="text-stone hover:text-terracotta"
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {canEdit && (
        <>
          {/* Palettes prêtes */}
          <section aria-labelledby="presets-title" className="flex flex-col gap-4">
            <h2 id="presets-title" className="font-serif text-2xl">
              {t("presets.title")}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {presets.map((preset, index) => {
                const swatches = presetColors(preset);
                return (
                  <li key={preset}>
                    <button
                      type="button"
                      onClick={() => setColors(swatches)}
                      className="flex w-full flex-col gap-2.5 rounded-3xl bg-linen p-3 text-left ring-1 ring-sand/70 transition-colors hover:bg-sand/40"
                    >
                      <span className="flex h-12 overflow-hidden rounded-2xl">
                        {swatches.map((hex) => (
                          <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                        ))}
                      </span>
                      <span className="flex items-baseline justify-between gap-2 px-1">
                        <span className="text-sm text-charcoal">
                          {t(`presets.items.${preset}`)}
                        </span>
                        {index === 0 && presets.length > 0 && (
                          <span className="text-xs text-terracotta">{t("presets.forYou")}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Nuancier */}
          <section aria-labelledby="swatches-title" className="flex flex-col gap-5">
            <h2 id="swatches-title" className="font-serif text-2xl">
              {t("swatchesTitle")}
            </h2>

            {suggestions.length > 0 && !full && (
              <div className="flex flex-col gap-2 rounded-3xl bg-sage-soft/60 px-5 py-4">
                <p className="text-sm text-sage-deep">
                  {t("suggestions", { name: colorName(colors[0]) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((id) => {
                    const hex = WEDDING_SWATCHES.find((entry) => entry.id === id)!.hex;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggle(hex)}
                        className="inline-flex items-center gap-2 rounded-full bg-ivory py-1 pr-3 pl-1 text-sm text-charcoal ring-1 ring-sand transition-colors hover:bg-linen"
                      >
                        <span className="size-6 rounded-full" style={{ backgroundColor: hex }} />
                        {t(`swatches.${id}`)}
                        <PlusIcon aria-hidden className="size-3.5 text-stone" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {SWATCH_FAMILIES.map((family) => (
                <div key={family} className="flex flex-col gap-2.5">
                  <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
                    {t(`families.${family}`)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {WEDDING_SWATCHES.filter((entry) => entry.family === family).map((entry) => {
                      const selected = colors.includes(entry.hex);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => toggle(entry.hex)}
                          disabled={!selected && full}
                          aria-pressed={selected}
                          aria-label={t(`swatches.${entry.id}`)}
                          title={t(`swatches.${entry.id}`)}
                          className={cn(
                            "relative flex size-12 items-center justify-center rounded-full ring-1 ring-black/10 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
                            selected && "ring-2 ring-charcoal ring-offset-2 ring-offset-background",
                          )}
                          style={{ backgroundColor: entry.hex }}
                        >
                          {selected && (
                            <CheckIcon
                              aria-hidden
                              className={cn(
                                "size-5",
                                entry.family === "light" && entry.id !== "charcoal"
                                  ? "text-charcoal"
                                  : "text-ivory",
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="custom-color" className="text-sm text-stone">
                {t("custom.label")}
              </label>
              <input
                id="custom-color"
                type="color"
                value={custom}
                onChange={(event) => setCustom(event.target.value.toLowerCase())}
                className="h-11 w-14 cursor-pointer rounded-xl border border-sand bg-transparent p-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => toggle(custom)}
                disabled={full || colors.includes(custom)}
                className="h-11 rounded-full px-4"
              >
                <PlusIcon aria-hidden />
                {t("custom.add")}
              </Button>
            </div>
          </section>
        </>
      )}

      {/* Palette calculée */}
      {roles && <PaletteResult roles={roles} names={names} />}
    </div>
  );
}

function PaletteResult({ roles, names }: { roles: PaletteRoles; names: string }) {
  const t = useTranslations("Inspiration.palette");
  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="result-title" className="font-serif text-3xl">
          {t("result.title")}
        </h2>
        <p className="text-stone">{t("result.intro")}</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ROLE_KEYS.map((role) => (
          <li key={role} className="flex flex-col gap-2">
            <span
              className="h-24 rounded-3xl ring-1 ring-black/5"
              style={{ backgroundColor: roles[role] }}
            />
            <span className="flex flex-col px-1">
              <span className="text-sm text-charcoal">{t(`roles.${role}.label`)}</span>
              <span className="text-xs text-stone">{t(`roles.${role}.use`)}</span>
              <span className="text-xs text-stone/80 tabular-nums">
                {roles[role].toUpperCase()}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {!isReadable(roles) && (
        <p className="rounded-3xl bg-terracotta-soft/60 px-5 py-4 text-sm text-charcoal">
          {t("result.lowContrast")}
        </p>
      )}

      <PalettePreview roles={roles} names={names} />
    </section>
  );
}
