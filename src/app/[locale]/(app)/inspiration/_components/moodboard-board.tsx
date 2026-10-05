"use client";

import { ImagePlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isMoodboardMimeType,
  MOODBOARD_BUCKET,
  MOODBOARD_CATEGORIES,
  MOODBOARD_MAX_BYTES,
  MOODBOARD_MIME_TYPES,
  type MoodboardCategory,
  type MoodboardError,
  type MoodboardItem,
  type MoodboardPhoto,
} from "@/lib/moodboard/schema";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/browser";
import {
  addPinterestBoard,
  deleteMoodboardItem,
  prepareMoodboardUpload,
  registerMoodboardPhoto,
} from "../planche/actions";
import { MoodboardItemDialog } from "./moodboard-item-dialog";
import { PinterestBoard } from "./pinterest-board";

type Filter = MoodboardCategory | "all";

/** Planche de tendances : photos du couple et de ses proches, tableaux Pinterest. */
export function MoodboardBoard({
  photos,
  boards,
  currentUserId,
  isCouple,
}: {
  photos: MoodboardPhoto[];
  boards: MoodboardItem[];
  currentUserId: string;
  isCouple: boolean;
}) {
  const t = useTranslations("Inspiration.moodboard");
  const [filter, setFilter] = useState<Filter>("all");
  const canManage = (item: MoodboardItem) => isCouple || item.created_by === currentUserId;

  const counts = new Map<MoodboardCategory, number>();
  for (const photo of photos) {
    if (photo.category) counts.set(photo.category, (counts.get(photo.category) ?? 0) + 1);
  }
  const visible = filter === "all" ? photos : photos.filter((photo) => photo.category === filter);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="photos-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="photos-title" className="font-serif text-3xl">
            {t("photos.title")}
          </h2>
          <p className="text-stone">{t("photos.intro")}</p>
        </div>

        <PhotoDropzone />

        {photos.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex w-max gap-2">
              {(["all", ...MOODBOARD_CATEGORIES] as const)
                .filter((key) => key === "all" || counts.has(key))
                .map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm whitespace-nowrap ring-1 transition-colors",
                      filter === key
                        ? "bg-sage-soft text-sage-deep ring-sage/40"
                        : "bg-ivory text-stone ring-sand hover:text-charcoal",
                    )}
                  >
                    {key === "all" ? t("filters.all") : t(`categories.${key}`)}
                    <span className="text-xs tabular-nums opacity-70">
                      {key === "all" ? photos.length : counts.get(key)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {photos.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
            {t("photos.empty")}
          </p>
        ) : (
          <ul className="columns-2 gap-3 sm:columns-3">
            {visible.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} canManage={canManage(photo)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pinterest-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="pinterest-title" className="font-serif text-3xl">
            {t("pinterest.title")}
          </h2>
          <p className="text-stone">{t("pinterest.intro")}</p>
        </div>
        <PinterestForm />
        {boards.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2">
            {boards.map((board) => (
              <li key={board.id} className="flex flex-col gap-2">
                {board.pinterest_url && <PinterestBoard url={board.pinterest_url} />}
                {canManage(board) && <DeleteButton item={board} label={t("pinterest.remove")} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhotoCard({ photo, canManage }: { photo: MoodboardPhoto; canManage: boolean }) {
  const t = useTranslations("Inspiration.moodboard");
  return (
    <li className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-linen">
      {photo.url ? (
        // URL signée temporaire d'un bucket privé : pas d'optimisation next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.caption ?? t("photos.untitled")}
          loading="lazy"
          className="block w-full"
        />
      ) : (
        <Skeleton className="aspect-[4/5] w-full rounded-none bg-sand/50" />
      )}
      {(photo.caption || photo.category) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-charcoal/70 via-charcoal/25 to-transparent px-3 pt-10 pb-3">
          {photo.category && (
            <span className="w-fit rounded-full bg-ivory/90 px-2 py-0.5 text-[0.68rem] text-charcoal">
              {t(`categories.${photo.category}`)}
            </span>
          )}
          {photo.caption && <p className="text-sm text-ivory text-pretty">{photo.caption}</p>}
        </div>
      )}
      {canManage && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <MoodboardItemDialog
            item={photo}
            trigger={
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={t("photos.edit")}
                className="rounded-full bg-ivory/90 text-charcoal hover:bg-ivory"
              >
                <PencilIcon aria-hidden />
              </Button>
            }
          />
          <DeleteButton item={photo} label={t("photos.delete")} iconOnly />
        </div>
      )}
    </li>
  );
}

function DeleteButton({
  item,
  label,
  iconOnly = false,
}: {
  item: MoodboardItem;
  label: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Inspiration.moodboard");
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteMoodboardItem(item.id);
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  return iconOnly ? (
    <Button
      size="icon-sm"
      variant="secondary"
      onClick={remove}
      disabled={pending}
      aria-label={label}
      className="rounded-full bg-ivory/90 text-charcoal hover:bg-ivory hover:text-terracotta"
    >
      <Trash2Icon aria-hidden />
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={pending}
      className="w-fit rounded-full text-stone hover:text-terracotta"
    >
      <Trash2Icon aria-hidden />
      {label}
    </Button>
  );
}

type PendingUpload = { key: string; name: string };

/** Dépôt de photos : URL signée, envoi direct vers Storage, enregistrement. */
function PhotoDropzone() {
  const t = useTranslations("Inspiration.moodboard");
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  async function uploadOne(file: File): Promise<MoodboardError | null> {
    if (!isMoodboardMimeType(file.type)) return "invalidType";
    if (file.size > MOODBOARD_MAX_BYTES) return "tooLarge";
    const prepared = await prepareMoodboardUpload({ mimeType: file.type, size: file.size });
    if (!prepared.ok) return prepared.error;
    const { error } = await createClient()
      .storage.from(MOODBOARD_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (error) return "generic";
    const registered = await registerMoodboardPhoto({
      path: prepared.path,
      caption: "",
      category: null,
    });
    return registered.ok ? null : registered.error;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const queue = Array.from(files).map((file) => ({ file, key: crypto.randomUUID() }));
    setPending((current) => [
      ...queue.map(({ file, key }) => ({ key, name: file.name })),
      ...current,
    ]);
    await Promise.all(
      queue.map(async ({ file, key }) => {
        let error: MoodboardError | null;
        try {
          error = await uploadOne(file);
        } catch {
          error = "generic";
        }
        setPending((current) => current.filter((item) => item.key !== key));
        if (error) toast.error(t(`errors.${error}`, { name: file.name }));
      }),
    );
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-sage bg-sage-soft/60" : "border-sand bg-linen/60 hover:bg-linen",
        )}
      >
        <ImagePlusIcon aria-hidden className="size-7 text-sage-deep" />
        <span className="font-serif text-xl">{t("upload.title")}</span>
        <span className="text-sm text-stone">{t("upload.hint")}</span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={MOODBOARD_MIME_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {pending.length > 0 && (
        <ul className="columns-2 gap-3 sm:columns-3" aria-label={t("upload.uploading")}>
          {pending.map((upload) => (
            <li key={upload.key} className="mb-3 break-inside-avoid">
              <Skeleton className="aspect-[4/5] w-full rounded-2xl bg-sand/50" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PinterestForm() {
  const t = useTranslations("Inspiration.moodboard.pinterest");
  const tErrors = useTranslations("Inspiration.moodboard.errors");
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MoodboardError | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get("url") ?? "");
    startTransition(async () => {
      const result = await addPinterestBoard(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      form.reset();
      toast(t("added"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor={inputId} className="text-sm text-charcoal">
        {t("label")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t("placeholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          className="h-11 flex-1 rounded-full px-5 text-base"
        />
        <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
          {t("submit")}
        </Button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-terracotta">
          {tErrors(error, { name: "" })}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className="text-xs text-stone">
          {t("hint")}
        </p>
      )}
    </form>
  );
}
