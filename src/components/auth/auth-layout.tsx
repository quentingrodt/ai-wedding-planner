import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Lien secondaire sous le formulaire (connexion ↔ inscription). */
  footer?: ReactNode;
};

/** Mise en page commune aux écrans d'authentification. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        {footer && <p className="text-sm text-muted-foreground">{footer}</p>}
      </div>
    </main>
  );
}

/** Style des liens texte des écrans d'auth. */
export const authLinkClassName =
  "text-foreground underline underline-offset-4 decoration-sand transition-colors hover:decoration-terracotta";
