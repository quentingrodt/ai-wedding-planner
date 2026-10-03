"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AcceptInviteState } from "@/lib/team/schema";
import { acceptInvite } from "./actions";

const initialState: AcceptInviteState = { status: "idle" };

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col items-center gap-4">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="h-11 rounded-full px-8" disabled={pending}>
        {pending ? t("accept.submitting") : t("accept.submit")}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {t(`accept.errors.${state.code}`)}
        </p>
      )}
    </form>
  );
}
