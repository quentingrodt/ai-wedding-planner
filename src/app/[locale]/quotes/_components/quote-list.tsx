import { FileTextIcon, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuoteStatus } from "@/lib/quotes/schema";
import { cn } from "@/lib/utils";

/** Devis prêt à afficher : date déjà formatée côté serveur. */
export type QuoteCard = {
  id: string;
  fileName: string;
  addedLabel: string;
  status: QuoteStatus;
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  uploaded: "bg-sage-soft text-sage-deep",
  analyzing: "bg-linen text-stone",
  processed: "bg-sage text-ivory",
  error: "bg-terracotta-soft text-terracotta",
};

const isImage = (fileName: string) => /\.(png|jpe?g)$/i.test(fileName);

/** Cartes des devis téléversés, du plus récent au plus ancien. */
export function QuoteList({ quotes }: { quotes: QuoteCard[] }) {
  const t = useTranslations("Quotes");

  return (
    <section aria-labelledby="quotes-list-title" className="flex flex-col gap-4">
      <h2 id="quotes-list-title" className="text-2xl">
        {t("list.title")}
      </h2>

      {quotes.length === 0 ? (
        <p className="text-stone">{t("list.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quotes.map((quote) => {
            const Icon = isImage(quote.fileName) ? ImageIcon : FileTextIcon;
            return (
              <li
                key={quote.id}
                className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linen text-sage-deep">
                  <Icon aria-hidden strokeWidth={1.5} className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate" title={quote.fileName}>
                    {quote.fileName}
                  </span>
                  <span className="text-sm text-stone">
                    {t("list.added", { date: quote.addedLabel })}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                    STATUS_STYLES[quote.status],
                  )}
                >
                  {t(`status.${quote.status}`)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
