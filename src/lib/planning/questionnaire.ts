import {
  ATTIRE_CHOICES,
  DONE_OPTIONS,
  MUSIC_CHOICES,
  STATIONERY_CHOICES,
  TRADITIONS,
  type DoneOption,
  type PlanningAnswers,
  type Tradition,
} from "./schema";

/*
 * Questions d'accompagnement, une carte par question. Chaque choix se traduit
 * en réponses (PlanningAnswers) ; current() retrouve le choix d'après des
 * réponses enregistrées, pour pré-sélectionner la carte quand on les ajuste.
 * Questions « multi » : plusieurs options, validées par un bouton.
 * Libellés : Planning.questionnaire.questions.<id>.
 */

type SingleQuestion<Id extends string, Option extends string> = {
  id: Id;
  kind: "single";
  options: readonly Option[];
  apply: (answers: PlanningAnswers, option: Option) => PlanningAnswers;
  current: (answers: PlanningAnswers) => Option;
};

type MultiQuestion<Id extends string, Option extends string> = {
  id: Id;
  kind: "multi";
  options: readonly Option[];
  apply: (answers: PlanningAnswers, options: Option[]) => PlanningAnswers;
  current: (answers: PlanningAnswers) => Option[];
};

const yesNo = <Id extends string>(
  id: Id,
  field: "guestAccommodation" | "weddingParty",
): SingleQuestion<Id, "yes" | "no"> => ({
  id,
  kind: "single",
  options: ["yes", "no"],
  apply: (answers, option) => ({ ...answers, [field]: option === "yes" }),
  current: (answers) => (answers[field] ? "yes" : "no"),
});

export const PLANNING_QUESTIONS = [
  {
    id: "ceremony",
    kind: "single",
    options: ["civil", "religious", "secular", "both"],
    apply: (answers, option) => ({
      ...answers,
      religiousCeremony: option === "religious" || option === "both",
      secularCeremony: option === "secular" || option === "both",
    }),
    current: ({ religiousCeremony, secularCeremony }) =>
      religiousCeremony && secularCeremony
        ? "both"
        : religiousCeremony
          ? "religious"
          : secularCeremony
            ? "secular"
            : "civil",
  } satisfies SingleQuestion<"ceremony", "civil" | "religious" | "secular" | "both">,
  {
    id: "done",
    kind: "multi",
    options: DONE_OPTIONS,
    apply: (answers, options) => ({ ...answers, alreadyDone: options }),
    current: (answers) => answers.alreadyDone,
  } satisfies MultiQuestion<"done", DoneOption>,
  {
    id: "catering",
    kind: "single",
    // « Nous ne savons pas » : on garde la recherche du traiteur, par prudence.
    options: ["yes", "no", "unknown"],
    apply: (answers, option) => ({ ...answers, cateringByVenue: option === "yes" }),
    current: (answers) => (answers.cateringByVenue ? "yes" : "no"),
  } satisfies SingleQuestion<"catering", "yes" | "no" | "unknown">,
  {
    id: "music",
    kind: "single",
    options: MUSIC_CHOICES,
    apply: (answers, option) => ({ ...answers, music: option }),
    current: (answers) => answers.music,
  } satisfies SingleQuestion<"music", (typeof MUSIC_CHOICES)[number]>,
  {
    id: "photo",
    kind: "single",
    options: ["photographer", "photo_video", "friends"],
    apply: (answers, option) => ({
      ...answers,
      photographer: option !== "friends",
      videographer: option === "photo_video",
    }),
    current: ({ photographer, videographer }) =>
      !photographer ? "friends" : videographer ? "photo_video" : "photographer",
  } satisfies SingleQuestion<"photo", "photographer" | "photo_video" | "friends">,
  {
    id: "attire",
    kind: "single",
    options: ATTIRE_CHOICES,
    apply: (answers, option) => ({ ...answers, attire: option }),
    current: (answers) => answers.attire,
  } satisfies SingleQuestion<"attire", (typeof ATTIRE_CHOICES)[number]>,
  yesNo("party", "weddingParty"),
  {
    id: "stationery",
    kind: "single",
    options: STATIONERY_CHOICES,
    apply: (answers, option) => ({ ...answers, stationery: option }),
    current: (answers) => answers.stationery,
  } satisfies SingleQuestion<"stationery", (typeof STATIONERY_CHOICES)[number]>,
  {
    id: "traditions",
    kind: "multi",
    options: TRADITIONS,
    apply: (answers, options) => ({ ...answers, traditions: options }),
    current: (answers) => answers.traditions,
  } satisfies MultiQuestion<"traditions", Tradition>,
  yesNo("accommodation", "guestAccommodation"),
  {
    id: "honeymoon",
    kind: "single",
    // Un voyage plus tard n'a pas sa place dans le rétroplanning.
    options: ["right_after", "later", "none"],
    apply: (answers, option) => ({ ...answers, honeymoon: option === "right_after" }),
    current: (answers) => (answers.honeymoon ? "right_after" : "none"),
  } satisfies SingleQuestion<"honeymoon", "right_after" | "later" | "none">,
  {
    id: "contract",
    kind: "single",
    // « Nous ne savons pas » : un rendez-vous chez le notaire aide à décider.
    options: ["yes", "no", "unknown"],
    apply: (answers, option) => ({ ...answers, marriageContract: option !== "no" }),
    current: (answers) => (answers.marriageContract ? "yes" : "no"),
  } satisfies SingleQuestion<"contract", "yes" | "no" | "unknown">,
] as const;

export type PlanningQuestion = (typeof PLANNING_QUESTIONS)[number];
export type PlanningQuestionId = PlanningQuestion["id"];

// Vue uniforme des questions : chaque option provient de question.options.
type AnySingle = SingleQuestion<PlanningQuestionId, string>;
type AnyMulti = MultiQuestion<PlanningQuestionId, string>;

/** Réponses après le choix d'une option (question simple). */
export function chooseOption(
  question: PlanningQuestion,
  answers: PlanningAnswers,
  option: string,
): PlanningAnswers {
  return (question as AnySingle).apply(answers, option);
}

/** Réponses après validation d'une sélection (question multiple). */
export function chooseOptions(
  question: PlanningQuestion,
  answers: PlanningAnswers,
  options: string[],
): PlanningAnswers {
  return (question as AnyMulti).apply(answers, options);
}

/** Option(s) correspondant à des réponses enregistrées. */
export function currentOption(question: PlanningQuestion, answers: PlanningAnswers): string {
  return (question as AnySingle).current(answers);
}

export function currentOptions(question: PlanningQuestion, answers: PlanningAnswers): string[] {
  return (question as AnyMulti).current(answers);
}
