import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export type LoginErrorCode = "invalidEmail" | "rateLimited" | "generic";

/** État renvoyé par la Server Action ; les messages sont traduits côté UI. */
export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; code: LoginErrorCode };
