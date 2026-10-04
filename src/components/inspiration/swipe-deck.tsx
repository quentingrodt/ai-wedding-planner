"use client";

import { Heart, RotateCcw, X } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Image from "next/image";
import { useMessages, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { cn } from "@/lib/utils";
import {
  INSPIRATION_OPTIONS,
  type InspirationOption,
  type InspirationStep,
} from "@/lib/inspiration/catalog";
import { INSPIRATION_PHOTOS, type InspirationPhoto } from "@/lib/inspiration/photos";

type Direction = "left" | "right";

/** Distance (px) ou vitesse (px/s) à partir de laquelle un glissement vaut décision. */
const SWIPE_OFFSET = 110;
const SWIPE_VELOCITY = 600;
/** Assez loin pour sortir de l'écran, quelle que soit sa largeur. */
const EXIT_DISTANCE = 900;
/** Cartes visibles dans la pile (la première + deux en dessous). */
const VISIBLE_CARDS = 3;
/** Départ vif puis ralenti, comme une carte qu'on lance. */
const EXIT_EASE = [0.32, 0.72, 0, 1] as const;

type OptionTexts = { name: string; description: string; alt: string };

type SwipeDeckProps<S extends InspirationStep> = {
  step: S;
  /** Appelé à la fin du paquet avec les choix aimés, dans l'ordre des cartes. */
  onComplete: (likes: InspirationOption<S>[]) => void;
  /** Exige au moins un coup de cœur (sinon, proposition de revoir le paquet). */
  requireLike?: boolean;
};

/**
 * Un paquet de cartes d'inspiration à « swiper » (au doigt, aux boutons ou aux
 * flèches du clavier). Plusieurs coups de cœur sont possibles par étape.
 */
export function SwipeDeck<S extends InspirationStep>({
  step,
  onComplete,
  requireLike = false,
}: SwipeDeckProps<S>) {
  const t = useTranslations("Inspiration.deck");
  const options = INSPIRATION_OPTIONS[step] as readonly InspirationOption<S>[];
  const photos = INSPIRATION_PHOTOS[step] as Record<InspirationOption<S>, InspirationPhoto>;
  // Textes de l'étape d'un bloc : les clés dynamiques « étape.choix » ne sont
  // pas vérifiables par le typage strict de useTranslations.
  const texts = useMessages().Inspiration.options[step] as Record<InspirationOption<S>, OptionTexts>;

  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState<InspirationOption<S>[]>([]);
  const [exit, setExit] = useState<Direction | null>(null);

  const deck = options.slice(index);
  const current = deck[0];

  function requestSwipe(direction: Direction) {
    if (current && !exit) setExit(direction);
  }

  function handleExited(direction: Direction) {
    const nextLikes = direction === "right" && current ? [...likes, current] : likes;
    setExit(null);
    setLikes(nextLikes);
    setIndex((i) => i + 1);
    const isLast = index + 1 >= options.length;
    if (isLast && (!requireLike || nextLikes.length > 0)) onComplete(nextLikes);
  }

  // Flèches du clavier : ← passer, → aimer.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowLeft") requestSwipe("left");
    if (event.key === "ArrowRight") requestSwipe("right");
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Paquet terminé sans le coup de cœur exigé.
  if (!current) {
    return (
      <section className="flex flex-col items-center gap-5 rounded-3xl bg-linen/70 px-6 py-16 text-center">
        <h2 className="text-3xl leading-tight tracking-tight text-balance">
          {t("emptyVenue.title")}
        </h2>
        <p className="max-w-sm leading-7 text-stone">{t("emptyVenue.body")}</p>
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="mt-2 inline-flex h-12 items-center gap-2 rounded-full border border-sage-deep/30 px-6 text-sm font-medium text-sage-deep transition-colors hover:border-sage-deep hover:bg-sage-deep hover:text-ivory"
        >
          <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
          {t("emptyVenue.restart")}
        </button>
      </section>
    );
  }

  const photo = photos[current];

  return (
    <section aria-roledescription="carousel" className="flex flex-col items-center gap-6">
      {/* La pile : la carte du dessus est rendue en dernier pour passer devant.
          Hauteur bornée par l'écran pour garder les boutons visibles sur mobile ;
          mb-8 : place pour les cartes du dessous, décalées vers le bas. */}
      <div className="relative mb-8 aspect-[3/4] h-[min(50svh,32rem)] max-w-full">
        {deck
          .slice(0, VISIBLE_CARDS)
          .map((option, depth) => (
            <InspirationCard
              key={option}
              photo={photos[option]}
              texts={texts[option]}
              depth={depth}
              exit={depth === 0 ? exit : null}
              onDecision={requestSwipe}
              onExited={handleExited}
            />
          ))
          .reverse()}
      </div>

      <div className="flex items-center gap-8">
        <button
          type="button"
          onClick={() => requestSwipe("left")}
          disabled={exit !== null}
          aria-label={t("pass")}
          className="flex size-16 items-center justify-center rounded-full border border-sand bg-ivory text-terracotta shadow-[0_10px_30px_-14px_rgba(43,42,40,0.35)] transition hover:-translate-y-0.5 hover:border-terracotta/40 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <X className="size-6" strokeWidth={1.5} aria-hidden />
        </button>

        <p className="min-w-16 text-center text-xs tracking-[0.2em] text-stone uppercase" aria-live="polite">
          <span className="sr-only">
            {t("position", { current: index + 1, total: options.length })}
          </span>
          <span aria-hidden>
            {index + 1} / {options.length}
          </span>
        </p>

        <button
          type="button"
          onClick={() => requestSwipe("right")}
          disabled={exit !== null}
          aria-label={t("like")}
          className="flex size-16 items-center justify-center rounded-full bg-sage-deep text-ivory shadow-[0_14px_34px_-14px_rgba(63,74,59,0.7)] transition hover:-translate-y-0.5 hover:bg-[#35402f] disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <Heart className="size-6" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <p className="-mt-2 flex flex-col items-center gap-1 text-xs text-stone/80">
        <a href={photo.credit.url} target="_blank" rel="noreferrer" className="hover:text-charcoal">
          {photo.credit.author
            ? t("photoCredit", { author: photo.credit.author, source: photo.credit.source })
            : t("photoCreditAnonymous", { source: photo.credit.source })}
        </a>
        <span className="hidden sm:inline">{t("keyboard")}</span>
      </p>
    </section>
  );
}

type InspirationCardProps = {
  photo: InspirationPhoto;
  texts: OptionTexts;
  /** 0 = carte du dessus ; au-delà, la carte recule dans la pile. */
  depth: number;
  /** Sortie demandée (boutons, clavier ou glissement suffisant). */
  exit: Direction | null;
  onDecision: (direction: Direction) => void;
  onExited: (direction: Direction) => void;
};

function InspirationCard({ photo, texts, depth, exit, onDecision, onExited }: InspirationCardProps) {
  const t = useTranslations("Inspiration.deck");
  const reduceMotion = useReducedMotion();
  const isTop = depth === 0;

  // Position horizontale propre à chaque carte : la suivante démarre au centre.
  const x = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-240, 0, 240], [-12, 0, 12]);
  const likeHint = useTransform(x, [24, 120], [0, 1]);
  const passHint = useTransform(x, [-120, -24], [1, 0]);

  // Lu au moment voulu sans relancer l'animation si le parent se re-rend.
  const notifyExited = useEffectEvent((direction: Direction) => onExited(direction));

  useEffect(() => {
    if (!exit) return;
    const controls = reduceMotion
      ? animate(opacity, 0, { duration: 0.25 })
      : animate(x, (exit === "right" ? 1 : -1) * EXIT_DISTANCE, {
          duration: 0.45,
          ease: EXIT_EASE,
        });
    controls.then(() => notifyExited(exit));
    return () => controls.stop();
  }, [exit, reduceMotion, x, opacity]);

  return (
    <motion.div
      className={cn(
        "absolute inset-0 origin-bottom overflow-hidden rounded-3xl bg-linen shadow-[0_24px_60px_-28px_rgba(43,42,40,0.45)]",
        isTop ? "cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ x, rotate, opacity }}
      // Les cartes du dessous reculent puis avancent d'un cran à chaque décision.
      initial={false}
      animate={{
        scale: 1 - depth * 0.05,
        y: depth * 16,
        filter: depth === 0 ? "brightness(1)" : "brightness(0.92)",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      drag={isTop && !exit ? "x" : false}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const { offset, velocity } = info;
        if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) onDecision("right");
        else if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) onDecision("left");
        else animate(x, 0, { type: "spring", stiffness: 420, damping: 32 });
      }}
      aria-hidden={!isTop}
    >
      <Image
        src={photo.src}
        alt={texts.alt}
        fill
        sizes="(max-width: 640px) 90vw, 384px"
        loading="eager"
        draggable={false}
        className="object-cover select-none"
      />

      {/* Dégradé pour la lisibilité du titre */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-charcoal/85 via-charcoal/35 to-transparent"
      />

      {/* Indices pendant le glissement */}
      {isTop && (
        <>
          <motion.span
            style={{ opacity: likeHint }}
            className="absolute top-6 left-6 inline-flex -rotate-6 items-center gap-2 rounded-full bg-ivory/95 px-4 py-2 text-sm font-medium text-sage-deep shadow-sm"
            aria-hidden
          >
            <Heart className="size-4" strokeWidth={1.5} />
            {t("hintLike")}
          </motion.span>
          <motion.span
            style={{ opacity: passHint }}
            className="absolute top-6 right-6 inline-flex rotate-6 items-center gap-2 rounded-full bg-ivory/95 px-4 py-2 text-sm font-medium text-terracotta shadow-sm"
            aria-hidden
          >
            <X className="size-4" strokeWidth={1.5} />
            {t("hintPass")}
          </motion.span>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-7 text-ivory">
        <h3 className="text-4xl leading-[1.05] tracking-tight text-balance sm:text-[2.6rem]">
          {texts.name}
        </h3>
        <p className="text-sm leading-6 text-ivory/85">{texts.description}</p>
      </div>
    </motion.div>
  );
}
