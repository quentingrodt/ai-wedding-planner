import { Button } from "@/components/ui/button";

// Écran de test du design system (temporaire) — les textes passeront
// dans les dictionnaires next-intl à l'étape 3.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full min-w-0 max-w-2xl flex-col items-start gap-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">
          Design system
        </span>
        <h1 className="text-5xl leading-tight tracking-tight wrap-break-word sm:text-6xl">
          Votre mariage, pensé avec soin.
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Un copilote discret qui anticipe chaque étape, du premier devis au
          dernier slow, pour que vous profitiez pleinement de l&apos;essentiel.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">Commencer</Button>
          <Button size="lg" variant="secondary">
            Découvrir
          </Button>
          <Button size="lg" variant="outline">
            En savoir plus
          </Button>
        </div>
        <div className="flex gap-3" aria-hidden>
          {["bg-ivory border", "bg-linen", "bg-sand", "bg-sage", "bg-terracotta", "bg-charcoal"].map(
            (c) => (
              <div key={c} className={`size-10 rounded-full ${c}`} />
            ),
          )}
        </div>
      </div>
    </main>
  );
}
