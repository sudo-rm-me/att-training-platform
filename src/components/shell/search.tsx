"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { searchAction, type SearchHit } from "@/app/search-actions";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav";
import { useT } from "@/i18n/client";

type Item = { id: string; group: string; title: string; subtitle?: string; icon?: string; href: string };

/** Ctrl+K (Cmd+K on Mac) command palette: pages, courses, people (managers) and badges. */
export function GlobalSearch({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const listId = React.useId();
  const t = useT();

  const openPalette = React.useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(0);
    returnFocus.current?.focus?.();
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else openPalette();
      }
      const t = e.target as HTMLElement;
      if (e.key === "/" && !open && !t.closest("input, textarea, select, [contenteditable]")) {
        e.preventDefault();
        openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, openPalette]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced server search.
  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchAction(term);
        if (!stale) setHits(res);
      } finally {
        if (!stale) setLoading(false);
      }
    }, 180);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const term = q.trim().toLowerCase();
  const pages: Item[] = sections
    .flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })))
    .filter((i) => !term || i.label.toLowerCase().includes(term) || i.section.toLowerCase().includes(term))
    .slice(0, term ? 5 : 8)
    .map((i) => ({ id: `p:${i.href}`, group: "Pages", title: i.label, subtitle: i.section, href: i.href }));
  const items: Item[] = [...pages, ...(term.length >= 2 ? hits : [])];
  const current = Math.min(active, Math.max(0, items.length - 1));

  function go(it: Item | undefined) {
    if (!it) return;
    close();
    router.push(it.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  let lastGroup = "";
  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="glass flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted transition hover:text-fg md:w-64"
        aria-keyshortcuts="Control+K"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="sr-only md:not-sr-only">{t("menu.search")}</span>
        <kbd aria-hidden className="ml-auto hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold md:inline">Ctrl K</kbd>
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card-solid! shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted" /> : <Search className="h-5 w-5 text-muted" />}
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                    if (e.target.value.trim().length < 2) setHits([]);
                  }}
                  onKeyDown={onInputKey}
                  placeholder={t("menu.searchPlaceholder")}
                  className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
                  aria-autocomplete="list"
                />
                <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted">Esc</kbd>
              </div>
              <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                {items.length === 0 && (
                  <li className="px-3 py-8 text-center text-sm text-muted">{loading ? t("menu.searching") : t("menu.noMatches")}</li>
                )}
                {items.map((it, i) => {
                  const header = it.group !== lastGroup ? it.group : null;
                  lastGroup = it.group;
                  return (
                    <React.Fragment key={it.id}>
                      {header && (
                        <li role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted first:pt-1">
                          {header}
                        </li>
                      )}
                      <li
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === current}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(it)}
                        className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", i === current && "bg-brand/10")}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-fg/5 text-base" aria-hidden>
                          {it.icon ?? <Search className="h-4 w-4 text-muted" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{it.title}</span>
                          {it.subtitle && <span className="block truncate text-xs text-muted">{it.subtitle}</span>}
                        </span>
                        {i === current && <CornerDownLeft className="h-4 w-4 text-muted" aria-hidden />}
                      </li>
                    </React.Fragment>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
