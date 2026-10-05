"use client";

import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Export PDF via la boîte d'impression du navigateur (« Enregistrer en PDF »). */
export function PrintButton() {
  const t = useTranslations("Itinerary");
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => window.print()}
      className="h-11 rounded-full bg-card px-5 print:hidden"
    >
      <PrinterIcon aria-hidden />
      {t("export")}
    </Button>
  );
}
