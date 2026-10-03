"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { INVITE_ROLES, type InviteRole } from "@/lib/team/schema";
import { generateInvite } from "../actions";

type Invite = { url: string; expiresAt: string };

/** Boutons « Inviter mon conjoint / un témoin » et modale du lien généré. */
export function InviteButtons() {
  const t = useTranslations("Settings");
  const format = useFormatter();
  const [role, setRole] = useState<InviteRole | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // La modale s'ouvre aussitôt : un skeleton occupe la place du lien en attendant.
  function openInvite(nextRole: InviteRole) {
    setRole(nextRole);
    setInvite(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateInvite(nextRole);
      if (result.ok) {
        setInvite({ url: result.url, expiresAt: result.expiresAt });
      } else {
        setRole(null);
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      toast(t("invite.copied"));
    } catch {
      toast.error(t("invite.copyFailed"));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        {INVITE_ROLES.map((inviteRole) => (
          <Button
            key={inviteRole}
            type="button"
            size="lg"
            variant={inviteRole === "partner" ? "default" : "outline"}
            className="h-11 rounded-full px-6"
            disabled={pending}
            onClick={() => openInvite(inviteRole)}
          >
            {t(`invite.${inviteRole}Button`)}
          </Button>
        ))}
      </div>

      <Dialog open={role !== null} onOpenChange={(open) => !open && setRole(null)}>
        <DialogContent closeLabel={t("invite.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {role && t(`invite.${role}Title`)}
            </DialogTitle>
            <DialogDescription>{t("invite.dialogDescription")}</DialogDescription>
          </DialogHeader>

          {invite ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={invite.url}
                  aria-label={t("invite.linkLabel")}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-11 min-w-0 text-base"
                />
                <Button
                  type="button"
                  size="lg"
                  className="h-11 shrink-0 rounded-full px-5"
                  onClick={copyLink}
                >
                  {copied ? (
                    <CheckIcon aria-hidden className="size-4" />
                  ) : (
                    <CopyIcon aria-hidden className="size-4" />
                  )}
                  {copied ? t("invite.copiedButton") : t("invite.copy")}
                </Button>
              </div>
              <p className="text-sm text-stone">
                {t("invite.expires", {
                  date: format.dateTime(new Date(invite.expiresAt), {
                    day: "numeric",
                    month: "long",
                  }),
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" aria-busy>
              <Skeleton className="h-11 w-full rounded-full bg-linen" />
              <Skeleton className="h-4 w-1/2 bg-linen" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
