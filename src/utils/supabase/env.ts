// Variables publiques Supabase, vérifiées une seule fois.
// Accès littéral à process.env.NEXT_PUBLIC_* : requis pour l'inlining côté client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies (.env.local).",
  );
}

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
