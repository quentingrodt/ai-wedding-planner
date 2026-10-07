"use client";

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { switchWedding } from "@/lib/weddings/actions";
import type { ShellProfile } from "./nav-config";

function Identity({ profile }: { profile: ShellProfile }) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terracotta-soft font-serif text-sm text-terracotta"
      >
        {profile.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate font-serif text-base text-charcoal">
          {profile.title}
        </span>
        {profile.date && (
          <span className="truncate text-xs text-stone">{profile.date}</span>
        )}
      </span>
    </>
  );
}

/**
 * Les prénoms du mariage et sa date, sous un monogramme. Avec plusieurs
 * mariages (le sien, ceux d'amis dont on est témoin), la carte devient le
 * sélecteur du mariage affiché.
 */
export function ProfileCard({
  profile,
  onSwitch,
}: {
  profile: ShellProfile;
  onSwitch?: () => void;
}) {
  const t = useTranslations("AppNav.switcher");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Témoin uniquement : de quoi créer son propre mariage.
  const createOwn = !profile.weddings.some(
    (wedding) => wedding.role !== "witness",
  ) && (
    <Link
      href="/onboarding"
      onClick={onSwitch}
      className="mx-4 mb-2 inline-flex items-center gap-1.5 text-xs text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
    >
      <PlusIcon aria-hidden className="size-3.5" />
      {t("createOwn")}
    </Link>
  );

  if (profile.weddings.length < 2) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3">
          <Identity profile={profile} />
        </div>
        {createOwn}
      </div>
    );
  }

  function choose(weddingId: string) {
    if (weddingId === profile.weddingId) return;
    startTransition(async () => {
      const result = await switchWedding(weddingId).catch(() => ({
        ok: false as const,
      }));
      if (!result.ok) return;
      onSwitch?.();
      // Le tableau de bord du mariage choisi, rendu à neuf.
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("label")}
          disabled={pending}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-sand/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            pending && "opacity-60",
          )}
        >
          <Identity profile={profile} />
          <ChevronsUpDownIcon
            aria-hidden
            className="size-4 shrink-0 text-stone"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          className="w-60 rounded-2xl p-1.5"
        >
          <DropdownMenuLabel className="px-2.5 text-xs font-normal text-stone">
            {t("label")}
          </DropdownMenuLabel>
          {profile.weddings.map((wedding) => {
            const current = wedding.id === profile.weddingId;
            return (
              <DropdownMenuItem
                key={wedding.id}
                className="flex items-start gap-2 rounded-xl px-2.5 py-2"
                onSelect={() => choose(wedding.id)}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-serif text-base">
                    {wedding.title}
                  </span>
                  <span className="text-xs text-stone">
                    {t(`roles.${wedding.role}`)}
                  </span>
                </span>
                {current && (
                  <CheckIcon
                    aria-label={t("current")}
                    className="mt-1 size-4 shrink-0 text-sage-deep"
                  />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {createOwn}
    </div>
  );
}
