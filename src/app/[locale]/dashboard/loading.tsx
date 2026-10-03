import { Skeleton } from "@/components/ui/skeleton";

/** Silhouette du tableau de bord pendant le chargement des données. */
export default function DashboardLoading() {
  return (
    <main
      aria-busy
      className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20"
    >
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-28 rounded-full bg-terracotta-soft/70" />
          <Skeleton className="h-11 w-4/5 rounded-full bg-linen" />
          <Skeleton className="h-5 w-3/5 rounded-full bg-linen" />
        </div>

        <div className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
          <Skeleton className="h-7 w-24 rounded-full bg-linen" />
          <Skeleton className="h-10 w-1/2 rounded-full bg-linen" />
          <Skeleton className="h-3 w-full rounded-full bg-linen" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-10 rounded-2xl bg-linen/70" />
            <Skeleton className="h-10 rounded-2xl bg-sage-soft/60" />
            <Skeleton className="h-10 rounded-2xl bg-linen/70" />
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
          <Skeleton className="h-7 w-40 rounded-full bg-linen" />
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-start gap-4">
              <Skeleton className="size-6 shrink-0 rounded-full bg-sage-soft/70" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4 rounded-full bg-linen" />
                <Skeleton className="h-3 w-1/3 rounded-full bg-linen/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
