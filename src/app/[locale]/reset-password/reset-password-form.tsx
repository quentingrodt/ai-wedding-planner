"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PASSWORD_LIMITS, type AuthState } from "@/lib/auth/schema";
import { updatePassword } from "./actions";

const initialState: AuthState = { status: "idle" };

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  const errorCode = state.status === "error" ? state.code : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("reset.passwordLabel")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_LIMITS.min}
          required
          className="h-11 text-base"
          aria-invalid={errorCode !== null || undefined}
          aria-describedby={errorCode ? "auth-error password-hint" : "password-hint"}
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
        {pending ? t("reset.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}
