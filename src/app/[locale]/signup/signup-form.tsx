"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { RelayFields } from "@/components/auth/relay-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_LIMITS, type AuthState } from "@/lib/auth/schema";
import type { Handoff } from "@/lib/onboarding/schema";
import { signUpWithPassword } from "./actions";

const initialState: AuthState = { status: "idle" };

type SignupFormProps = {
  handoff: Handoff;
  invite?: string;
};

export function SignupForm({ handoff, invite }: SignupFormProps) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  // Uniquement si la confirmation d'email est activée côté Supabase.
  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-2xl">{t("signup.sentTitle")}</h2>
        <p className="text-muted-foreground">
          {t("signup.sentDescription", { email: state.email })}
        </p>
      </div>
    );
  }

  const errorCode = state.status === "error" ? state.code : null;
  const emailInvalid = errorCode === "invalidEmail" || errorCode === "emailTaken";
  const passwordInvalid = errorCode === "weakPassword";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <RelayFields handoff={handoff} invite={invite} />
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
          className="h-11 text-base"
          aria-invalid={emailInvalid || undefined}
          aria-describedby={emailInvalid ? "auth-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_LIMITS.min}
          required
          className="h-11 text-base"
          aria-invalid={passwordInvalid || undefined}
          aria-describedby={passwordInvalid ? "auth-error password-hint" : "password-hint"}
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>
      {errorCode && (
        <p id="auth-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${errorCode}`)}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? t("signup.submitting") : t("signup.submit")}
      </Button>
    </form>
  );
}
