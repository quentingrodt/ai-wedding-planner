"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HANDOFF_KEYS, type Handoff } from "@/lib/onboarding/schema";
import { signInWithMagicLink } from "./actions";
import type { LoginState } from "./schema";

const initialState: LoginState = { status: "idle" };

type LoginFormProps = {
  linkExpired: boolean;
  /** Projet Date Night à relayer via le Magic Link. */
  handoff: Handoff;
  /** Token d'invitation à relayer via le Magic Link. */
  invite?: string;
};

export function LoginForm({ linkExpired, handoff, invite }: LoginFormProps) {
  const t = useTranslations("Login");
  const [state, formAction, pending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-2xl">{t("sentTitle")}</h2>
        <p className="text-muted-foreground">
          {t("sentDescription", { email: state.email })}
        </p>
      </div>
    );
  }

  const errorCode =
    state.status === "error" ? state.code : linkExpired ? "linkExpired" : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {HANDOFF_KEYS.map(
        (key) =>
          handoff[key] !== undefined && (
            <input
              key={key}
              type="hidden"
              name={key}
              value={String(handoff[key])}
            />
          ),
      )}
      {invite && <input type="hidden" name="invite" value={invite} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          required
          aria-invalid={errorCode === "invalidEmail" || undefined}
          aria-describedby={errorCode ? "login-error" : undefined}
        />
      </div>
      {errorCode && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${errorCode}`)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
