import { z } from "zod";
import type { WeddingRole } from "@/lib/weddings/queries";

/** Rôles proposables par invitation (un mariage n'a qu'un owner). */
export const INVITE_ROLES = ["partner", "witness"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const inviteRoleSchema = z.enum(INVITE_ROLES);

/** Le token d'invitation est l'UUID généré par la base. */
export const inviteTokenSchema = z.uuid();

/** Lecture tolérante d'un token reçu en searchParam : invalide → undefined. */
export function parseInviteToken(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = inviteTokenSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Membre de l'équipe, tel qu'affiché dans les paramètres. */
export type TeamMember = {
  user_id: string;
  role: WeddingRole;
  full_name: string | null;
  email: string | null;
};

/** Ordre d'affichage : owner, conjoint, puis témoins. */
export const ROLE_ORDER: Record<WeddingRole, number> = {
  owner: 0,
  partner: 1,
  witness: 2,
};

export type GenerateInviteResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "invalid" | "generic" };

/** Statuts renvoyés par la fonction SQL accept_wedding_invite. */
export type AcceptInviteError = "unauthenticated" | "invalid" | "expired" | "generic";

export type AcceptInviteState = { status: "idle" } | { status: "error"; code: AcceptInviteError };
