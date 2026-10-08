import type { BudgetItem } from "@/lib/budget/schema";
import type { CalendarEvent } from "@/lib/calendar/schema";
import type { UpcomingPayment } from "@/lib/vendors/payments";
import { daysBetween } from "@/lib/weddings/dates";

/*
 * « Vos priorités » de l'accueil : les retards, puis les prochaines échéances
 * datées, quel que soit leur éloignement. Calcul pur, sans requête ni traduction.
 */

/** Nombre de priorités affichées, pour que l'accueil reste lisible. */
export const MAX_PRIORITIES = 4;

export type Priority =
  | { kind: "overdueTasks"; count: number }
  | { kind: "payment"; payment: UpcomingPayment & { due: string; days: number } }
  | { kind: "event"; event: CalendarEvent; days: number }
  | { kind: "rsvp"; pending: number };

export type PriorityInput = {
  today: string;
  overdueTasks: number;
  /** Versements non réglés (upcomingPayments) ; vide pour un témoin. */
  payments: readonly UpcomingPayment[];
  events: readonly CalendarEvent[];
  /** Invités sans réponse ; null quand l'information n'est pas lue. */
  pendingGuests: number | null;
};

/** Une priorité en retard rend l'accueil « à surveiller ». */
export function isLate(priority: Priority): boolean {
  if (priority.kind === "overdueTasks") return true;
  if (priority.kind === "payment") return priority.payment.days < 0;
  return false;
}

// Retards d'abord, puis versements et rendez-vous par date, enfin les
// réponses attendues, qui n'ont pas d'échéance propre.
function rank(priority: Priority): [number, number] {
  switch (priority.kind) {
    case "payment":
      return [priority.payment.days < 0 ? 0 : 2, priority.payment.days];
    case "overdueTasks":
      return [1, 0];
    case "event":
      return [2, priority.days];
    case "rsvp":
      return [3, 0];
  }
}

export function buildPriorities(input: PriorityInput): Priority[] {
  const priorities: Priority[] = [];

  if (input.overdueTasks > 0) {
    priorities.push({ kind: "overdueTasks", count: input.overdueTasks });
  }

  // Un versement sans date n'est pas une échéance : l'échéancier le garde.
  for (const payment of input.payments) {
    if (payment.due !== null && payment.days !== null) {
      priorities.push({ kind: "payment", payment: { ...payment, due: payment.due, days: payment.days } });
    }
  }

  for (const event of input.events) {
    const days = daysBetween(input.today, event.event_date);
    if (days >= 0) priorities.push({ kind: "event", event, days });
  }

  if (input.pendingGuests !== null && input.pendingGuests > 0) {
    priorities.push({ kind: "rsvp", pending: input.pendingGuests });
  }

  return priorities
    .sort((a, b) => {
      const [rankA, daysA] = rank(a);
      const [rankB, daysB] = rank(b);
      return rankA - rankB || daysA - daysB;
    })
    .slice(0, MAX_PRIORITIES);
}

/** Postes mis en avant dans le budget compact de l'accueil. */
export type BudgetHighlights = {
  /** « over » : postes en dépassement ; « largest » : plus gros postes prévus. */
  mode: "over" | "largest";
  items: BudgetItem[];
};

export const BUDGET_HIGHLIGHTS = 3;

export function budgetHighlights(items: readonly BudgetItem[]): BudgetHighlights {
  const overrun = (item: BudgetItem) => (item.actual_amount ?? 0) - item.estimated_amount;
  const over = items.filter((item) => item.actual_amount !== null && overrun(item) > 0);
  if (over.length > 0) {
    return {
      mode: "over",
      items: [...over].sort((a, b) => overrun(b) - overrun(a)).slice(0, BUDGET_HIGHLIGHTS),
    };
  }
  return {
    mode: "largest",
    items: items
      .filter((item) => item.estimated_amount > 0)
      .sort((a, b) => b.estimated_amount - a.estimated_amount)
      .slice(0, BUDGET_HIGHLIGHTS),
  };
}
