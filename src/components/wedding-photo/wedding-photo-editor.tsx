"use client";

import { CameraIcon, ImageUpIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  WEDDING_PHOTO_BUCKET,
  WEDDING_PHOTO_INPUT_MAX_BYTES,
  type WeddingPhotoError,
} from "@/lib/weddings/photo";
import {
  prepareWeddingPhotoUpload,
  removeWeddingPhoto,
  setWeddingPhoto,
} from "@/lib/weddings/photo-actions";
import { cropToSquareJpeg } from "@/lib/weddings/photo-crop";
import { createClient } from "@/utils/supabase/browser";
import { WeddingAvatar } from "./wedding-avatar";

type WeddingPhotoEditorProps = {
  photoUrl: string | null;
  initials: string;
  /** Mariés seulement : un témoin voit la photo sans pouvoir la changer. */
  canEdit: boolean;
  className?: string;
};

/** Recadre, envoie vers Storage, puis enregistre la photo du couple. */
async function uploadPhoto(file: File): Promise<WeddingPhotoError | null> {
  if (!file.type.startsWith("image/")) return "invalidType";
  if (file.size > WEDDING_PHOTO_INPUT_MAX_BYTES) return "tooLarge";
  let photo: Blob;
  try {
    photo = await cropToSquareJpeg(file);
  } catch {
    // Format que le navigateur ne sait pas lire (HEIC hors Safari, par exemple).
    return "invalidType";
  }
  const prepared = await prepareWeddingPhotoUpload({ mimeType: "image/jpeg", size: photo.size });
  if (!prepared.ok) return prepared.error;
  const { error } = await createClient()
    .storage.from(WEDDING_PHOTO_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, photo, { contentType: "image/jpeg" });
  if (error) return "generic";
  const saved = await setWeddingPhoto(prepared.path);
  return saved.ok ? null : saved.error;
}

/**
 * Portrait rond du couple, en tête du tableau de bord. Les mariés le touchent
 * pour ajouter, changer ou retirer la photo.
 */
export function WeddingPhotoEditor({ photoUrl, initials, canEdit, className }: WeddingPhotoEditorProps) {
  const t = useTranslations("WeddingPhoto");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const avatar = <WeddingAvatar photoUrl={photoUrl} initials={initials} className={cn("text-2xl", className)} />;
  if (!canEdit) return avatar;

  async function run(action: () => Promise<WeddingPhotoError | null>) {
    setPending(true);
    let error: WeddingPhotoError | null;
    try {
      error = await action();
    } catch {
      error = "generic";
    }
    setPending(false);
    if (error) toast.error(t(`errors.${error}`));
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Réinitialisé : choisir à nouveau le même fichier relance l'envoi.
    event.target.value = "";
    if (file) void run(() => uploadPhoto(file));
  }

  const pickFile = () => inputRef.current?.click();

  const face = (
    <span className="relative block">
      {pending ? <Skeleton className={cn("rounded-full bg-sand/60", className)} /> : avatar}
      <span
        aria-hidden
        className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-card text-sage-deep shadow-sm ring-1 ring-border transition-transform group-hover:scale-105"
      >
        <CameraIcon className="size-3.5" />
      </span>
    </span>
  );
  const triggerClass =
    "group shrink-0 rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70";

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={onFile}
      />
      {photoUrl === null ? (
        <button type="button" onClick={pickFile} disabled={pending} aria-label={t("add")} className={triggerClass}>
          {face}
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger disabled={pending} aria-label={t("label")} className={triggerClass}>
            {face}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
            <DropdownMenuItem className="gap-2 rounded-xl px-2.5 py-2" onSelect={pickFile}>
              <ImageUpIcon aria-hidden className="size-4 text-stone" />
              {t("change")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-xl px-2.5 py-2 text-terracotta"
              onSelect={() =>
                void run(async () => {
                  const result = await removeWeddingPhoto();
                  return result.ok ? null : result.error;
                })
              }
            >
              <Trash2Icon aria-hidden className="size-4" />
              {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
