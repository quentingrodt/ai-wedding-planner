"use client";

import { CheckIcon, ExternalLinkIcon, GemIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGISTRY_SECTIONS } from "@/lib/registry/catalog";
import {
  availableFor,
  fundProgress,
  type GuestRegistry,
  type GuestRegistryFund,
  type GuestRegistryGift,
  type GuestRegistryResult,
} from "@/lib/registry/guest";
import { cn } from "@/lib/utils";
import { FundIcon } from "@/components/registry/fund-icon";
import { pledgeFund, reserveGift, suggestIdea, withdrawPledge } from "./actions";

type GuestRegistryViewProps = { registry: GuestRegistry; token: string };

/** La liste telle que la découvre un invité : l'urne, les cadeaux, la boîte à idées. */
export function GuestRegistryView({ registry, token }: GuestRegistryViewProps) {
  const t = useTranslations("GuestRegistry");
  const format = useFormatter();
  const money = (value: number) =>
    format.number(value, { style: "currency", currency: registry.currency, maximumFractionDigits: 0 });

  const sections = REGISTRY_SECTIONS.map((section) => ({
    section,
    gifts: registry.gifts.filter((gift) => gift.section === section),
  })).filter(({ gifts }) => gifts.length > 0);

  return (
    <div className="flex flex-col gap-14">
      {registry.funds.length > 0 && (
        <section aria-labelledby="guest-fund-title" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 id="guest-fund-title" className="font-serif text-3xl">{t("funds.title")}</h2>
            <p className="text-stone">{t("funds.lead")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {registry.funds.map((fund) => (
              <FundCard key={fund.id} fund={fund} registry={registry} token={token} money={money} />
            ))}
          </ul>
        </section>
      )}

      {sections.length > 0 && (
        <section aria-labelledby="guest-gifts-title" className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <h2 id="guest-gifts-title" className="font-serif text-3xl">{t("gifts.title")}</h2>
            <p className="text-stone">{t("gifts.lead")}</p>
          </div>
          {sections.map(({ section, gifts }) => (
            <div key={section} className="flex flex-col gap-4">
              <h3 className="text-xs font-medium tracking-[0.2em] text-stone uppercase">
                {t(`sections.${section}`)}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {gifts.map((gift) => (
                  <GiftCard key={gift.id} gift={gift} token={token} money={money} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {registry.accepts_suggestions && <IdeaBox token={token} />}
    </div>
  );
}

function FundCard({
  fund,
  registry,
  token,
  money,
}: {
  fund: GuestRegistryFund;
  registry: GuestRegistry;
  token: string;
  money: (value: number) => string;
}) {
  const t = useTranslations("GuestRegistry");
  const progress = fundProgress(fund);
  return (
    <li className="flex flex-col gap-3 rounded-3xl bg-card p-6 ring-1 ring-border">
      <span className="flex size-10 items-center justify-center rounded-full bg-linen text-sage-deep">
        <FundIcon kind={fund.kind} className="size-5" />
      </span>
      <h4 className="font-serif text-xl leading-snug">{fund.title}</h4>
      {fund.description && <p className="text-sm leading-6 text-stone">{fund.description}</p>}
      {progress !== null && fund.goal !== null && (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={t("funds.progressLabel", { title: fund.title })}
            className="h-1.5 overflow-hidden rounded-full bg-linen"
          >
            <div className="h-full rounded-full bg-sage transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-xs text-stone">
            {t("funds.progress", { raised: money(fund.raised), goal: money(fund.goal) })}
          </p>
        </div>
      )}
      <div className="mt-auto pt-2">
        <PledgeDialog
          title={fund.title}
          description={t("funds.dialogLead")}
          mine={fund.mine_amount !== null}
          amount={{ required: true, initial: fund.mine_amount, currency: registry.currency }}
          payment={registry}
          onSubmit={({ amount, message }) =>
            pledgeFund({ token, fundId: fund.id, amount: amount ?? 0, message })
          }
          onWithdraw={() => withdrawPledge(token, fund.id)}
          withdrawLabel={t("dialog.withdrawPledge")}
          trigger={
            fund.mine_amount !== null ? (
              <Button variant="outline" className="h-10 rounded-full px-4">
                <CheckIcon aria-hidden />
                {t("funds.mine", { amount: money(fund.mine_amount) })}
              </Button>
            ) : (
              <Button className="h-10 rounded-full px-5">{t("funds.contribute")}</Button>
            )
          }
        />
      </div>
    </li>
  );
}

function GiftCard({
  gift,
  token,
  money,
}: {
  gift: GuestRegistryGift;
  token: string;
  money: (value: number) => string;
}) {
  const t = useTranslations("GuestRegistry");
  const available = availableFor(gift);
  const given = !gift.is_heirloom && !gift.mine && available === 0;

  let action: ReactNode;
  if (given) {
    action = <span className="text-sm text-stone">{t("gifts.given")}</span>;
  } else {
    action = (
      <PledgeDialog
        title={gift.title}
        description={gift.is_heirloom ? t("gifts.heirloomLead") : t("gifts.reserveLead")}
        mine={gift.mine}
        quantity={gift.is_heirloom ? undefined : { max: available, initial: gift.mine_quantity ?? 1 }}
        amount={gift.is_heirloom ? { required: false, initial: gift.mine_amount, currency: null } : undefined}
        shopUrl={gift.url}
        onSubmit={({ quantity, amount, message }) =>
          reserveGift({
            token,
            giftId: gift.id,
            quantity: gift.is_heirloom ? null : (quantity ?? 1),
            amount: gift.is_heirloom ? amount : null,
            message,
          })
        }
        onWithdraw={() => withdrawPledge(token, gift.id)}
        withdrawLabel={gift.is_heirloom ? t("dialog.withdrawPledge") : t("dialog.withdraw")}
        trigger={
          gift.mine ? (
            <Button variant="outline" size="sm" className="h-9 rounded-full px-3">
              <CheckIcon aria-hidden />
              {gift.is_heirloom ? t("gifts.mineHeirloom") : t("gifts.mine")}
            </Button>
          ) : (
            <Button size="sm" className="h-9 rounded-full px-4">
              {gift.is_heirloom ? t("gifts.join") : t("gifts.reserve")}
            </Button>
          )
        }
      />
    );
  }

  return (
    <li className={cn("flex gap-4 rounded-3xl bg-card p-4 ring-1 ring-border", given && "opacity-60")}>
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
        <p className="font-medium leading-snug wrap-break-word">{gift.title}</p>
        {gift.description && <p className="text-sm text-stone">{gift.description}</p>}
        <p className="text-sm text-charcoal">
          {gift.price !== null && money(gift.price)}
          {!gift.is_heirloom && gift.quantity > 1 && !given && (
            <span className="text-stone">
              {gift.price !== null && " · "}
              {t("gifts.left", { count: available })}
            </span>
          )}
        </p>
        {gift.is_heirloom && (
          <p className="inline-flex items-center gap-1 text-xs text-terracotta">
            <GemIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
            {t("gifts.heirloom", { count: gift.participants })}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          {action}
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
  );
}

type PledgeValues = { quantity: number | null; amount: number | null; message: string };

/** Réserver, participer ou modifier sa promesse, avec un petit mot facultatif. */
function PledgeDialog({
  title,
  description,
  mine,
  quantity,
  amount,
  payment,
  shopUrl,
  onSubmit,
  onWithdraw,
  withdrawLabel,
  trigger,
}: {
  title: string;
  description: string;
  mine: boolean;
  /** Cadeau ordinaire : nombre d'exemplaires (max : encore libres). */
  quantity?: { max: number; initial: number };
  /** Urne (obligatoire) ou cadeau d'exception (facultatif). */
  amount?: { required: boolean; initial: number | null; currency: string | null };
  /** Moyen de régler une participation à l'urne. */
  payment?: Pick<GuestRegistry, "payment_link" | "payment_details">;
  shopUrl?: string | null;
  onSubmit: (values: PledgeValues) => Promise<GuestRegistryResult>;
  onWithdraw: () => Promise<GuestRegistryResult>;
  withdrawLabel: string;
  trigger: ReactNode;
}) {
  const t = useTranslations("GuestRegistry");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState(quantity?.initial ?? 1);
  const [value, setValue] = useState(amount?.initial ? String(amount.initial) : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setCount(quantity?.initial ?? 1);
      setValue(amount?.initial ? String(amount.initial) : "");
      setError(null);
      setDone(false);
    }
  }

  const parsedAmount = Number.parseInt(value, 10);
  const amountValue = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;
  const missingAmount = amount?.required && amountValue === null;

  function run(action: () => Promise<GuestRegistryResult>, closeAfter: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await action().catch((): GuestRegistryResult => ({ ok: false, error: "generic" }));
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      if (closeAfter) setOpen(false);
      else setDone(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription className="leading-6">{done ? t("dialog.thanks") : description}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-4">
            {payment && (payment.payment_link || payment.payment_details) && (
              <div className="flex flex-col gap-3 rounded-2xl bg-linen/70 p-4">
                <p className="text-sm font-medium">{t("dialog.howToPay")}</p>
                {payment.payment_link && (
                  <a
                    href={payment.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-sage-deep px-4 text-sm text-ivory hover:bg-[#35402f]"
                  >
                    {t("dialog.payLink")}
                    <ExternalLinkIcon aria-hidden className="size-4" />
                  </a>
                )}
                {payment.payment_details && (
                  <p className="text-sm wrap-break-word text-charcoal select-all">{payment.payment_details}</p>
                )}
              </div>
            )}
            {shopUrl && (
              <a
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-sage-deep px-4 text-sm text-ivory hover:bg-[#35402f]"
              >
                {t("dialog.shopLink")}
                <ExternalLinkIcon aria-hidden className="size-4" />
              </a>
            )}
            <Button size="lg" variant="ghost" className="h-11 self-end rounded-full" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (missingAmount) return;
              run(() => onSubmit({ quantity: quantity ? count : null, amount: amountValue, message }), false);
            }}
          >
            {quantity && quantity.max > 1 && (
              <div className="flex items-center gap-3">
                <Label htmlFor="pledge-quantity" className="flex-1">{t("dialog.quantity")}</Label>
                <Input
                  id="pledge-quantity"
                  type="number"
                  min={1}
                  max={quantity.max}
                  value={count}
                  onChange={(event) =>
                    setCount(Math.min(quantity.max, Math.max(1, Number.parseInt(event.target.value, 10) || 1)))
                  }
                  className="h-11 w-24 rounded-xl bg-card text-base"
                />
              </div>
            )}
            {amount && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pledge-amount">
                  {amount.required ? t("dialog.amount") : t("dialog.amountOptional")}
                </Label>
                <Input
                  id="pledge-amount"
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="50"
                  className="h-11 w-36 rounded-xl bg-card text-base"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="pledge-message">{t("dialog.message")}</Label>
              <textarea
                id="pledge-message"
                value={message}
                maxLength={300}
                rows={3}
                placeholder={t("dialog.messagePlaceholder")}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
              <p className="text-xs text-stone">{t("dialog.messageHint")}</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="mx-0 mt-2 mb-0 flex-col-reverse gap-2 rounded-none border-t-0 bg-transparent p-0 sm:flex-row sm:justify-between">
              {mine ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={pending}
                  className="h-11 rounded-full text-stone hover:text-terracotta"
                  onClick={() => run(onWithdraw, true)}
                >
                  {withdrawLabel}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" disabled={pending || missingAmount} className="h-11 rounded-full px-6">
                {pending ? t("dialog.sending") : mine ? t("dialog.update") : t("dialog.confirm")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Boîte à idées : une suggestion glissée aux mariés. */
function IdeaBox({ token }: { token: string }) {
  const t = useTranslations("GuestRegistry");
  const [idea, setIdea] = useState("");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section aria-labelledby="idea-box-title" className="flex flex-col gap-4 rounded-3xl bg-linen p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="idea-box-title" className="font-serif text-2xl">{t("ideas.title")}</h2>
        <p className="text-stone">{t("ideas.lead")}</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (idea.trim() === "") return;
          startTransition(async () => {
            const result = await suggestIdea(token, idea).catch((): GuestRegistryResult => ({ ok: false, error: "generic" }));
            if (result.ok) {
              setIdea("");
              setNotice({ ok: true, text: t("ideas.sent") });
            } else {
              setNotice({ ok: false, text: t(`errors.${result.error}`) });
            }
          });
        }}
      >
        <textarea
          aria-label={t("ideas.label")}
          value={idea}
          maxLength={300}
          rows={3}
          placeholder={t("ideas.placeholder")}
          onChange={(event) => setIdea(event.target.value)}
          className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className={cn("text-sm", notice?.ok === false ? "text-destructive" : "text-sage-deep")}>
            {notice?.text}
          </p>
          <Button type="submit" disabled={pending || idea.trim() === ""} className="h-10 rounded-full px-5">
            {pending ? t("dialog.sending") : t("ideas.send")}
          </Button>
        </div>
      </form>
    </section>
  );
}
