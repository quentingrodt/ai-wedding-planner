"use client";

import { CheckIcon, DownloadIcon, FileTextIcon, Maximize2Icon, RefreshCwIcon } from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvitationCard, NAME_FONT } from "@/lib/invitations/card";
import {
  INVITATION_FONTS,
  INVITATION_LIMITS,
  INVITATION_PALETTES,
  INVITATION_TEMPLATES,
  PALETTE_KEYS,
  type InvitationContent,
  type InvitationDesign,
  type InvitationMoment,
  type InvitationTemplate,
} from "@/lib/invitations/schema";
import {
  sortTemplatesFor,
  TEMPLATE_AMBIANCES,
  TEMPLATE_SPECS,
  type TemplateAmbiance,
} from "@/lib/invitations/templates";
import { cn } from "@/lib/utils";
import { saveInvitation } from "../actions";
import { BROWSER_FAMILIES } from "@/components/invitations/fonts";
import {
  defaultView,
  ResponsiveInvitation,
  type InvitationView,
} from "@/components/invitations/responsive-invitation";
import { FullscreenPreview } from "./fullscreen-preview";
import { MomentsEditor } from "./moments-editor";

type InvitationEditorProps = {
  initialDesign: InvitationDesign;
  /** Owner ou partner. */
  canEdit: boolean;
  /** Le faire-part n'est pas encore débloqué : l'aperçu porte un filigrane. */
  watermarked: boolean;
  /** Un design est déjà enregistré (l'export lit la version enregistrée). */
  saved: boolean;
  /** Ambiance du carnet d'inspiration : ses modèles passent en tête. */
  recommendedAmbiance: TemplateAmbiance | null;
};

type TextField = Exclude<keyof InvitationContent, "moments">;

/**
 * Champs regroupés dans l'ordre des pages du livret ; le programme a son
 * propre éditeur. view : la page montrée par l'aperçu quand on édite le groupe.
 */
const TEXT_GROUPS = [
  { key: "cover", view: "cover", fields: ["names", "coverHint"] },
  { key: "invitation", view: "inside", fields: ["families", "intro", "dateText"] },
  { key: "program", view: "inside", fields: [] },
  { key: "reply", view: "inside", fields: ["rsvpNote", "contact"] },
  { key: "back", view: "back", fields: ["closingNote"] },
] as const satisfies readonly {
  key: string;
  view: Exclude<InvitationView, "card">;
  fields: readonly TextField[];
}[];

/** Champs propres au livret, masqués pour une carte simple. */
const BOOKLET_ONLY: readonly TextField[] = ["coverHint", "closingNote"];

/** Pages proposées par le sélecteur de l'aperçu. */
const BOOKLET_VIEWS = ["cover", "inside", "back"] as const;

/** Éditeur du faire-part : réglages à gauche, aperçu en direct à droite. */
export function InvitationEditor({
  initialDesign,
  canEdit,
  watermarked,
  saved,
  recommendedAmbiance,
}: InvitationEditorProps) {
  const t = useTranslations("Invitations");
  const locale = useLocale();
  const [hasSaved, setHasSaved] = useState(saved);
  const messages = useMessages().Invitations;
  const suggestions = messages.introSuggestions as string[];
  // Programme d'exemple des vignettes, tant que le couple n'a pas saisi le sien.
  const sampleMoments = messages.sampleMoments as InvitationMoment[];
  const [ambianceFilter, setAmbianceFilter] = useState<TemplateAmbiance | null>(null);
  const [design, setDesign] = useState(initialDesign);
  const [savedDesign, setSavedDesign] = useState(initialDesign);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(design) !== JSON.stringify(savedDesign);
  const booklet = design.format === "booklet";
  const [view, setView] = useState<InvitationView>(defaultView(initialDesign));
  // L'annonce des familles est facultative : ouverte si elle a déjà un texte.
  const [familiesOpen, setFamiliesOpen] = useState(initialDesign.content.families !== "");

  const set = <K extends keyof InvitationDesign>(key: K, value: InvitationDesign[K]) =>
    setDesign((current) => ({ ...current, [key]: value }));
  const chooseFormat = (format: InvitationDesign["format"]) => {
    // Un faire-part composé en carte simple n'a pas encore de mot de fin : on en propose un.
    setDesign((current) => ({
      ...current,
      format,
      content:
        format === "booklet" && current.content.closingNote === ""
          ? { ...current.content, closingNote: t("defaults.closingNote") }
          : current.content,
    }));
    setView(format === "card" ? "card" : "cover");
  };
  const toggleFamilies = (open: boolean) => {
    setFamiliesOpen(open);
    setText("families", open ? t("defaults.families") : "");
  };
  const setText = (field: TextField, value: string) =>
    setDesign((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  const setMoments = (moments: InvitationMoment[]) =>
    setDesign((current) => ({ ...current, content: { ...current.content, moments } }));

  // Choisir un modèle applique son style complet ; couleurs et typographie restent modifiables.
  const chooseTemplate = (template: InvitationTemplate) =>
    setDesign((current) => ({ ...current, template, ...TEMPLATE_SPECS[template].defaults }));
  const templateLook = (template: InvitationTemplate): InvitationDesign => ({
    ...design,
    template,
    ...TEMPLATE_SPECS[template].defaults,
    content: {
      ...design.content,
      moments: design.content.moments.length > 0 ? design.content.moments : sampleMoments,
    },
  });
  const templates = sortTemplatesFor(recommendedAmbiance, INVITATION_TEMPLATES).filter(
    (template) =>
      ambianceFilter === null || TEMPLATE_SPECS[template].ambiances.includes(ambianceFilter),
  );

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

  const watermark = watermarked ? t("signature") : undefined;
  // Cliquer sur l'aperçu l'ouvre aussi en plein écran.
  const preview = (
    <FullscreenPreview
      design={design}
      watermark={watermark}
      initialView={view}
      trigger={
        <button
          type="button"
          aria-label={t("fullscreen.open")}
          className="block w-full cursor-zoom-in rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ResponsiveInvitation design={design} view={view} watermark={watermark} />
        </button>
      }
    />
  );
  const fullscreenButton = (
    <FullscreenPreview
      design={design}
      watermark={watermark}
      initialView={view}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-stone transition-colors hover:bg-linen hover:text-charcoal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Maximize2Icon aria-hidden className="size-3.5" strokeWidth={1.5} />
          {t("fullscreen.button")}
        </button>
      }
    />
  );
  const viewPicker = booklet && (
    <div role="group" aria-label={t("views.label")} className="inline-flex w-fit rounded-full bg-linen p-1">
      {BOOKLET_VIEWS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => setView(value)}
          className={cn(
            "h-8 rounded-full px-3.5 text-sm text-stone transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            view === value && "bg-card text-charcoal shadow-sm",
          )}
        >
          {t(`views.${value}`)}
        </button>
      ))}
    </div>
  );

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="w-full rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {viewPicker}
          {fullscreenButton}
        </div>
        <div className={cn("w-full", view === "inside" ? "max-w-3xl" : "max-w-md")}>{preview}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
      <div className="flex flex-col gap-10">
        <Section title={t("sections.format")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["booklet", "card"] as const).map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={design.format === format}
                onClick={() => chooseFormat(format)}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl p-4 text-left transition",
                  design.format === format
                    ? "bg-card ring-2 ring-terracotta"
                    : "ring-1 ring-border hover:ring-sand",
                )}
              >
                <span className="font-medium">{t(`formats.${format}.title`)}</span>
                <span className="text-sm text-stone">{t(`formats.${format}.description`)}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("sections.template")}>
          <div role="group" aria-label={t("ambiances.label")} className="flex flex-wrap gap-2">
            {[null, ...TEMPLATE_AMBIANCES].map((ambiance) => (
              <button
                key={ambiance ?? "all"}
                type="button"
                aria-pressed={ambianceFilter === ambiance}
                onClick={() => setAmbianceFilter(ambiance)}
                className={cn(
                  "h-9 rounded-full px-4 text-sm ring-1 transition",
                  ambianceFilter === ambiance
                    ? "bg-card text-charcoal ring-2 ring-terracotta"
                    : "text-stone ring-border hover:ring-sand",
                )}
              >
                {t(`ambiances.${ambiance ?? "all"}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <OptionButton
                key={template}
                selected={design.template === template}
                onClick={() => chooseTemplate(template)}
                label={t(`templates.${template}`)}
                badge={
                  recommendedAmbiance &&
                  TEMPLATE_SPECS[template].ambiances.includes(recommendedAmbiance)
                    ? t("recommended")
                    : undefined
                }
              >
                <div className="pointer-events-none overflow-hidden rounded-lg ring-1 ring-border">
                  <InvitationCard
                    design={templateLook(template)}
                    width={180}
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
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
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
                    fontFamily: BROWSER_FAMILIES[NAME_FONT[fonts]],
                    fontStyle: fonts === "romantic" ? "italic" : "normal",
                    // Allison a un petit œil : on la grossit pour un aperçu comparable.
                    fontSize: fonts === "modern" ? "2.75rem" : undefined,
                  }}
                >
                  Aa
                </span>
              </OptionButton>
            ))}
          </div>
        </Section>

        {TEXT_GROUPS.filter(({ key }) => booklet || key !== "back").map(({ key, view: page, fields }) => (
          <Section
            key={key}
            // Carte simple : pas de couverture, le premier groupe parle du couple.
            title={t(`sections.${!booklet && key === "cover" ? "you" : key}`)}
            // Éditer un groupe montre la page concernée dans l'aperçu.
            onFocus={booklet ? () => setView(page) : undefined}
          >
            {key === "program" ? (
              <MomentsEditor moments={design.content.moments} onChange={setMoments} />
            ) : (
              <div className="flex flex-col gap-5">
                {fields
                  .filter((field: TextField) => booklet || !BOOKLET_ONLY.includes(field))
                  .map((field: TextField) =>
                    field === "families" ? (
                      <div key={field} className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={familiesOpen}
                            onChange={(event) => toggleFamilies(event.target.checked)}
                            className="size-5 cursor-pointer rounded accent-sage"
                          />
                          {t("familiesToggle")}
                        </label>
                        {familiesOpen ? (
                          <textarea
                            id="invitation-families"
                            aria-label={t("fields.families")}
                            value={design.content.families}
                            maxLength={INVITATION_LIMITS.families}
                            onChange={(event) => setText("families", event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          />
                        ) : (
                          <p className="text-xs text-stone">{t("familiesHint")}</p>
                        )}
                      </div>
                    ) : (
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
                        field === "contact" || field === "coverHint"
                          ? t(`placeholders.${field}`)
                          : undefined
                      }
                      required={field === "names"}
                      className="h-11 rounded-xl bg-card text-base"
                    />
                  </div>
                    ),
                  )}
              </div>
            )}
          </Section>
        ))}
      </div>

      {/* Aperçu : en tête sur mobile, collant à droite sur grand écran */}
      <div className="order-first flex flex-col gap-4 lg:sticky lg:top-8 lg:order-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium tracking-[0.2em] text-stone uppercase">{t("preview")}</p>
            {fullscreenButton}
          </div>
          {viewPicker}
        </div>
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

function Section({
  title,
  onFocus,
  children,
}: {
  title: string;
  /** Appelé quand un champ de la section prend le focus. */
  onFocus?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" onFocusCapture={onFocus}>
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function OptionButton({
  selected,
  onClick,
  label,
  badge,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  /** Mention discrète sous le libellé (ex. « Pour vous »). */
  badge?: string;
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
      <span className="flex flex-col gap-0.5 px-1 pb-1">
        {label}
        {badge && <span className="text-xs text-terracotta">{badge}</span>}
      </span>
      {selected && (
        <span className="absolute top-3.5 right-3.5 flex size-6 items-center justify-center rounded-full bg-terracotta text-ivory">
          <CheckIcon aria-hidden className="size-3.5" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}
