import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { INSPIRATION_STEPS } from "@/lib/inspiration/catalog";
import type { InspirationPhoto } from "@/lib/inspiration/photos";

type InspirationCardProps = {
  done: number;
  cover: InspirationPhoto;
};

/**
 * Carnet d'inspiration : une carte mise en avant tant qu'il reste des étapes,
 * puis une simple vignette en bas de l'accueil une fois le carnet rempli.
 */
export async function InspirationCard({ done, cover }: InspirationCardProps) {
  const t = await getTranslations("Dashboard.inspiration");
  const total = INSPIRATION_STEPS.length;

  if (done >= total) {
    return (
      <Link
        href="/inspiration"
        className="group flex items-center gap-4 self-start rounded-full bg-card py-1.5 pr-5 pl-1.5 ring-1 ring-border transition-shadow hover:shadow-[0_12px_30px_-20px_rgba(43,42,40,0.35)]"
      >
        <span className="relative size-10 shrink-0 overflow-hidden rounded-full">
          <Image src={cover.src} alt="" fill sizes="40px" className="object-cover" />
        </span>
        <span className="font-serif text-lg">{t("title")}</span>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-sage-deep">
          {t("ctaDone")}
          <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/inspiration"
      className="group flex items-center gap-5 overflow-hidden rounded-2xl bg-card p-3 pr-6 ring-1 ring-border transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(43,42,40,0.35)]"
    >
      <span className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl">
        <Image
          src={cover.src}
          alt=""
          fill
          sizes="80px"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-serif text-xl leading-snug">{t("title")}</span>
        <span className="flex gap-1" aria-hidden>
          {INSPIRATION_STEPS.map((step, i) => (
            <span
              key={step}
              className={`h-0.5 flex-1 rounded-full ${i < done ? "bg-terracotta" : "bg-sand"}`}
            />
          ))}
        </span>
        <span className="text-sm text-stone">{t("progress", { done, total })}</span>
      </span>
      <span className="hidden items-center gap-2 text-sm font-medium text-sage-deep sm:inline-flex">
        {t("cta")}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
