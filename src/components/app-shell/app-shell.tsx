import type { ReactNode } from "react";
import { getFormatter } from "next-intl/server";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding, getUserWeddings } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { MobileHeader } from "./mobile-header";
import { MobileNav } from "./mobile-nav";
import type { ShellProfile } from "./nav-config";
import { Sidebar } from "./sidebar";

/** « Quentin & Aurore » → « Q&A » ; un seul prénom → sa première lettre. */
function monogram(title: string): string {
  const names = title
    .split(/\s*(?:&|\+|\bet\b|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return names
    .slice(0, 2)
    .map((name) => name.charAt(0).toLocaleUpperCase())
    .join("&");
}

/**
 * Coque de l'espace connecté : menu latéral (écrans larges) et barre
 * d'onglets (mobile) autour de la page. Sans session ou sans mariage, la page
 * s'affiche seule : elle redirige elle-même vers la connexion ou l'onboarding.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  const wedding = userId ? await getCurrentWedding(supabase) : null;
  if (!userId || !wedding) return children;

  const [role, weddings, format] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getUserWeddings(supabase, userId),
    getFormatter(),
  ]);
  const profile: ShellProfile = {
    title: wedding.title,
    initials: monogram(wedding.title),
    date: wedding.wedding_date
      ? format.dateTime(isoDateToUtc(wedding.wedding_date), {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : null,
    canSeeBudget: role === "owner" || role === "partner",
    weddingId: wedding.id,
    weddings: weddings.map(({ id, title, role: weddingRole }) => ({ id, title, role: weddingRole })),
  };

  return (
    <>
      <Sidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64 print:p-0">
        <MobileHeader />
        {children}
      </div>
      <MobileNav profile={profile} />
    </>
  );
}
