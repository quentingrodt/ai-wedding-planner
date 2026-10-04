import { z } from "zod";

/**
 * Bornes du mot de passe. Le maximum suit la limite de bcrypt (72 octets)
 * appliquée par Supabase Auth : au-delà, le surplus serait ignoré en silence.
 */
export const PASSWORD_LIMITS = { min: 8, max: 72 } as const;

export const emailSchema = z.email().trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(PASSWORD_LIMITS.min)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_LIMITS.max);

/** Connexion : on ne revérifie pas la longueur, Supabase tranche. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type AuthErrorCode =
  | "invalidEmail"
  | "missingPassword"
  | "weakPassword"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "emailTaken"
  | "samePassword"
  | "rateLimited"
  | "generic";

/** État renvoyé par les Server Actions d'auth ; les messages sont traduits côté UI. */
export type AuthState =
  | { status: "idle" }
  /** Un email a été envoyé (confirmation d'inscription ou réinitialisation). */
  | { status: "sent"; email: string }
  | { status: "error"; code: AuthErrorCode };

/** Traduit une erreur Supabase Auth en code d'erreur affichable. */
export function toAuthErrorCode(error: { status?: number; code?: string }): AuthErrorCode {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return "rateLimited";
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    default:
      return "generic";
  }
}
