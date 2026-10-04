import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/lib/auth/actions";

/** Lien discret de déconnexion (formulaire : fonctionne sans JavaScript). */
export async function SignOutButton() {
  const t = await getTranslations("Auth");
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 decoration-sand transition-colors hover:text-foreground hover:decoration-terracotta"
      >
        <LogOutIcon aria-hidden className="size-4" />
        {t("signOut")}
      </button>
    </form>
  );
}
