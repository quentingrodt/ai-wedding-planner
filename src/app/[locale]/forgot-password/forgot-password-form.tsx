"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/lib/auth/schema";
import { requestPasswordReset } from "./actions";

const initialState: AuthState = { status: "idle" };

export function ForgotPasswordForm({ linkExpired }: { linkExpired: boolean }) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-2xl">{t("forgot.sentTitle")}</h2>
        <p className="text-muted-foreground">
          {t("forgot.sentDescription", { email: state.email })}
        </p>
      </div>
    );
  }

  const errorCode =
    state.status === "error" ? state.code : linkExpired ? "linkExpired" : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
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
          aria-invalid={errorCode === "invalidEmail" || undefined}
          aria-describedby={errorCode ? "auth-error" : undefined}
        />
      </div>
      {errorCode && (
        <p id="auth-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${errorCode}`)}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? t("forgot.submitting") : t("forgot.submit")}
      </Button>
    </form>
  );
}
