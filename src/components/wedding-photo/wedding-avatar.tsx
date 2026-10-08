import { cn } from "@/lib/utils";

type WeddingAvatarProps = {
  photoUrl: string | null;
  /** Monogramme affiché sans photo (« Q&A »). */
  initials: string;
  className?: string;
};

/** Portrait rond du couple, ou son monogramme tant qu'aucune photo n'est choisie. */
export function WeddingAvatar({ photoUrl, initials, className }: WeddingAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta-soft font-serif text-terracotta",
        className,
      )}
    >
      {photoUrl ? (
        // URL signée et temporaire du bucket privé : pas d'optimisation next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
