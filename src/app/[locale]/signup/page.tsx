import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, authLinkClassName } from "@/components/auth/auth-layout";
import { relayQuery } from "@/components/auth/relay-fields";
import { Link } from "@/i18n/navigation";
import { parseHandoff } from "@/lib/onboarding/schema";
import { parseInviteToken } from "@/lib/team/schema";
import { hasProject, ProjectRecap } from "./project-recap";
import { SignupForm } from "./signup-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("signup.metaTitle") };
}

export default async function SignupPage({
  params,
  searchParams,
}: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const query = await searchParams;
  const t = await getTranslations("Auth");

  // Projet Date Night et invitation éventuels : relayés après l'inscription.
  const handoff = parseHandoff(query);
  const invite = parseInviteToken(query.invite);

  // Arrivée depuis Date Night : on rappelle le projet pour donner envie de le sauvegarder.
  const showProject = !invite && hasProject(handoff);

  return (
    <AuthLayout
      title={showProject ? t("signup.project.title") : t("signup.title")}
      subtitle={
        invite
          ? t("signup.inviteSubtitle")
          : showProject
            ? t("signup.project.subtitle")
            : t("signup.subtitle")
      }
      footer={
        <>
          {t("signup.hasAccount")}{" "}
          <Link
            href={{ pathname: "/login", query: relayQuery(handoff, invite) }}
            className={authLinkClassName}
          >
            {t("signup.loginLink")}
          </Link>
        </>
      }
    >
      {showProject && <ProjectRecap handoff={handoff} />}
      <SignupForm handoff={handoff} invite={invite} />
    </AuthLayout>
  );
}
