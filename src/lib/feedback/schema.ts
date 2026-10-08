import { z } from "zod";

/* Retours des testeurs (000038) : envoyés depuis le menu de l'application. */

export const FEEDBACK_KINDS = ["problem", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MAX_LENGTH = 2000;

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
  // Chemin de la page, sans paramètres : ils peuvent contenir un jeton.
  page: z
    .string()
    .max(300)
    .regex(/^\/[^?#]*$/)
    .nullable(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export type FeedbackError = "invalid" | "unauthenticated" | "tooMany" | "generic";
export type FeedbackResult = { ok: true } | { ok: false; error: FeedbackError };
