"use server";

import { revalidatePath } from "next/cache";
import {
  pledgeFundSchema,
  reserveGiftSchema,
  suggestIdeaSchema,
  withdrawSchema,
  type GuestRegistryError,
  type GuestRegistryResult,
  type PledgeFundInput,
  type ReserveGiftInput,
} from "@/lib/registry/guest";
import { createClient } from "@/utils/supabase/client";

/*
 * Actions de l'invité sur la liste, depuis son lien personnel et sans compte :
 * chaque RPC (SECURITY DEFINER, cf. 000026) n'agit que pour l'invité du jeton.
 */

// Pattern de route : couvre /i/<jeton>/registry (fr) et /en/i/<jeton>/registry.
const revalidateGuestRegistry = () => revalidatePath("/[locale]/i/[token]/registry", "page");

const KNOWN: readonly GuestRegistryError[] = ["invalid", "unavailable", "closed", "limit"];

async function call(fn: string, args: Record<string, unknown>): Promise<GuestRegistryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[registry] ${fn}:`, error.code);
    return { ok: false, error: "generic" };
  }
  if (data === "saved") {
    revalidateGuestRegistry();
    return { ok: true };
  }
  return { ok: false, error: KNOWN.includes(data) ? (data as GuestRegistryError) : "invalid" };
}

/** Réserver un cadeau, ou participer à un cadeau d'exception. */
export async function reserveGift(input: ReserveGiftInput): Promise<GuestRegistryResult> {
  const parsed = reserveGiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { token, giftId, quantity, amount, message } = parsed.data;
  return call("reserve_registry_gift", {
    p_token: token,
    p_gift_id: giftId,
    p_quantity: quantity,
    p_amount: amount,
    p_message: message,
  });
}

/** Annoncer une participation à un projet de l'urne. */
export async function pledgeFund(input: PledgeFundInput): Promise<GuestRegistryResult> {
  const parsed = pledgeFundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { token, fundId, amount, message } = parsed.data;
  return call("pledge_registry_fund", {
    p_token: token,
    p_fund_id: fundId,
    p_amount: amount,
    p_message: message,
  });
}

/** Retirer sa réservation ou sa participation. */
export async function withdrawPledge(token: string, targetId: string): Promise<GuestRegistryResult> {
  const parsed = withdrawSchema.safeParse({ token, targetId });
  if (!parsed.success) return { ok: false, error: "invalid" };
  return call("withdraw_registry_pledge", { p_token: parsed.data.token, p_target_id: parsed.data.targetId });
}

/** Glisser une idée dans la boîte à idées des mariés. */
export async function suggestIdea(token: string, idea: string): Promise<GuestRegistryResult> {
  const parsed = suggestIdeaSchema.safeParse({ token, idea });
  if (!parsed.success) return { ok: false, error: "invalid" };
  return call("suggest_registry_idea", { p_token: parsed.data.token, p_idea: parsed.data.idea });
}
