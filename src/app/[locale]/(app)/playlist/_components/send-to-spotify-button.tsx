"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { sendToSpotify } from "@/lib/spotify/actions";
import { cn } from "@/lib/utils";

/** Ajoute à la playlist Spotify du couple les morceaux validés qui n'y sont pas encore. */
export function SendToSpotifyButton() {
  const t = useTranslations("Playlist");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendToSpotify().catch(() => ({ ok: false as const, error: "generic" as const }));
      if (result.ok) {
        toast(t("spotify.sent", { count: result.added }));
        return;
      }
      toast.error(t(`errors.${result.error}`));
      // Accès retiré depuis Spotify : la page repropose de connecter.
      if (result.error === "disconnected") router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={send}
      disabled={pending}
      className={cn(
        "h-10 rounded-full bg-sage-deep px-5 text-ivory hover:bg-charcoal",
        pending && "animate-pulse",
      )}
    >
      <SendIcon aria-hidden className="size-4" />
      {t("spotify.send")}
    </Button>
  );
}
