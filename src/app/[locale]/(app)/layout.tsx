import { AppShell } from "@/components/app-shell/app-shell";

/** Espace connecté : chaque page s'affiche dans le menu de l'application. */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return <AppShell>{children}</AppShell>;
}
