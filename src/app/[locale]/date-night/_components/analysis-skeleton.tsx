"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = ["market", "venues", "perGuest", "advice"] as const;
const STEP_DURATION_MS = 650;

/** Silhouette de la carte de résultat, avec un message d'étape qui évolue. */
export function AnalysisSkeleton() {
  const t = useTranslations("DateNight.analyzing");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((current) => Math.min(current + 1, STEPS.length - 1)),
      STEP_DURATION_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      aria-busy
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <p
        key={step}
        role="status"
        className="animate-in fade-in slide-in-from-bottom-1 font-serif text-lg italic text-stone duration-500"
      >
        {t(STEPS[step])}
      </p>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-11/12 rounded-full bg-linen" />
        <Skeleton className="h-7 w-2/3 rounded-full bg-linen" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl bg-sage-soft/70" />
        <Skeleton className="h-20 rounded-2xl bg-sand/50" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full rounded-full bg-linen" />
        <Skeleton className="h-4 w-5/6 rounded-full bg-linen" />
        <Skeleton className="h-4 w-3/4 rounded-full bg-linen" />
      </div>
    </div>
  );
}
