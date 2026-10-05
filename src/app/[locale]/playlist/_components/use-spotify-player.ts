"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Lecteur Spotify unique piloté par l'iFrame API officielle
 * (https://developer.spotify.com/documentation/embeds/references/iframe-api).
 * Le script n'est chargé qu'au premier clic sur « écouter ».
 */

type PlaybackUpdate = { data: { playingURI: string; isPaused: boolean } };
type Controller = {
  loadUri: (uri: string) => void;
  play: () => void;
  togglePlay: () => void;
  destroy: () => void;
  addListener: {
    (event: "ready", callback: () => void): void;
    (event: "playback_update", callback: (event: PlaybackUpdate) => void): void;
  };
};
type IFrameApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: number },
    callback: (controller: Controller) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void;
  }
}

const SCRIPT_URL = "https://open.spotify.com/embed/iframe-api/v1";
/** Hauteur du lecteur compact de Spotify. */
export const PLAYER_HEIGHT = 80;

let apiPromise: Promise<IFrameApi> | null = null;

function loadIframeApi(): Promise<IFrameApi> {
  apiPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Spotify iFrame API unavailable"));
    };
    document.body.appendChild(script);
  });
  return apiPromise;
}

/**
 * host : conteneur géré par React, dans lequel le lecteur insère son iframe
 * (sur un enfant créé à la main, pour que React ne perde pas le fil du DOM).
 */
export function useSpotifyPlayer() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  // Lecture demandée par un clic : lancée dès que le lecteur est prêt.
  const pendingPlay = useRef(false);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => controller.current?.destroy(), []);

  async function toggle(uri: string) {
    if (controller.current && uri === currentUri) {
      controller.current.togglePlay();
      return;
    }
    setCurrentUri(uri);
    setIsPaused(true);
    pendingPlay.current = true;

    if (controller.current) {
      // play() aussitôt, et de nouveau à « ready » si le chargement l'exige.
      controller.current.loadUri(uri);
      controller.current.play();
      return;
    }
    try {
      const api = await loadIframeApi();
      if (!host.current || controller.current) return;
      const element = document.createElement("div");
      host.current.replaceChildren(element);
      api.createController(element, { uri, width: "100%", height: PLAYER_HEIGHT }, (created) => {
        controller.current = created;
        created.addListener("ready", () => {
          if (!pendingPlay.current) return;
          pendingPlay.current = false;
          created.play();
        });
        created.addListener("playback_update", ({ data }) => {
          setIsPaused(data.isPaused);
        });
      });
    } catch {
      setFailed(true);
      setCurrentUri(null);
    }
  }

  return { host, currentUri, isPaused, failed, toggle };
}
