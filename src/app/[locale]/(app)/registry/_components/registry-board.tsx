"use client";

import { ExternalLinkIcon, GemIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MAX_FUNDS, REGISTRY_SECTIONS } from "@/lib/registry/catalog";
import { FundIcon } from "@/components/registry/fund-icon";
import {
  fundTotals,
  registryTotal,
  type PledgeGuest,
  type Registry,
  type RegistryFund,
  type RegistryGift,
  type RegistryPledge,
  type RegistrySuggestion,
} from "@/lib/registry/schema";
import { deleteFund, deleteGift, deleteSuggestion } from "../actions";
import { FundDialog } from "./fund-dialog";
import { GiftDialog } from "./gift-dialog";
import { RegistryWizard } from "./registry-wizard";
import { SettingsDialog } from "./settings-dialog";
import { ThanksList } from "./thanks-list";

const guestName = (guest: PledgeGuest | null) =>
  guest ? [guest.first_name, guest.last_name].filter(Boolean).join(" ") : "";

type RegistryBoardProps = {
  registry: Registry | null;
  gifts: RegistryGift[];
  funds: RegistryFund[];
  /** Ce que les invités ont réservé ou promis, avec leur nom. */
  pledges: RegistryPledge[];
  /** La boîte à idées des invités. */
  suggestions: RegistrySuggestion[];
  /** Devise du mariage (ISO 4217). */
  currency: string;
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
};

/** Liste de mariage des mariés : leur mot, l'urne, puis les cadeaux par rubrique. */
export function RegistryBoard({
  registry,
  gifts,
  funds,
  pledges,
  suggestions,
  currency,
  canEdit,
}: RegistryBoardProps) {
  const t = useTranslations("Registry");
  const format = useFormatter();
  const locale = useLocale();
  // Première visite : le parcours d'ouverture s'ouvre de lui-même.
  const [wizardOpen, setWizardOpen] = useState(registry === null && canEdit);
  const [wizardKey, setWizardKey] = useState(0);
  const [, startTransition] = useTransition();

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  function remove(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "generic" }));
      if (!result.ok) toast.error(t(`errors.${(result.error ?? "generic") as "generic"}`));
      else toast(success);
    });
  }

  const wizard = canEdit && (
    <RegistryWizard key={wizardKey} open={wizardOpen} onOpenChange={setWizardOpen} currencySymbol={currencySymbol} />
  );

  if (!registry) {
    return (
      // Même place pour le parcours que dans la liste remplie : il garde son état
      // quand la page se recharge avec la nouvelle liste.
      <div className="flex flex-col gap-12">
        {wizard}
        <div className="flex flex-col items-center gap-5 rounded-3xl bg-linen px-6 py-14 text-center">
          <p className="max-w-md font-serif text-2xl text-balance">{t("empty.title")}</p>
          <p className="max-w-md text-stone">{canEdit ? t("empty.body") : t("empty.readOnly")}</p>
          {canEdit && (
            <Button
              size="lg"
              className="h-11 rounded-full px-6"
              onClick={() => {
                setWizardKey((key) => key + 1);
                setWizardOpen(true);
              }}
            >
              {t("empty.open")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const sections = REGISTRY_SECTIONS.map((section) => ({
    section,
    gifts: gifts.filter((gift) => gift.section === section),
  })).filter(({ gifts: list }) => list.length > 0);
  const total = registryTotal(gifts);

  const giftDialogProps = { currency, currencySymbol };
  const pledgesOf = (giftId: string) => pledges.filter((pledge) => pledge.gift_id === giftId);

  return (
    <div className="flex flex-col gap-12">
      {wizard}

      <dl className="grid grid-cols-3 gap-3">
        {([
          { key: "gifts", value: String(gifts.length), surface: "bg-linen" },
          { key: "value", value: money(total), surface: "bg-sage-soft" },
          { key: "funds", value: String(funds.length), surface: "bg-terracotta-soft/60" },
        ] as const).map(({ key, value, surface }) => (
          <div key={key} className={`flex flex-col-reverse gap-1 rounded-3xl px-4 py-4 sm:px-5 ${surface}`}>
            <dt className="text-sm text-stone">{t(`kpis.${key}`)}</dt>
            <dd className="font-serif text-2xl text-charcoal tabular-nums sm:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Le mot des mariés, tel que le liront leurs invités. */}
      <section className="flex flex-col gap-3 rounded-3xl bg-card p-6 ring-1 ring-border">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("note.title")}</h2>
          {canEdit && (
            <SettingsDialog
              registry={registry}
              trigger={
                <Button variant="ghost" size="sm" className="-mt-1 rounded-full text-stone">
                  <PencilIcon aria-hidden />
                  {t("edit")}
                </Button>
              }
            />
          )}
        </div>
        <p className={registry.note ? "font-serif text-xl leading-relaxed text-pretty" : "text-stone"}>
          {registry.note ?? t("note.empty")}
        </p>
        <p className="text-sm text-stone">
          {registry.accepts_suggestions ? t("note.suggestionsOn") : t("note.suggestionsOff")}
        </p>
      </section>

      {/* L'urne */}
      <section aria-labelledby="fund-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="fund-title" className="font-serif text-3xl">{t("funds.title")}</h2>
            <p className="text-stone">{t("funds.lead")}</p>
          </div>
          {canEdit && funds.length < MAX_FUNDS && (
            <FundDialog
              fund={null}
              currencySymbol={currencySymbol}
              trigger={
                <Button variant="outline" className="h-10 rounded-full px-4">
                  <PlusIcon aria-hidden />
                  {t("funds.add")}
                </Button>
              }
            />
          )}
        </div>
        {funds.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-8 text-center text-stone">{t("funds.empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {funds.map((fund) => (
              <li key={fund.id} className="flex flex-col gap-3 rounded-3xl bg-linen p-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-full bg-card text-sage-deep ring-1 ring-border">
                    <FundIcon kind={fund.kind} className="size-5" />
                  </span>
                  {canEdit && (
                    <span className="flex">
                      <FundDialog
                        fund={fund}
                        currencySymbol={currencySymbol}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={t("funds.editLabel", { title: fund.title })} className="text-stone">
                            <PencilIcon aria-hidden />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        label={t("funds.deleteLabel", { title: fund.title })}
                        title={t("funds.deleteTitle", { title: fund.title })}
                        description={t("funds.deleteDescription")}
                        onConfirm={() => remove(() => deleteFund(fund.id), t("funds.deleted", { title: fund.title }))}
                      />
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl leading-snug">{fund.title}</h3>
                {fund.description && <p className="text-sm leading-6 text-stone">{fund.description}</p>}
                {(() => {
                  const { raised, contributors } = fundTotals(pledges, fund.id);
                  const progress = fund.goal ? Math.min(1, raised / fund.goal) : null;
                  return (
                    <div className="mt-auto flex flex-col gap-1.5 pt-1">
                      {progress !== null && (
                        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-card">
                          <div className="h-full rounded-full bg-sage" style={{ width: `${progress * 100}%` }} />
                        </div>
                      )}
                      <p className="text-sm text-charcoal">
                        {fund.goal !== null
                          ? t("funds.raisedOfGoal", { raised: money(raised), goal: money(fund.goal) })
                          : t("funds.raised", { raised: money(raised) })}
                      </p>
                      <p className="text-xs text-stone">{t("funds.contributors", { count: contributors })}</p>
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
        {funds.length > 0 && !registry.payment_link && !registry.payment_details && (
          <p className="rounded-2xl bg-terracotta-soft/40 px-4 py-3 text-sm text-charcoal">{t("funds.noPayment")}</p>
        )}
      </section>

      {/* Les cadeaux */}
      <section aria-labelledby="gifts-title" className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="gifts-title" className="font-serif text-3xl">{t("gifts.title")}</h2>
            <p className="text-stone">{t("gifts.lead")}</p>
          </div>
          {canEdit && (
            <GiftDialog
              gift={null}
              {...giftDialogProps}
              trigger={
                <Button size="lg" className="h-11 rounded-full px-5">
                  <PlusIcon aria-hidden />
                  {t("gift.add")}
                </Button>
              }
            />
          )}
        </div>

        {sections.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">{t("gifts.empty")}</p>
        ) : (
          sections.map(({ section, gifts: list }) => (
            <div key={section} className="flex flex-col gap-4">
              <h3 className="text-xs font-medium tracking-[0.2em] text-stone uppercase">
                {t(`sections.${section}`)}
                <span className="ml-2 text-terracotta tabular-nums">{list.length}</span>
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((gift) => (
                  <li key={gift.id} className="flex gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
                    {gift.image_url ? (
                      // Image d'une boutique tierce : domaine imprévisible, pas d'optimisation next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={gift.image_url}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="size-20 shrink-0 rounded-2xl bg-linen object-cover"
                      />
                    ) : (
                      <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-linen font-serif text-2xl text-sand">
                        {gift.title.charAt(0)}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug wrap-break-word">{gift.title}</p>
                        {canEdit && (
                          <span className="-mt-1 -mr-1 flex shrink-0">
                            <GiftDialog
                              gift={gift}
                              {...giftDialogProps}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={t("gift.editLabel", { title: gift.title })} className="text-stone">
                                  <PencilIcon aria-hidden />
                                </Button>
                              }
                            />
                            <ConfirmDelete
                              label={t("gift.deleteLabel", { title: gift.title })}
                              title={t("gift.deleteTitle", { title: gift.title })}
                              description={
                                pledgesOf(gift.id).length > 0
                                  ? t("gift.deleteReserved")
                                  : t("gift.deleteDescription")
                              }
                              onConfirm={() => remove(() => deleteGift(gift.id), t("gift.deleted", { title: gift.title }))}
                            />
                          </span>
                        )}
                      </div>
                      {gift.description && <p className="text-sm text-stone">{gift.description}</p>}
                      <p className="text-sm text-charcoal">
                        {gift.price !== null ? money(gift.price) : <span className="text-stone">{t("gifts.noPrice")}</span>}
                        {gift.quantity > 1 && <span className="text-stone"> · {t("gifts.quantity", { count: gift.quantity })}</span>}
                      </p>
                      {pledgesOf(gift.id).length > 0 && (
                        <p className="text-sm text-sage-deep">
                          {t(gift.is_heirloom ? "gifts.offeredTogether" : "gifts.reservedBy", {
                            names: format.list(pledgesOf(gift.id).map((pledge) => guestName(pledge.guests))),
                          })}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                        {gift.is_heirloom && (
                          <span className="inline-flex items-center gap-1 text-xs text-terracotta">
                            <GemIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
                            {t("gifts.heirloom")}
                          </span>
                        )}
                        {gift.url && (
                          <a
                            href={gift.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
                          >
                            {t("gifts.shop")}
                            <ExternalLinkIcon aria-hidden className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {pledges.length > 0 && <ThanksList pledges={pledges} gifts={gifts} funds={funds} money={money} />}

      {/* La boîte à idées des invités. */}
      {(registry.accepts_suggestions || suggestions.length > 0) && (
        <section aria-labelledby="ideas-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="ideas-title" className="font-serif text-3xl">{t("ideas.title")}</h2>
            <p className="text-stone">{t("ideas.lead")}</p>
          </div>
          {suggestions.length === 0 ? (
            <p className="rounded-3xl bg-linen px-6 py-8 text-center text-stone">{t("ideas.empty")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} className="flex items-start gap-3 rounded-3xl bg-card p-5 ring-1 ring-border">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="leading-6 wrap-break-word">{suggestion.idea}</p>
                    <p className="text-xs text-stone">{guestName(suggestion.guests)}</p>
                  </div>
                  {canEdit && (
                    <ConfirmDelete
                      label={t("ideas.deleteLabel")}
                      title={t("ideas.deleteTitle")}
                      description={t("ideas.deleteDescription")}
                      onConfirm={() => remove(() => deleteSuggestion(suggestion.id), t("ideas.deleted"))}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ConfirmDelete({
  label,
  title,
  description,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  const t = useTranslations("Registry");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className="text-stone hover:text-terracotta">
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
