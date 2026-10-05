"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/*
 * Widget officiel de tableau Pinterest (assets.pinterest.com/js/pinit.js) :
 * aucun appel d'API ni compte requis, le tableau doit être public. Le script
 * n'est chargé que si la planche contient un tableau.
 */

declare global {
  interface Window {
    PinUtils?: { build: (element?: HTMLElement) => void };
  }
}

const SCRIPT_URL = "https://assets.pinterest.com/js/pinit.js";
let scriptPromise: Promise<void> | null = null;

function loadPinterestScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Pinterest widget unavailable"));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/** Tableau Pinterest public, mis en page par le widget dans le conteneur. */
export function PinterestBoard({ url }: { url: string }) {
  const t = useTranslations("Inspiration.moodboard.pinterest");
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // Lien recréé à chaque montage : le widget remplace son contenu.
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.dataset.pinDo = "embedBoard";
    anchor.dataset.pinBoardWidth = String(Math.max(element.clientWidth, 240));
    anchor.dataset.pinScaleHeight = "320";
    anchor.dataset.pinScaleWidth = "90";
    element.replaceChildren(anchor);
    loadPinterestScript()
      .then(() => window.PinUtils?.build(element))
      .catch(() => element.replaceChildren());
    return () => element.replaceChildren();
  }, [url]);

  const boardName = decodeURIComponent(url.split("/").filter(Boolean).at(-1) ?? "");

  return (
    <div className="flex flex-col gap-2">
      <div ref={host} className="min-h-24 overflow-hidden rounded-3xl bg-linen" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-sage-deep underline decoration-sand underline-offset-4 hover:decoration-sage"
      >
        {t("open", { name: boardName.replaceAll("-", " ") })}
        <ArrowUpRightIcon aria-hidden className="size-4" />
      </a>
    </div>
  );
}
