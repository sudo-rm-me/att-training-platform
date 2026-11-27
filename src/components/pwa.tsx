"use client";

import * as React from "react";
import { Download } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Registers the service worker (production only, so dev HMR isn't cached). */
export function ServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** "Install app" menu item, shown only when the browser offers installation. */
export function InstallAppButton() {
  const canInstall = React.useSyncExternalStore(subscribe, () => deferred != null, () => false);
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        notify();
      }}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-fg/5"
    >
      <Download className="h-4 w-4 text-brand" /> Install app
    </button>
  );
}
