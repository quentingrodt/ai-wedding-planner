import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrappers de navigation conscients de la locale : à utiliser à la place
// de next/link et next/navigation dans toute l'app.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
