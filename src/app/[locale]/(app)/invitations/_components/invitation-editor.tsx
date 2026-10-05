"use client";

import { CheckIcon, DownloadIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvitationCard } from "@/lib/invitations/card";
import {
  INVITATION_FONTS,
  INVITATION_LIMITS,
  INVITATION_PALETTES,
  INVITATION_TEMPLATES,
  PALETTE_KEYS,
  type InvitationContent,
  type InvitationDesign,
} from "@/lib/invitations/schema";
import { cn } from "@/lib/utils";
import { saveInvitation } from "../actions";
import { BROWSER_FAMILIES } from "@/components/invitations/fonts";
import { ResponsiveInvitation } from "@/components/invitations/responsive-invitation";

type InvitationEditorProps = {
  initialDesign: InvitationDesign;
  /** Owner ou partner. */
  canEdit: boolean;
  /** Le faire-part n'est pas encore débloqué : l'aperçu porte un filigrane. */
  watermarked: boolean;
  /** Un design est déjà enregistré (l'export lit la version enregistrée). */
  saved: boolean;
};

const FIELDS = ["names", "intro", "dateText", "time", "venue", "address", "rsvpNote"] as const;

/** Éditeur du faire-part : réglages à gauche, aperçu en direct à droite. */
export function InvitationEditor({
  initialDesign,
  canEdit,
  watermarked,
  saved,
}: InvitationEditorProps) {
  const t = useTranslations("Invitations");
  const locale = useLocale();
  const [hasSaved, setHasSaved] = useState(saved);
  const suggestions = useMessages().Invitations.introSuggestions as string[];
  const [design, setDesign] = useState(initialDesign);
  const [savedDesign, setSavedDesign] = useState(initialDesign);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(design) !== JSON.stringify(savedDesign);

  const set = <K extends keyof InvitationDesign>(key: K, value: InvitationDesign[K]) =>
    setDesign((current) => ({ ...current, [key]: value }));
  const setText = (field: keyof InvitationContent, value: string) =>
    setDesign((current) => ({ ...current, content: { ...current.content, [field]: value } }));

  function nextIntro() {
    const index = suggestions.indexOf(design.content.intro);
    setText("intro", suggestions[(index + 1) % suggestions.length]);
  }

  function save() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveInvitation>>;
      try {
        result = await saveInvitation(design);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      setSavedDesign(design);
      setHasSaved(true);
      toast.success(t("saved"));
    });
  }

  const preview = (
    <ResponsiveInvitation design={design} watermark={watermarked ? t("signature") : undefined} />
  );

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="w-full rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>
        <div className="w-full max-w-md">{preview}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="flex flex-col gap-10">
        <Section title={t("sections.template")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INVITATION_TEMPLATES.map((template) => (
              <OptionButton
                key={template}
                selected={design.template === template}
                onClick={() => set("template", template)}
                label={t(`templates.${template}`)}
              >
                <div className="pointer-events-none overflow-hidden rounded-lg ring-1 ring-border">
                  <InvitationCard
                    design={{ ...design, template }}
                    width={140}
                    families={BROWSER_FAMILIES}
                  />
                </div>
              </OptionButton>
            ))}
          </div>
        </Section>

        <Section title={t("sections.palette")}>
          <div className="flex flex-wrap gap-3">
            {PALETTE_KEYS.map((key) => {
              const palette = INVITATION_PALETTES[key];
              const selected = design.palette === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set("palette", key)}
                  className={cn(
                    "inline-flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm ring-1 transition",
                    selected ? "bg-card ring-2 ring-terracotta" : "bg-card/60 ring-border hover:ring-sand",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-7 items-center justify-center rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: palette.paper }}
                  >
                    <span className="size-3.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                  </span>
                  {t(`palettes.${key}`)}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t("sections.fonts")}>
          <div className="grid grid-cols-3 gap-3">
            {INVITATION_FONTS.map((fonts) => (
              <OptionButton
                key={fonts}
                selected={design.fonts === fonts}
                onClick={() => set("fonts", fonts)}
                label={t(`fonts.${fonts}`)}
              >
                <span
                  aria-hidden
                  className="flex h-16 items-center justify-center rounded-lg bg-linen/60 text-3xl"
                  style={{
                    fontFamily:
                      fonts === "script"
                        ? BROWSER_FAMILIES.script
                        : fonts === "romantic"
                          ? BROWSER_FAMILIES.cormorant
                          : BROWSER_FAMILIES.playfair,
                    fontStyle: fonts === "romantic" ? "italic" : "normal",
                  }}
                >
                  Aa
                </span>
              </OptionButton>
            ))}
          </div>
        </Section>

        <Section title={t("sections.texts")}>
          <div className="flex flex-col gap-5">
            {FIELDS.map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor={`invitation-${field}`}>{t(`fields.${field}`)}</Label>
                  {field === "intro" && (
                    <button
                      type="button"
                      onClick={nextIntro}
                      className="inline-flex items-center gap-1.5 text-xs text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
                    >
                      <RefreshCwIcon aria-hidden className="size-3" strokeWidth={1.5} />
                      {t("otherIntro")}
                    </button>
                  )}
                </div>
                <Input
                  id={`invitation-${field}`}
                  value={design.content[field]}
                  maxLength={INVITATION_LIMITS[field]}
                  onChange={(event) => setText(field, event.target.value)}
                  placeholder={
                    field === "time" || field === "venue" || field === "address"
                      ? t(`placeholders.${field}`)
                      : undefined
                  }
                  required={field === "names"}
                  className="h-11 rounded-xl bg-card text-base"
                />
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Aperçu : en tête sur mobile, collant à droite sur grand écran */}
      <div className="order-first flex flex-col gap-4 lg:sticky lg:top-8 lg:order-none">
        <p className="text-xs font-medium tracking-[0.2em] text-stone uppercase">{t("preview")}</p>
        {preview}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-stone">{dirty ? t("unsaved") : null}</span>
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty || design.content.names.trim() === ""}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-terracotta px-6 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_-12px_rgba(169,83,58,0.6)] transition-colors hover:bg-[#93462f] disabled:opacity-60 disabled:shadow-none"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
        {/* L'export lit la version enregistrée : il attend que tout soit enregistré. */}
        <DownloadImage
          href={`/api/invitations/image?locale=${locale}`}
          ready={hasSaved && !dirty}
        />
        <PrintFile locale={locale} ready={hasSaved && !dirty} proof={watermarked} />
      </div>
    </div>
  );
}

function DownloadImage({ href, ready }: { href: string; ready: boolean }) {
  const t = useTranslations("Invitations");

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-linen/70 p-4">
      {ready ? (
        <a
          href={href}
          download
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-sage-deep ring-1 ring-sage/40 transition-colors hover:bg-sage-soft"
        >
          <DownloadIcon aria-hidden className="size-4" strokeWidth={1.5} />
          {t("download.image")}
        </a>
      ) : (
        <span
          aria-disabled
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-card/60 px-4 text-sm text-stone ring-1 ring-border"
        >
          <DownloadIcon aria-hidden className="size-4" strokeWidth={1.5} />
          {t("download.image")}
        </span>
      )}
      <p className="text-xs leading-5 text-stone">{ready ? t("download.imageHint") : t("download.saveFirst")}</p>
    </div>
  );
}

const PRINT_FORMAT_OPTIONS = ["a5", "a6"] as const;

/** PDF pour l'imprimeur : épreuve gratuite, version finale après déblocage. */
function PrintFile({ locale, ready, proof }: { locale: string; ready: boolean; proof: boolean }) {
  const t = useTranslations("Invitations");
  const [format, setFormat] = useState<(typeof PRINT_FORMAT_OPTIONS)[number]>("a5");

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-linen/70 p-4">
      <p className="text-sm font-medium">{t("print.title")}</p>
      <div role="group" aria-label={t("print.formatLabel")} className="flex flex-wrap gap-2">
        {PRINT_FORMAT_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={format === value}
            onClick={() => setFormat(value)}
            className={cn(
              "h-8 rounded-full px-3 text-xs ring-1 transition",
              format === value ? "bg-card text-charcoal ring-terracotta" : "text-stone ring-border hover:ring-sand",
            )}
          >
            {t(`print.formats.${value}`)}
          </button>
        ))}
      </div>
      {ready ? (
        <a
          href={`/api/invitations/pdf?format=${format}&locale=${locale}`}
          download
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-sage-deep ring-1 ring-sage/40 transition-colors hover:bg-sage-soft"
        >
          <FileTextIcon aria-hidden className="size-4" strokeWidth={1.5} />
          {t("print.download")}
        </a>
      ) : (
        <span
          aria-disabled
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-card/60 px-4 text-sm text-stone ring-1 ring-border"
        >
          <FileTextIcon aria-hidden className="size-4" strokeWidth={1.5} />
          {t("print.download")}
        </span>
      )}
      <p className="text-xs leading-5 text-stone">
        {!ready ? t("download.saveFirst") : proof ? t("print.proofHint") : t("print.unlockedHint")}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function OptionButton({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl p-2 text-left text-sm transition",
        selected ? "bg-card ring-2 ring-terracotta" : "ring-1 ring-border hover:ring-sand",
      )}
    >
      {children}
      <span className="px-1 pb-1">{label}</span>
      {selected && (
        <span className="absolute top-3.5 right-3.5 flex size-6 items-center justify-center rounded-full bg-terracotta text-ivory">
          <CheckIcon aria-hidden className="size-3.5" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}
