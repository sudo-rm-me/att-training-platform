"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible modal built on the native <dialog> element. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[min(100%-2rem,36rem)] rounded-3xl border border-border bg-card-solid p-0 text-fg shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-fg/5 hover:text-fg">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
