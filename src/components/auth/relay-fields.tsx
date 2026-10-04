import { HANDOFF_KEYS, type Handoff } from "@/lib/onboarding/schema";

type RelayFieldsProps = {
  /** Projet Date Night à relayer jusqu'à l'onboarding. */
  handoff: Handoff;
  /** Token d'invitation à relayer jusqu'à la page d'invitation. */
  invite?: string;
};

/** Champs cachés qui font suivre le projet Date Night et l'invitation après l'auth. */
export function RelayFields({ handoff, invite }: RelayFieldsProps) {
  return (
    <>
      {HANDOFF_KEYS.map(
        (key) =>
          handoff[key] !== undefined && (
            <input key={key} type="hidden" name={key} value={String(handoff[key])} />
          ),
      )}
      {invite && <input type="hidden" name="invite" value={invite} />}
    </>
  );
}

/** Même relais, sous forme de query pour un lien (connexion ↔ inscription). */
export function relayQuery(handoff: Handoff, invite?: string): Record<string, string> {
  return Object.fromEntries([
    ...HANDOFF_KEYS.flatMap((key) =>
      handoff[key] === undefined ? [] : [[key, String(handoff[key])]],
    ),
    ...(invite ? [["invite", invite]] : []),
  ]);
}
