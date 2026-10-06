"use client";

import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FUND_KINDS,
  MAX_FUNDS,
  PASSION_KEYS,
  REGISTRY_HEIRLOOMS,
  REGISTRY_IDEAS,
  REGISTRY_PASSIONS,
  REGISTRY_ROOMS,
  ROOM_KEYS,
  type FundKind,
  type RegistryIdeaKey,
  type RegistryPassion,
  type RegistryRoom,
} from "@/lib/registry/catalog";
import { REGISTRY_LIMITS, type SetUpRegistryInput } from "@/lib/registry/schema";
import { cn } from "@/lib/utils";
import { setUpRegistry } from "../actions";
import { FundIcon } from "./fund-icon";

const STEPS = ["welcome", "everyday", "passions", "lasting", "openness", "fund"] as const;
type Step = (typeof STEPS)[number];

/** Le temps de la composition : assez pour qu'on la voie, jamais assez pour qu'on l'attende. */
const COMPOSING_MS = 3200;

type FundDraft = { title: string; description: string; goal: string };

/** Clé d'une idée retenue : « kitchen:dutchOven ». */
const ideaKey = (section: string, idea: string) => `${section}:${idea}`;

type RegistryWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Symbole de la devise du mariage, pour les objectifs de l'urne. */
  currencySymbol: string;
};

/**
 * Ouverture de la liste de mariage : cinq temps de réflexion, puis Céleste
 * compose la liste (cadeaux rangés par pièce et par passion, projets de l'urne).
 */
export function RegistryWizard({ open, onOpenChange, currencySymbol }: RegistryWizardProps) {
  const t = useTranslations("Registry");
  const [phase, setPhase] = useState<"questions" | "composing" | "done">("questions");
  const [step, setStep] = useState(0);
  const [ideas, setIdeas] = useState<ReadonlySet<string>>(new Set());
  const [room, setRoom] = useState<RegistryRoom>("kitchen");
  const [passions, setPassions] = useState<ReadonlySet<RegistryPassion>>(new Set());
  const [note, setNote] = useState("");
  const [acceptsSuggestions, setAcceptsSuggestions] = useState(true);
  const [funds, setFunds] = useState<ReadonlyMap<FundKind, FundDraft>>(new Map());
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [summary, setSummary] = useState({ gifts: 0, funds: 0 });
  const [failed, setFailed] = useState(false);

  const toggleIdea = (key: string) =>
    setIdeas((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const togglePassion = (passion: RegistryPassion) =>
    setPassions((current) => {
      const next = new Set(current);
      if (!next.delete(passion)) next.add(passion);
      return next;
    });
  const toggleFund = (kind: FundKind) =>
    setFunds((current) => {
      const next = new Map(current);
      if (!next.delete(kind) && next.size < MAX_FUNDS) {
        next.set(kind, { title: t(`funds.kinds.${kind}.defaultTitle`), description: "", goal: "" });
      }
      return next;
    });
  const updateFund = (kind: FundKind, patch: Partial<FundDraft>) =>
    setFunds((current) => {
      const draft = current.get(kind);
      if (!draft) return current;
      return new Map(current).set(kind, { ...draft, ...patch });
    });

  async function compose() {
    setPhase("composing");
    setFailed(false);
    // Les idées des passions abandonnées en cours de route ne sont pas gardées.
    const gifts = REGISTRY_IDEAS.filter(
      ({ section, idea }) =>
        ideas.has(ideaKey(section, idea)) &&
        (!(PASSION_KEYS as readonly string[]).includes(section) || passions.has(section as RegistryPassion)),
    ).map(({ section, idea, heirloom }) => ({
      section,
      title: t(`catalog.ideas.${idea}`),
      isHeirloom: heirloom,
    }));
    const fundRows = FUND_KINDS.flatMap((kind) => {
      const draft = funds.get(kind);
      if (!draft) return [];
      const goal = Number.parseInt(draft.goal.replace(/\D/g, ""), 10);
      return [
        {
          kind,
          title: draft.title.trim() || t(`funds.kinds.${kind}.defaultTitle`),
          description: draft.description,
          goal: Number.isFinite(goal) && goal > 0 ? goal : null,
        },
      ];
    });
    const input: SetUpRegistryInput = {
      gifts,
      funds: fundRows,
      note,
      acceptsSuggestions,
      paymentLink,
      paymentDetails,
    };
    const [result] = await Promise.all([
      setUpRegistry(input).catch(() => ({ ok: false as const, error: "generic" as const })),
      new Promise((resolve) => setTimeout(resolve, COMPOSING_MS)),
    ]);
    if (!result.ok) {
      setFailed(true);
      setPhase("questions");
      return;
    }
    setSummary({ gifts: gifts.length, funds: fundRows.length });
    setPhase("done");
  }

  const current: Step = STEPS[step];
  const last = step === STEPS.length - 1;
  const paymentLinkInvalid = paymentLink.trim() !== "" && !/^https:\/\/\S+$/.test(paymentLink.trim());

  let body: ReactNode;
  if (phase === "composing") {
    body = <Composing />;
  } else if (phase === "done") {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-sage-deep text-ivory">
          <CheckIcon aria-hidden className="size-6" strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-2">
          <DialogTitle className="font-serif text-3xl">{t("wizard.done.title")}</DialogTitle>
          <DialogDescription className="text-base text-stone">
            {t("wizard.done.summary", summary)}
          </DialogDescription>
        </div>
        <Button size="lg" className="h-11 rounded-full px-6" onClick={() => onOpenChange(false)}>
          {t("wizard.done.discover")}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-1 w-full shrink-0 bg-linen">
          <div
            className="h-full bg-terracotta transition-[width] duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-8 pb-6 sm:px-10">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
              {step === 0 ? t("wizard.eyebrow") : t("wizard.stepOf", { step, total: STEPS.length - 1 })}
            </p>
            <DialogTitle className="font-serif text-3xl leading-tight text-balance">
              {t(`wizard.steps.${current}.title`)}
            </DialogTitle>
            <DialogDescription className="text-base leading-7 text-pretty text-stone">
              {t(`wizard.steps.${current}.lead`)}
            </DialogDescription>
          </div>

          {current === "welcome" && (
            <ul className="flex flex-col gap-3">
              {(["everyday", "passions", "lasting", "openness", "fund"] as const).map((key, index) => (
                <li key={key} className="flex items-baseline gap-3">
                  <span className="font-serif text-xl text-terracotta tabular-nums">{index + 1}</span>
                  <span className="text-charcoal">{t(`wizard.steps.${key}.title`)}</span>
                </li>
              ))}
            </ul>
          )}

          {current === "everyday" && (
            <div className="flex flex-col gap-4">
              <div role="tablist" aria-label={t("wizard.roomsLabel")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {ROOM_KEYS.map((key) => {
                  const count = REGISTRY_ROOMS[key].filter((idea) => ideas.has(ideaKey(key, idea))).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={room === key}
                      onClick={() => setRoom(key)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition",
                        room === key ? "bg-charcoal text-ivory" : "bg-card text-stone ring-1 ring-border hover:ring-sand",
                      )}
                    >
                      {t(`sections.${key}`)}
                      {count > 0 && (
                        <span className={cn("text-xs tabular-nums", room === key ? "text-ivory/70" : "text-terracotta")}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <IdeaChips
                ideas={REGISTRY_ROOMS[room].map((idea) => ({ key: ideaKey(room, idea), idea }))}
                selected={ideas}
                onToggle={toggleIdea}
              />
              <p className="text-sm text-stone">{t("wizard.everydayHint")}</p>
            </div>
          )}

          {current === "passions" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                {PASSION_KEYS.map((passion) => (
                  <button
                    key={passion}
                    type="button"
                    aria-pressed={passions.has(passion)}
                    onClick={() => togglePassion(passion)}
                    className={cn(
                      "h-10 rounded-full px-4 text-sm transition",
                      passions.has(passion)
                        ? "bg-terracotta text-ivory"
                        : "bg-card text-charcoal ring-1 ring-border hover:ring-sand",
                    )}
                  >
                    {t(`sections.${passion}`)}
                  </button>
                ))}
              </div>
              {PASSION_KEYS.filter((passion) => passions.has(passion)).map((passion) => (
                <div key={passion} className="flex flex-col gap-2">
                  <p className="font-serif text-lg">{t(`sections.${passion}`)}</p>
                  <IdeaChips
                    ideas={REGISTRY_PASSIONS[passion].map((idea) => ({ key: ideaKey(passion, idea), idea }))}
                    selected={ideas}
                    onToggle={toggleIdea}
                  />
                </div>
              ))}
            </div>
          )}

          {current === "lasting" && (
            <div className="flex flex-col gap-4">
              <IdeaChips
                ideas={REGISTRY_HEIRLOOMS.map((idea) => ({ key: ideaKey("heirloom", idea), idea }))}
                selected={ideas}
                onToggle={toggleIdea}
              />
              <p className="rounded-2xl bg-linen px-4 py-3 text-sm leading-6 text-stone">{t("wizard.lastingHint")}</p>
            </div>
          )}

          {current === "openness" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="registry-note">{t("settings.note")}</Label>
                <textarea
                  id="registry-note"
                  value={note}
                  maxLength={REGISTRY_LIMITS.note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("settings.notePlaceholder")}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <input
                  type="checkbox"
                  checked={acceptsSuggestions}
                  onChange={(event) => setAcceptsSuggestions(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-sage"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t("settings.suggestions")}</span>
                  <span className="text-sm text-stone">{t("settings.suggestionsHint")}</span>
                </span>
              </label>
            </div>
          )}

          {current === "fund" && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {FUND_KINDS.map((kind) => {
                  const selected = funds.has(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && funds.size >= MAX_FUNDS}
                      onClick={() => toggleFund(kind)}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl bg-card p-4 text-left transition disabled:opacity-40",
                        selected ? "ring-2 ring-terracotta" : "ring-1 ring-border hover:ring-sand",
                      )}
                    >
                      <FundIcon kind={kind} className="mt-0.5 size-5 shrink-0 text-sage-deep" />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{t(`funds.kinds.${kind}.label`)}</span>
                        <span className="text-sm text-stone">{t(`funds.kinds.${kind}.hint`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {funds.size >= MAX_FUNDS && <p className="text-xs text-stone">{t("funds.max", { count: MAX_FUNDS })}</p>}

              {FUND_KINDS.filter((kind) => funds.has(kind)).map((kind) => {
                const draft = funds.get(kind)!;
                return (
                  <fieldset key={kind} className="flex flex-col gap-3 rounded-2xl bg-linen/60 p-4">
                    <legend className="sr-only">{t(`funds.kinds.${kind}.label`)}</legend>
                    <Input
                      aria-label={t("funds.fields.title")}
                      value={draft.title}
                      maxLength={REGISTRY_LIMITS.fundTitle}
                      onChange={(event) => updateFund(kind, { title: event.target.value })}
                      className="h-11 rounded-xl bg-card font-serif text-lg"
                    />
                    <Input
                      aria-label={t("funds.fields.description")}
                      value={draft.description}
                      maxLength={REGISTRY_LIMITS.fundDescription}
                      placeholder={t(`funds.kinds.${kind}.placeholder`)}
                      onChange={(event) => updateFund(kind, { description: event.target.value })}
                      className="h-11 rounded-xl bg-card text-base"
                    />
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`fund-goal-${kind}`} className="text-sm font-normal text-stone">
                        {t("funds.fields.goal")}
                      </Label>
                      <Input
                        id={`fund-goal-${kind}`}
                        inputMode="numeric"
                        value={draft.goal}
                        onChange={(event) => updateFund(kind, { goal: event.target.value.replace(/\D/g, "").slice(0, 7) })}
                        placeholder="3000"
                        className="h-10 w-28 rounded-xl bg-card text-base"
                      />
                      <span className="text-stone">{currencySymbol}</span>
                    </div>
                  </fieldset>
                );
              })}

              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <p className="font-serif text-lg">{t("settings.paymentTitle")}</p>
                <p className="-mt-1 text-sm text-stone">{t("settings.paymentHint")}</p>
                <Input
                  aria-label={t("settings.paymentLink")}
                  aria-invalid={paymentLinkInvalid || undefined}
                  value={paymentLink}
                  maxLength={REGISTRY_LIMITS.paymentLink}
                  placeholder={t("settings.paymentLinkPlaceholder")}
                  onChange={(event) => setPaymentLink(event.target.value)}
                  className="h-11 rounded-xl bg-card text-base"
                />
                {paymentLinkInvalid && <p className="text-sm text-destructive">{t("settings.paymentLinkInvalid")}</p>}
                <Input
                  aria-label={t("settings.paymentDetails")}
                  value={paymentDetails}
                  maxLength={REGISTRY_LIMITS.paymentDetails}
                  placeholder={t("settings.paymentDetailsPlaceholder")}
                  onChange={(event) => setPaymentDetails(event.target.value)}
                  className="h-11 rounded-xl bg-card text-base"
                />
              </div>
            </div>
          )}

          {failed && <p role="alert" className="text-sm text-destructive">{t("errors.generic")}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-10">
          {step > 0 ? (
            <Button variant="ghost" size="lg" className="h-11 rounded-full text-stone" onClick={() => setStep(step - 1)}>
              <ArrowLeftIcon aria-hidden />
              {t("wizard.back")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="lg"
            disabled={last && paymentLinkInvalid}
            onClick={() => (last ? compose() : setStep(step + 1))}
            className="h-11 rounded-full px-6"
          >
            {step === 0 ? t("wizard.start") : last ? t("wizard.compose") : t("wizard.next")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => phase !== "composing" && onOpenChange(next)}>
      <DialogContent
        closeLabel={t("wizard.close")}
        showCloseButton={phase !== "composing"}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none bg-ivory p-0 sm:h-[min(48rem,92dvh)] sm:w-[min(42rem,92vw)] sm:max-w-none sm:rounded-3xl"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Idées à cocher : chacune deviendra un cadeau de la liste. */
function IdeaChips({
  ideas,
  selected,
  onToggle,
}: {
  ideas: { key: string; idea: RegistryIdeaKey }[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("Registry");
  return (
    <div className="flex flex-wrap gap-2">
      {ideas.map(({ key, idea }) => {
        const on = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-left text-sm transition",
              on ? "bg-sage-soft text-charcoal ring-2 ring-sage" : "bg-card text-charcoal ring-1 ring-border hover:ring-sand",
            )}
          >
            {on && <CheckIcon aria-hidden className="size-3.5 shrink-0 text-sage-deep" />}
            {t(`catalog.ideas.${idea}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Le temps de la composition : une liste qui se dessine, et ce qui se décide. */
function Composing() {
  const t = useTranslations("Registry");
  const steps = useMessages().Registry.wizard.composing as string[];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setIndex((current) => Math.min(current + 1, steps.length - 1)),
      COMPOSING_MS / steps.length,
    );
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10">
      <DialogTitle className="sr-only">{t("wizard.composingTitle")}</DialogTitle>
      <div className="flex w-64 flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_30px_60px_-30px_rgba(43,42,40,0.35)] ring-1 ring-border">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl bg-sand/60" style={{ animationDelay: `${row * 180}ms` }} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-4/5 rounded-full bg-sand/70" style={{ animationDelay: `${row * 180 + 90}ms` }} />
              <Skeleton className="h-2.5 w-2/5 rounded-full bg-sand/50" style={{ animationDelay: `${row * 180 + 140}ms` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-serif text-2xl">{t("wizard.composingTitle")}</p>
        <p aria-live="polite" className="text-stone">
          {steps[index]}
        </p>
      </div>
    </div>
  );
}
