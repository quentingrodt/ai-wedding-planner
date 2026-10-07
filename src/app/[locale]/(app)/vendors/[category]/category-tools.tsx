import type { ReactNode } from "react";
import type { Guest } from "@/lib/guests/schema";
import type { VendorCategory } from "@/lib/vendors/catalog";
import { departureMonth, websiteCoveredByCeleste } from "@/lib/vendors/tools";
import {
  getGuestFamilies,
  getLodging,
  getSeatingTables,
  getVendorPlan,
} from "@/lib/weddings/queries";
import type { createClient } from "@/utils/supabase/client";
import { BridesmaidsTools, GroomsmenTools, GroomSuitTools, RingsTools } from "../_components/tools/attire-tools";
import { CakeTools } from "../_components/tools/cake-tools";
import { CateringTools } from "../_components/tools/catering-tools";
import { GettingReadyTools } from "../_components/tools/getting-ready-tools";
import { GownGuide, HoneymoonGuide } from "../_components/tools/guides";
import { GiftTools, StationeryTools, WebsiteTools } from "../_components/tools/paper-tools";

type ToolsContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  weddingId: string;
  weddingDate: string | null;
  currency: string;
  /** Invités qui n'ont pas décliné. */
  guests: Guest[];
  guestCount: number | null;
  today: string;
};

/** Le carnet d'une catégorie, avec les données du mariage dont il a besoin (null s'il n'y en a pas). */
export async function categoryTools(category: VendorCategory, context: ToolsContext): Promise<ReactNode> {
  const { supabase, weddingId, guestCount } = context;

  switch (category) {
    case "catering":
      return <CateringTools initial={await getVendorPlan(supabase, weddingId, "catering")} guestCount={guestCount} />;
    case "cake":
      return <CakeTools initial={await getVendorPlan(supabase, weddingId, "cake")} guestCount={guestCount} />;
    case "hair":
    case "makeup":
      // Un seul planning du matin, partagé par la coiffeuse et la maquilleuse.
      return <GettingReadyTools initial={await getVendorPlan(supabase, weddingId, "hair")} />;
    case "rings":
      return <RingsTools initial={await getVendorPlan(supabase, weddingId, "rings")} />;
    case "bridesmaids":
      return <BridesmaidsTools initial={await getVendorPlan(supabase, weddingId, "bridesmaids")} />;
    case "groom_suit":
      return <GroomSuitTools initial={await getVendorPlan(supabase, weddingId, "groom_suit")} />;
    case "groomsmen":
      return <GroomsmenTools initial={await getVendorPlan(supabase, weddingId, "groomsmen")} />;
    case "guest_gifts":
      return <GiftTools initial={await getVendorPlan(supabase, weddingId, "guest_gifts")} guestCount={guestCount} />;
    case "bridal_gown":
      return <GownGuide />;
    case "honeymoon":
      return <HoneymoonGuide month={departureMonth(context.weddingDate, context.today)} />;
    case "stationery": {
      const [plan, families, tables] = await Promise.all([
        getVendorPlan(supabase, weddingId, "stationery"),
        getGuestFamilies(supabase, weddingId),
        getSeatingTables(supabase, weddingId),
      ]);
      // Un faire-part par foyer : chaque famille, plus chaque invité sans famille.
      const familyIds = new Set(families.map((family) => family.id));
      const households =
        new Set(context.guests.flatMap((guest) => (guest.family_id && familyIds.has(guest.family_id) ? [guest.family_id] : []))).size +
        context.guests.filter((guest) => !guest.family_id || !familyIds.has(guest.family_id)).length;
      return (
        <StationeryTools
          initial={plan}
          context={{ households, guests: guestCount ?? 0, tables: tables.length }}
          currency={context.currency}
        />
      );
    }
    case "website": {
      const [plan, { lodgings }, registry] = await Promise.all([
        getVendorPlan(supabase, weddingId, "website"),
        getLodging(supabase, weddingId),
        supabase.from("registries").select("wedding_id").eq("wedding_id", weddingId).maybeSingle(),
      ]);
      const covered = websiteCoveredByCeleste({
        hasGuests: context.guests.length > 0,
        hasRegistry: registry.data !== null,
        sharesLodging: lodgings.some((lodging) => lodging.status === "option" || lodging.status === "confirmed"),
        hasDate: context.weddingDate !== null,
      });
      return <WebsiteTools initial={plan} covered={[...covered]} />;
    }
    default:
      return null;
  }
}
