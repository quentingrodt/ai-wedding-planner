import {
  GiftIcon,
  HeartHandshakeIcon,
  HouseIcon,
  PlaneIcon,
  SproutIcon,
  type LucideIcon,
} from "lucide-react";
import type { FundKind } from "@/lib/registry/catalog";

const FUND_ICONS: Record<FundKind, LucideIcon> = {
  honeymoon: PlaneIcon,
  home: HouseIcon,
  life: SproutIcon,
  cause: HeartHandshakeIcon,
  free: GiftIcon,
};

/** Pictogramme d'un projet de l'urne. */
export function FundIcon({ kind, className }: { kind: FundKind; className?: string }) {
  const Icon = FUND_ICONS[kind];
  return <Icon aria-hidden strokeWidth={1.4} className={className} />;
}
