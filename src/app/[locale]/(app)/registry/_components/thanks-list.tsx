"use client";

import { useTranslations } from "next-intl";
import type { RegistryFund, RegistryGift, RegistryPledge } from "@/lib/registry/schema";

type ThanksListProps = {
  pledges: RegistryPledge[];
  gifts: RegistryGift[];
  funds: RegistryFund[];
  money: (amount: number) => string;
};

/**
 * Ce que chaque proche offre, avec son petit mot : la liste à garder sous la
 * main pour les remerciements.
 */
export function ThanksList({ pledges, gifts, funds, money }: ThanksListProps) {
  const t = useTranslations("Registry.thanks");
  const giftById = new Map(gifts.map((gift) => [gift.id, gift]));
  const fundById = new Map(funds.map((fund) => [fund.id, fund]));

  const byGuest = new Map<string, RegistryPledge[]>();
  for (const pledge of pledges) {
    const list = byGuest.get(pledge.guest_id) ?? [];
    list.push(pledge);
    byGuest.set(pledge.guest_id, list);
  }

  const describe = (pledge: RegistryPledge) => {
    if (pledge.gift_id) {
      const gift = giftById.get(pledge.gift_id);
      if (!gift) return null;
      if (pledge.amount !== null) return t("giftShare", { title: gift.title, amount: money(pledge.amount) });
      if ((pledge.quantity ?? 1) > 1) return t("giftQuantity", { title: gift.title, count: pledge.quantity ?? 1 });
      return gift.title;
    }
    const fund = pledge.fund_id ? fundById.get(pledge.fund_id) : undefined;
    return fund ? t("fund", { title: fund.title, amount: money(pledge.amount ?? 0) }) : null;
  };

  return (
    <section aria-labelledby="thanks-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="thanks-title" className="font-serif text-3xl">{t("title")}</h2>
        <p className="text-stone">{t("lead", { count: byGuest.size })}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-3xl bg-card px-5 ring-1 ring-border">
        {[...byGuest.values()].map((list) => {
          const guest = list[0].guests;
          const name = guest ? [guest.first_name, guest.last_name].filter(Boolean).join(" ") : "";
          return (
            <li key={list[0].guest_id} className="flex flex-col gap-2 py-4">
              <p className="font-medium">{name}</p>
              <ul className="flex flex-col gap-1.5">
                {list.map((pledge) => (
                  <li key={pledge.id} className="flex flex-col gap-0.5 text-sm">
                    <span className="text-charcoal">{describe(pledge)}</span>
                    {pledge.message && (
                      <span className="font-serif text-base text-stone italic">« {pledge.message} »</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
