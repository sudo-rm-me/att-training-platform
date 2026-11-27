"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileText, X } from "lucide-react";

/**
 * "Open document" button + full-screen pop-up PDF reader for document slides.
 * `onOpened` fires the first time the learner opens it (for "must read").
 */
export function DocumentViewer({
  url,
  title,
  accent,
  dark,
  required,
  onOpened,
}: {
  url: string;
  title: string;
  accent: string;
  dark: boolean;
  required?: boolean;
  onOpened?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [seen, setSeen] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const show = () => {
    setOpen(true);
    if (!seen) {
      setSeen(true);
      onOpened?.();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex items-center gap-[0.5em] rounded-[0.9em] px-[1.2em] py-[0.7em] text-[1.1em] font-bold shadow-xl transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: accent, color: dark ? "#111" : "#fff" }}
      >
        <FileText className="h-[1.2em] w-[1.2em]" /> {seen ? "Open again" : "Open document"}
      </button>
      {required && !seen && <div className="mt-[0.6em] text-[0.85em] font-semibold opacity-75">Open and read the document to continue</div>}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-black/70 p-2 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label={title || "Document"}>
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl bg-card-solid shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <FileText className="h-5 w-5 text-brand" />
                <div className="min-w-0 flex-1 truncate font-semibold">{title || "Document"}</div>
                <a href={url} target="_blank" rel="noopener" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-fg/5 hover:text-fg" title="Open in a new tab" aria-label="Open in a new tab">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a href={url} download className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-fg/5 hover:text-fg" title="Download" aria-label="Download">
                  <Download className="h-4 w-4" />
                </a>
                <button
                  ref={closeRef}
                  onClick={() => setOpen(false)}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-bold text-white"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>
              <iframe src={`${url}#view=FitH`} title={title || "Document"} className="w-full flex-1 bg-white" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
