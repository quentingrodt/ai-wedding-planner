import type { ShellProfile } from "./nav-config";

/** Les prénoms du mariage et sa date, sous un monogramme. */
export function ProfileCard({ profile }: { profile: ShellProfile }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terracotta-soft font-serif text-sm text-terracotta"
      >
        {profile.initials}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-serif text-base text-charcoal">{profile.title}</span>
        {profile.date && <span className="truncate text-xs text-stone">{profile.date}</span>}
      </span>
    </div>
  );
}
