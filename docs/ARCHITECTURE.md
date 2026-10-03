# MISSION DE CLAUDE CODE
Tu es un Full-Stack Engineer Senior et un Lead Architect. Ta mission est de développer "AI Wedding Planner", une webapp Next.js conçue pour remplacer les wedding planners humains et les guides papier traditionnels.
L'objectif est de réduire la charge mentale des futurs mariés via un copilote IA "invisible", proactif et élégant.

# 1. STACK TECHNIQUE REQUISE
- **Framework Core :** Next.js 16 (App Router, Server Components privilégiés, Server Actions pour les mutations). Note : en v16, `middleware.ts` est renommé `proxy.ts`.
- **Langage :** TypeScript (Mode strict obligatoire).
- **Styling & UI :** Tailwind CSS + Shadcn/ui (pour les composants de base).
- **Base de données & Backend :** Supabase (PostgreSQL 16, Auth, Row Level Security, Storage pour les devis).
- **Internationalisation (i18n) :** `next-intl` (Le produit est multiculturel, aucun texte en dur dans les composants, utiliser les devises dynamiques via `Intl.NumberFormat`). Locale par défaut : `fr` (marché de lancement), servie sans préfixe d'URL (`localePrefix: 'as-needed'`) ; les autres locales sont préfixées (`/en/...`).
- **Intelligence Artificielle :** SDK `@anthropic-ai/sdk` (Claude Sonnet 5.5 `claude-sonnet-5-5` pour la vision/extraction de devis et Claude Haiku 4.5 `claude-haiku-4-5` pour le routage/génération). Utilisation stricte de Structured Outputs (Zod schemas).
- **Paiements :** Stripe (Abonnement mensuel + Paiement unique avec remise).

# 2. DESIGN SYSTEM ET UX ("L'IA INVISIBLE")
L'interface doit s'inspirer de l'édition lifestyle (Vogue, Kinfolk) et de l'hôtellerie (Airbnb). 
- **Zéro interface de chat IA basique.** L'IA agit en arrière-plan et remplit des cartes UI. Pas d'icônes d'étincelles (✨) ou de terminologie technique ("Processing", "Prompt").
- **Typographie :** Titres en police Serif (ex: Playfair Display ou `font-serif`), textes de l'interface en Sans-serif (Inter).
- **Couleurs :** Organiques et douces (Sable, Sauge, Terracotta, Lin, Blanc cassé). Pas de mode sombre technologique.
- **Micro-interactions :** Utiliser des Skeletons élégants pendant les appels IA plutôt que des spinners basiques.

# 3. ARCHITECTURE DES DONNÉES (SUPABASE)
Les tables principales à modéliser (avec RLS strict) :
- `profiles` : Données utilisateurs.
- `weddings` : Un projet de mariage (date, budget_total, currency, country_code, style_dna).
- `wedding_members` : Table de jointure pour le mode collaboratif (conjoint, témoins).
- `tasks` : Rétroplanning (avec dépendances temporelles).
- `budget_items` : Lignes de dépenses (prévu vs réel).
- `quotes` : Devis uploadés (liés au Storage, statut de l'analyse IA).

# 4. RÈGLES DE DÉVELOPPEMENT POUR CLAUDE CODE
1. **Pense avant de coder :** Avant de créer un fichier complexe, crée d'abord les schémas Zod ou les types TypeScript.
2. **Découpage fonctionnel :** Isole la logique IA dans des "Agents" sans état (ex: `src/lib/ai/quote-agent.ts`) qui retournent toujours du JSON typé. L'IA ne fait PAS de calculs mathématiques, elle extrait la donnée. Les calculs budgétaires se font en TS ou SQL.
3. **i18n Day One :** Implémente le routing `/[locale]/...` dès la configuration de base.
4. **Petites étapes :** Valide avec moi à la fin de chaque étape avant de passer à la suivante. Demande confirmation avant d'exécuter des migrations SQL lourdes.

# 5. ROADMAP D'EXÉCUTION (SPRINTS)
**Sprint 1 : Socle et Authentification**
- Initialiser l'app Next.js avec Tailwind et Shadcn.
- Configurer Supabase (Auth par email/Magic Link) et créer les migrations SQL pour `profiles`, `weddings` et `wedding_members`.
- Mettre en place `next-intl` avec un dictionnaire FR et EN vide pour l'instant.

**Sprint 2 : "Date Night" & Onboarding**
- Créer le parcours d'acquisition non authentifié : vue mobile-first type "swipe", sliders de budget/invités.
- À la fin du parcours, appel LLM simulé pour un "Reality Check" chiffré qui pousse à la création de compte.
- Créer le formulaire d'onboarding post-inscription (sauvegarde dans la table `weddings`).

**Sprint 3 : Dashboard & Rétroplanning**
- Implémenter la vue principale : Jauge de budget organique et Timeline éditoriale.
- Créer la table `tasks` et peupler un set de tâches par défaut via un fichier JSON (adapté au `country_code`).
- Rendre les tâches modifiables avec recalcul des dépendances temporelles.

**Sprint 4 : Le "Magic Quote" (Ingestion de devis)**
- Configurer Supabase Storage pour l'upload sécurisé de PDF/Images.
- Créer la Server Action qui envoie le document à l'API Claude Sonnet 5.5 avec un schéma d'extraction strict (Zod).
- Développer l'UI "Split-screen" : Devis original à gauche, Extraction chiffrée et alertes contractuelles à droite.

**Sprint 5 : Monétisation & Dashboard Admin**
- Intégrer Stripe Checkout (Logique de l'abonnement à 5,99€ vs One-shot calculé dynamiquement).
- Créer une route interne `/admin` pour suivre la marge (Revenus - Coûts d'API Anthropic/OpenAI trackés dans une table `ai_usage_logs`).