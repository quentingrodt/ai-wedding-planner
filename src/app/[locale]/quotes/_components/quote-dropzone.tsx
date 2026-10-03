"use client";

import { FileUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QUOTE_MAX_BYTES,
  QUOTE_MIME_TYPES,
  QUOTES_BUCKET,
  isQuoteMimeType,
  type QuoteUploadError,
} from "@/lib/quotes/schema";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/browser";
import { prepareQuoteUpload, registerQuote } from "../actions";

type PendingUpload = { key: string; name: string };

/**
 * Zone de dépôt des devis. Chaque fichier suit trois temps : URL signée
 * (Server Action), envoi direct navigateur → Storage, enregistrement en base.
 * La liste se met à jour via la revalidation de registerQuote.
 */
export function QuoteDropzone() {
  const t = useTranslations("Quotes");
  const inputId = useId();
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  async function uploadOne(file: File): Promise<QuoteUploadError | null> {
    if (!isQuoteMimeType(file.type)) return "invalidType";
    if (file.size > QUOTE_MAX_BYTES) return "tooLarge";

    const prepared = await prepareQuoteUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (!prepared.ok) return prepared.error;

    const { error } = await createClient()
      .storage.from(QUOTES_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, file, {
        contentType: file.type,
      });
    if (error) return "generic";

    const registered = await registerQuote({
      path: prepared.path,
      fileName: file.name,
    });
    return registered.ok ? null : registered.error;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const queue = Array.from(files).map((file) => ({
      file,
      key: crypto.randomUUID(),
    }));
    setPending((current) => [
      ...queue.map(({ file, key }) => ({ key, name: file.name })),
      ...current,
    ]);

    await Promise.all(
      queue.map(async ({ file, key }) => {
        let error: QuoteUploadError | null;
        try {
          error = await uploadOne(file);
        } catch {
          error = "generic";
        }
        setPending((current) => current.filter((item) => item.key !== key));
        if (error) {
          toast.error(t(`errors.${error}`, { name: file.name }));
        } else {
          toast(t("uploadedToast", { name: file.name }));
        }
      }),
    );
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          // Ignore les sorties vers un élément enfant de la zone.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-sand bg-linen px-6 py-12 text-center transition-colors duration-300 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:py-16",
          dragging ? "border-sage bg-sage-soft/60" : "hover:border-sage/70",
        )}
      >
        <span className="grid size-14 place-items-center rounded-full bg-ivory text-sage-deep ring-1 ring-sand">
          <FileUpIcon aria-hidden strokeWidth={1.5} className="size-6" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-serif text-xl">
            {dragging ? t("dropzone.release") : t("dropzone.title")}
          </span>
          <span className="text-stone">{t("dropzone.browse")}</span>
        </span>
        <span id={hintId} className="text-sm text-stone">
          {t("dropzone.hint")}
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={QUOTE_MIME_TYPES.join(",")}
          aria-describedby={hintId}
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            // Permet de redéposer le même fichier après une erreur.
            event.target.value = "";
          }}
        />
      </label>

      {pending.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-3">
          {pending.map((item) => (
            <li
              key={item.key}
              aria-busy
              className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border"
            >
              <Skeleton className="size-11 shrink-0 rounded-xl bg-linen" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="truncate text-sm">{item.name}</span>
                <Skeleton className="h-3 w-24 rounded-full bg-sage-soft/70" />
              </div>
              <span className="sr-only">{t("uploading")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
