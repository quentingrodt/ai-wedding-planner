"use client";

import { MapPinIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  parseEvent,
  sortEvents,
  type EventData,
  type EventInput,
  type ItineraryActionError,
  type ItineraryEvent,
} from "@/lib/itinerary/schema";
import { cn } from "@/lib/utils";
import { addEvent, deleteEvent, updateEvent } from "../actions";
import { DeleteEventButton } from "./delete-event-button";
import { EventDialog } from "./event-dialog";

const OPTIMISTIC_PREFIX = "optimistic-";

type OptimisticAction =
  | { type: "add"; event: ItineraryEvent }
  | { type: "update"; id: string; data: EventData }
  | { type: "delete"; id: string };

// Chaque action retrie la liste avec le comparateur de la requête SQL :
// une étape ajoutée ou décalée prend aussitôt sa place définitive.
function applyAction(state: ItineraryEvent[], action: OptimisticAction): ItineraryEvent[] {
  switch (action.type) {
    case "add":
      return sortEvents([...state, action.event]);
    case "update":
      return sortEvents(
        state.map((event) =>
          event.id === action.id
            ? {
                ...event,
                start_time: action.data.startTime,
                title: action.data.title,
                location: action.data.location,
                description: action.data.description,
              }
            : event,
        ),
      );
    case "delete":
      return state.filter((event) => event.id !== action.id);
  }
}

type ItineraryTimelineProps = {
  events: ItineraryEvent[];
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
};

/** Conducteur du jour J : étapes chronologiques, mises à jour instantanées. */
export function ItineraryTimeline({ events, canEdit }: ItineraryTimelineProps) {
  const t = useTranslations("Itinerary");
  const format = useFormatter();
  const [, startTransition] = useTransition();
  const [optimisticEvents, apply] = useOptimistic(events, applyAction);

  // « 14:30 » → « 14:30 » en français, « 2:30 PM » en anglais.
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return format.dateTime(new Date(Date.UTC(1970, 0, 1, hours, minutes)), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  const notifyError = (error: ItineraryActionError) => toast.error(t(`errors.${error}`));

  function add(input: EventInput) {
    const parsed = parseEvent(input);
    if (!parsed.ok) return;
    const { startTime, title, location, description } = parsed.data;
    startTransition(async () => {
      // created_at « maintenant » : à heure égale, la nouvelle étape passe en
      // dernier, comme elle le fera une fois relue depuis la base.
      apply({
        type: "add",
        event: {
          id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
          start_time: startTime,
          title,
          location,
          description,
          created_at: new Date().toISOString(),
        },
      });
      const result = await addEvent(input);
      if (!result.ok) notifyError(result.error);
    });
  }

  function update(event: ItineraryEvent, input: EventInput) {
    const parsed = parseEvent(input);
    if (!parsed.ok) return;
    startTransition(async () => {
      apply({ type: "update", id: event.id, data: parsed.data });
      const result = await updateEvent(event.id, input);
      if (!result.ok) notifyError(result.error);
    });
  }

  function remove(event: ItineraryEvent) {
    startTransition(async () => {
      apply({ type: "delete", id: event.id });
      const result = await deleteEvent(event.id);
      if (!result.ok) {
        notifyError(result.error);
        return;
      }
      toast(t("delete.success", { title: event.title }));
    });
  }

  return (
    <section aria-labelledby="itinerary-steps" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <h2 id="itinerary-steps" className="font-serif text-2xl">
          {t("steps.title")}
        </h2>
        {canEdit && (
          <EventDialog
            onSubmit={add}
            trigger={
              <Button size="lg" className="h-11 rounded-full px-5">
                <PlusIcon aria-hidden />
                {t("add.trigger")}
              </Button>
            }
          />
        )}
      </div>

      {optimisticEvents.length === 0 ? (
        <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone print:bg-white">
          {canEdit ? t("steps.empty") : t("steps.emptyReadOnly")}
        </p>
      ) : (
        <ol className="flex flex-col">
          {optimisticEvents.map((event) => {
            const pending = event.id.startsWith(OPTIMISTIC_PREFIX);
            return (
              <li
                key={event.id}
                className={cn(
                  "group grid grid-cols-[4.5rem_1fr] gap-3 break-inside-avoid sm:grid-cols-[6rem_1fr] sm:gap-5",
                  pending && "opacity-60",
                )}
              >
                <time
                  dateTime={event.start_time}
                  // Le formatage Intl peut différer d'un espace entre Node et le navigateur.
                  suppressHydrationWarning
                  className="pt-5 text-right text-lg font-semibold tabular-nums text-terracotta sm:text-xl"
                >
                  {formatTime(event.start_time)}
                </time>

                <div className="relative pb-5 pl-6 sm:pl-8">
                  {/* Fil du voyage : interrompu avant la première et après la dernière étape. */}
                  <span
                    aria-hidden
                    className="absolute top-0 bottom-0 left-0 w-px bg-sand group-first:top-7 group-last:bottom-auto group-last:h-7 group-only:hidden"
                  />
                  <span
                    aria-hidden
                    className="absolute top-7 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terracotta ring-4 ring-background print:ring-white"
                  />

                  <article className="flex flex-col gap-2 rounded-3xl bg-linen p-5 shadow-sm ring-1 ring-sand/60 print:rounded-xl print:bg-white print:p-4 print:shadow-none print:ring-stone/30">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-serif text-xl leading-snug wrap-break-word">
                        {event.title}
                      </h3>
                      {canEdit && !pending && (
                        <div className="-mt-1 -mr-2 flex shrink-0 items-center print:hidden">
                          <EventDialog
                            event={event}
                            onSubmit={(input) => update(event, input)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("edit.trigger", { title: event.title })}
                                className="text-stone hover:text-sage-deep"
                              >
                                <PencilIcon aria-hidden />
                              </Button>
                            }
                          />
                          <DeleteEventButton
                            eventTitle={event.title}
                            onConfirm={() => remove(event)}
                          />
                        </div>
                      )}
                    </div>
                    {event.location && (
                      <p className="flex items-center gap-1.5 text-sm text-sage-deep">
                        <MapPinIcon aria-hidden className="size-4 shrink-0" />
                        <span className="wrap-break-word">{event.location}</span>
                      </p>
                    )}
                    {event.description && (
                      <p className="text-pretty whitespace-pre-line wrap-break-word text-stone">
                        {event.description}
                      </p>
                    )}
                  </article>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
