"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** Déconnexion du menu (formulaire : fonctionne aussi sans JavaScript). */
export function SignOutForm({ className }: { className?: string }) {
  const t = useTranslations("AppNav");
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-stone transition-colors hover:bg-terracotta-soft/60 hover:text-terracotta",
          className,
        )}
      >
        <LogOutIcon aria-hidden className="size-4.5" />
        {t("signOut")}
      </button>
    </form>
  );
}
