"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  Check,
  CloudOff,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  Rocket,
  Settings2,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { CourseStatus, QuestionData } from "@/db/schema";
import { publishProblems, type CourseSettings, type EditorSlide } from "@/lib/studio-schema";
import { getTheme, THEMES } from "@/lib/themes";
import { toClientQuestion } from "@/lib/quiz";
import { SlideView } from "@/components/slides/slide-view";
import { QuestionUI } from "@/components/slides/question-ui";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import {
  deleteCourseAction,
  duplicateCourseAction,
  saveCourseAction,
  setCourseStatusAction,
  uploadMediaAction,
} from "@/app/(app)/studio/actions";
import { LAYOUT_OPTIONS } from "./factory";
import { QuestionEditor } from "./question-editor";
import { SlideList } from "./slide-list";

type SaveState = "saved" | "dirty" | "saving" | "error";

const ICONS = ["📘", "🛡️", "🚀", "💡", "🧠", "🎯", "🔐", "🌍", "⚡", "🧩", "📊", "🤝", "🏥", "🧯", "♻️", "💬", "🎓", "🛠️", "📈", "🧪"];

export function Editor({
  courseId,
  initialSettings,
  initialSlides,
  initialStatus,
  importedCount,
}: {
  courseId: string;
  initialSettings: CourseSettings;
  initialSlides: EditorSlide[];
  initialStatus: CourseStatus;
  importedCount: number | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = React.useState(initialSettings);
  const [slides, setSlides] = React.useState(initialSlides);
  const [status, setStatus] = React.useState(initialStatus);
  const [selected, setSelected] = React.useState(0);
  const [save, setSave] = React.useState<SaveState>("saved");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const version = React.useRef(0);
  const savedVersion = React.useRef(0);

  const theme = getTheme(settings.theme);
  const slide = slides[Math.min(selected, slides.length - 1)];
  const problems = React.useMemo(() => publishProblems(slides), [slides]);
  const problemSet = React.useMemo(() => new Set(problems.map((p) => p.index)), [problems]);

  React.useEffect(() => {
    if (importedCount) toast.success(`Imported ${importedCount} slides. Now add some questions!`);
  }, [importedCount]);

  // ---- Autosave ----------------------------------------------------------
  const doSave = React.useCallback(async () => {
    const v = version.current;
    if (v === savedVersion.current) return true;
    setSave("saving");
    const res = await saveCourseAction(courseId, { settings, slides });
    if (res.ok) {
      savedVersion.current = v;
      setSave(version.current === v ? "saved" : "dirty");
      setSaveError(null);
      return true;
    }
    setSave("error");
    setSaveError(res.error);
    return false;
  }, [courseId, settings, slides]);

  React.useEffect(() => {
    if (version.current === savedVersion.current) return;
    const t = setTimeout(() => void doSave(), 900);
    return () => clearTimeout(t);
  }, [doSave]);

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const touch = () => {
    version.current++;
    setSave("dirty");
  };
  const updateSlides = (next: EditorSlide[], select?: number) => {
    setSlides(next);
    if (select !== undefined) setSelected(select);
    touch();
  };
  const updateSlide = (patch: Partial<EditorSlide>) =>
    updateSlides(slides.map((s, i) => (i === selected ? { ...s, ...patch } : s)));
  const updateSettings = (patch: Partial<CourseSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    touch();
  };

  // ---- Status ------------------------------------------------------------
  async function changeStatus(next: CourseStatus) {
    setBusy(true);
    try {
      if (!(await doSave())) {
        toast.error("Fix the save error first.");
        return;
      }
      const res = await setCourseStatusAction(courseId, next);
      if (!res.ok) {
        const first = res.problems[0];
        if (first.index >= 0) setSelected(first.index);
        toast.error(`Can't publish yet: ${first.index >= 0 ? `slide ${first.index + 1}: ` : ""}${first.message}`);
        return;
      }
      setStatus(next);
      toast.success(next === "published" ? "Published! Learners can now take this course 🚀" : next === "draft" ? "Moved back to draft" : "Archived");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File, apply: (url: string) => void) {
    const fd = new FormData();
    fd.set("file", file);
    const id = toast.loading("Uploading…");
    const res = await uploadMediaAction(fd);
    toast.dismiss(id);
    if (res.ok) apply(res.url);
    else toast.error(res.error);
  }

  const previewQuestion = slide?.question ? toClientQuestion(slide.question, slide.id) : null;

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="glass z-20 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-2.5">
        <Link href="/studio" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-fg/5 hover:text-fg" aria-label="Back to studio">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="hidden text-2xl sm:inline">{settings.icon}</span>
        <input
          value={settings.title}
          onChange={(e) => updateSettings({ title: e.target.value })}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-display text-lg font-bold outline-none hover:bg-fg/5 focus:bg-fg/5"
          aria-label="Course title"
        />
        <Badge tone={status === "published" ? "success" : status === "draft" ? "accent" : "muted"} className="capitalize">
          {status}
        </Badge>
        <SaveIndicator state={save} error={saveError} />
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" /> <span className="hidden md:inline">Settings</span>
        </Button>
        {status === "published" && (
          <Link href={`/courses/${courseId}`} target="_blank" className="hidden md:block">
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" /> View
            </Button>
          </Link>
        )}
        {status !== "published" ? (
          <Button size="sm" onClick={() => changeStatus("published")} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => changeStatus("draft")} disabled={busy}>
            <Undo2 className="h-4 w-4" /> Unpublish
          </Button>
        )}
      </header>

      {saveError && (
        <div className="flex items-center gap-2 bg-danger/10 px-4 py-2 text-sm font-medium text-danger">
          <AlertTriangle className="h-4 w-4" /> {saveError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Slides */}
        <aside className="shrink-0 border-b border-border bg-card/40 lg:w-56 lg:border-b-0 lg:border-r xl:w-64">
          <SlideList
            slides={slides}
            selected={selected}
            theme={theme}
            problems={problemSet}
            onSelect={setSelected}
            onChange={updateSlides}
          />
        </aside>

        {/* Preview */}
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center p-4 lg:overflow-auto lg:p-6 xl:p-10">
          {slide && (
            <div className="w-full max-w-5xl">
              <SlideView
                fixedAspect
                theme={theme}
                layout={slide.layout}
                kind={slide.kind}
                title={slide.title}
                body={slide.body}
                mediaUrl={slide.mediaUrl}
              >
                {previewQuestion && (
                  <QuestionUI
                    key={JSON.stringify(slide.question)}
                    question={previewQuestion}
                    onSubmit={() => {}}
                    dark={theme.dark}
                    accent={theme.accent}
                    preview
                  />
                )}
              </SlideView>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                  Slide {selected + 1} of {slides.length}
                </span>
                {problems.filter((p) => p.index === selected).map((p) => (
                  <span key={p.message} className="flex items-center gap-1 font-semibold text-[color-mix(in_oklab,var(--accent)_70%,var(--fg))]">
                    <AlertTriangle className="h-3.5 w-3.5" /> {p.message}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="w-full shrink-0 border-t border-border bg-card/40 p-5 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-96">
          {slide && (
            <div className="space-y-5">
              <div className="flex rounded-xl bg-fg/5 p-1 text-sm font-semibold">
                {(["content", "question"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      updateSlide(
                        k === "question"
                          ? { kind: "question", question: slide.question ?? ({ type: "single", prompt: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }], correct: [], explanation: "", points: 10 } as QuestionData) }
                          : { kind: "content" },
                      )
                    }
                    className={cn("flex-1 rounded-lg py-1.5 capitalize transition", slide.kind === k ? "bg-card-solid shadow" : "text-muted")}
                  >
                    {k === "content" ? "Content" : "Question"}
                  </button>
                ))}
              </div>

              {slide.kind === "content" ? (
                <>
                  <div>
                    <Label>Layout</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LAYOUT_OPTIONS.map((l) => (
                        <button
                          key={l.value}
                          onClick={() => updateSlide({ layout: l.value })}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition",
                            slide.layout === l.value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:text-fg",
                          )}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>{slide.layout === "quote" ? "Attribution" : "Title"}</Label>
                    <Input value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} />
                  </div>
                  <div>
                    <Label>
                      {slide.layout === "quote" ? "Quote" : "Text"}{" "}
                      <span className="font-normal text-muted">· **bold**, *italic*, - bullets, [link](https://…)</span>
                    </Label>
                    <Textarea value={slide.body} onChange={(e) => updateSlide({ body: e.target.value })} className="min-h-40 font-mono text-[13px]" />
                  </div>
                  {["image-left", "image-right", "image-full", "content", "video"].includes(slide.layout) && (
                    <MediaField
                      label={slide.layout === "video" ? "Video (YouTube, Vimeo, Stream or upload)" : "Image"}
                      value={slide.mediaUrl}
                      accept={slide.layout === "video" ? "video/mp4,video/webm" : "image/*"}
                      onChange={(url) => updateSlide({ mediaUrl: url })}
                      onUpload={(f) => upload(f, (url) => updateSlide({ mediaUrl: url }))}
                    />
                  )}
                </>
              ) : (
                <>
                  <div>
                    <Label>Heading <span className="font-normal text-muted">· small label above the question</span></Label>
                    <Input value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} />
                  </div>
                  {slide.question && <QuestionEditor q={slide.question} onChange={(q) => updateSlide({ question: q })} />}
                </>
              )}

              <div>
                <Label>Speaker notes <span className="font-normal text-muted">· not shown to learners</span></Label>
                <Textarea value={slide.notes ?? ""} onChange={(e) => updateSlide({ notes: e.target.value || null })} className="min-h-20" />
              </div>
            </div>
          )}
        </aside>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Course settings" className="w-[min(100%-2rem,44rem)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea value={settings.description} onChange={(e) => updateSettings({ description: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={settings.category} onChange={(e) => updateSettings({ category: e.target.value })} placeholder="e.g. Compliance" />
          </div>
          <div>
            <Label>Estimated minutes</Label>
            <Input type="number" min={1} value={settings.estimatedMinutes} onChange={(e) => updateSettings({ estimatedMinutes: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div className="md:col-span-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => updateSettings({ icon: i })}
                  className={cn("grid h-10 w-10 place-items-center rounded-xl text-xl transition", settings.icon === i ? "bg-brand/15 ring-2 ring-brand" : "hover:bg-fg/5")}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => updateSettings({ theme: t.key })}
                  className={cn("flex h-16 items-end rounded-xl p-2 text-xs font-bold ring-2 transition", settings.theme === t.key ? "ring-brand" : "ring-transparent")}
                  style={{ background: t.background, color: t.fg }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Pass mark (%)</Label>
            <Input type="number" min={0} max={100} value={settings.passMark} onChange={(e) => updateSettings({ passMark: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
          </div>
          <div>
            <Label>Max attempts</Label>
            <Select
              value={settings.maxAttempts ?? ""}
              onChange={(e) => updateSettings({ maxAttempts: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Unlimited</option>
              {[1, 2, 3, 4, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Completion bonus XP</Label>
            <Input type="number" min={0} value={settings.completionXp} onChange={(e) => updateSettings({ completionXp: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
          <MediaField
            label="Cover image (optional)"
            value={settings.coverImage}
            accept="image/*"
            onChange={(url) => updateSettings({ coverImage: url })}
            onUpload={(f) => upload(f, (url) => updateSettings({ coverImage: url }))}
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            <form action={duplicateCourseAction.bind(null, courseId)}>
              <Button variant="ghost" size="sm">
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
            </form>
            {status !== "archived" && (
              <Button variant="ghost" size="sm" onClick={() => changeStatus("archived")}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
            <form
              action={deleteCourseAction.bind(null, courseId)}
              onSubmit={(e) => {
                if (!confirm("Delete this course? If anyone has taken it, it will be archived instead so their history is kept.")) e.preventDefault();
              }}
            >
              <Button variant="ghost" size="sm" className="text-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </form>
          </div>
          <Button size="sm" onClick={() => setSettingsOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  return (
    <span className="hidden items-center gap-1.5 text-xs font-semibold text-muted sm:flex" title={error ?? undefined}>
      {state === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-success" /> Saved
        </>
      )}
      {state === "dirty" && <>Unsaved changes</>}
      {state === "error" && (
        <span className="flex items-center gap-1 text-danger">
          <CloudOff className="h-3.5 w-3.5" /> Not saved
        </span>
      )}
    </span>
  );
}

function MediaField({
  label,
  value,
  accept,
  onChange,
  onUpload,
}: {
  label: string;
  value: string | null;
  accept: string;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="md:col-span-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value ?? ""} placeholder="https://… or upload" onChange={(e) => onChange(e.target.value.trim() || null)} />
        <Button type="button" variant="secondary" size="icon" onClick={() => ref.current?.click()} aria-label="Upload file" title="Upload">
          {accept.startsWith("video") ? <Upload className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
