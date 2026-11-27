"use client";

import * as React from "react";
import { FileUp, Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { importPptxAction } from "./actions";

export function ImportButton() {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState(importPptxAction, null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Presentation className="h-4 w-4" /> Import PowerPoint
      </Button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title="Import a PowerPoint">
        <form action={action} className="space-y-4">
          <p className="text-sm text-muted">
            Each slide becomes an editable slide with its title, bullet points, first image and speaker notes. You can then
            add questions and restyle it in the editor.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition hover:border-brand hover:bg-brand/5">
            <FileUp className="h-8 w-8 text-brand" />
            <span className="font-semibold">{fileName ?? "Choose a .pptx file"}</span>
            <span className="text-xs text-muted">Up to 100 MB</span>
            <input
              type="file"
              name="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          {state?.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
          <p className="text-xs text-muted">
            Charts, SmartArt, animations and exact positioning aren&apos;t carried over. Images are uploaded to the course.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button disabled={pending || !fileName}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
