"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Flag, Lock, X } from "lucide-react";
import { toast } from "sonner";
import type { AnswerValue, QuestionData } from "@/db/schema";
import { describeCorrect, grade, questionPoints } from "@/lib/quiz";
import type { PlayerSlide } from "@/lib/attempts";
import type { SlideTheme } from "@/lib/themes";
import { SlideView } from "@/components/slides/slide-view";
import { videoEmbedUrl } from "@/components/slides/media";
import { QuestionUI, type Feedback } from "@/components/slides/question-ui";
import { cn } from "@/lib/utils";
import { finishAttemptAction, saveProgressAction, submitAnswerAction } from "./actions";

type Props = {
  attemptId: string;
  courseId: string;
  courseTitle: string;
  theme: SlideTheme;
  slides: PlayerSlide[];
  initialIndex: number;
  initialFeedback: Record<string, Feedback>;
  /** Author preview: grade in the browser and record nothing. */
  preview?: { questions: Record<string, QuestionData>; passMark: number };
};

/** Uploaded video/audio that must be played through before moving on. */
const needsMedia = (s: PlayerSlide) =>
  s.requireMedia && !!s.mediaUrl && (s.layout === "audio" || s.layout === "document" || (s.layout === "video" && !videoEmbedUrl(s.mediaUrl)));

export function Player({ attemptId, courseId, courseTitle, theme, slides, initialIndex, initialFeedback, preview }: Props) {
  const router = useRouter();
  const [index, setIndex] = React.useState(Math.min(Math.max(0, initialIndex), Math.max(0, slides.length - 1)));
  const [direction, setDirection] = React.useState(1);
  const [feedback, setFeedback] = React.useState<Record<string, Feedback>>(initialFeedback);
  const [finishing, setFinishing] = React.useState(false);
  const [played, setPlayed] = React.useState<Set<string>>(new Set());
  const [previewScore, setPreviewScore] = React.useState<number | null>(null);

  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const stops = (s: PlayerSlide) => (s.kind === "question" && !feedback[s.id]) || (needsMedia(s) && !played.has(s.id));
  const blocked = !!slide && stops(slide);
  const waitingForMedia = !!slide && slide.kind !== "question" && blocked;
  const exitHref = preview ? `/studio/${courseId}` : `/courses/${courseId}`;
  const questionCount = slides.filter((s) => s.kind === "question").length;
  const answeredCount = Object.keys(feedback).length;

  const go = React.useCallback(
    (to: number) => {
      if (to < 0 || to >= slides.length) return;
      setDirection(to > index ? 1 : -1);
      setIndex(to);
      if (!preview) void saveProgressAction(attemptId, to).catch(() => {});
    },
    [attemptId, index, slides.length, preview],
  );

  const finish = React.useCallback(async () => {
    if (preview) {
      const qs = Object.values(preview.questions);
      const total = qs.reduce((n, q) => n + questionPoints(q), 0);
      const earned = Object.values(feedback).reduce((n, f) => n + f.points, 0);
      setPreviewScore(total === 0 ? 100 : Math.round((earned / total) * 100));
      return;
    }
    setFinishing(true);
    const res = await finishAttemptAction(attemptId);
    if (!res.ok) {
      toast.error(res.error);
      setFinishing(false);
      return;
    }
    router.push(`/learn/${attemptId}/results`);
  }, [attemptId, router, preview, feedback]);

  const next = React.useCallback(() => {
    if (blocked) return;
    if (isLast) void finish();
    else go(index + 1);
  }, [blocked, isLast, finish, go, index]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, go, index]);

  // Simple swipe on content slides.
  const touch = React.useRef<number | null>(null);

  async function submit(answer: AnswerValue) {
    if (preview) {
      const q = preview.questions[slide.id];
      if (!q) return;
      const correct = grade(q, answer);
      const fb: Feedback = { correct, points: correct ? questionPoints(q) : 0, explanation: q.explanation, correctAnswer: describeCorrect(q), answer };
      setFeedback((f) => ({ ...f, [slide.id]: fb }));
      return;
    }
    const res = await submitAnswerAction(attemptId, slide.id, answer);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setFeedback((f) => ({ ...f, [slide.id]: res.feedback }));
  }

  if (!slide) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">This course has no slides yet.</p>
          <Link href={exitHref} className="mt-4 inline-block text-brand underline">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 py-3 md:px-8">
        <Link
          href={exitHref}
          className="glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:text-fg"
          aria-label={preview ? "Exit preview" : "Exit course"}
          title={preview ? "Back to the editor" : "Exit (your progress is saved)"}
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-sm font-semibold">
            {preview && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1b1440]">Preview</span>}
            <span className="truncate">{courseTitle}</span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => (i <= index || !slides.slice(index, i).some(stops) ? go(i) : undefined)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  i < index ? "bg-brand" : i === index ? "bg-brand-gradient" : "bg-fg/10",
                  s.kind === "question" && feedback[s.id] && (feedback[s.id].correct ? "!bg-success" : "!bg-danger"),
                )}
              />
            ))}
          </div>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-muted sm:block">
          <div className="font-semibold text-fg tabular-nums">
            {index + 1} / {slides.length}
          </div>
          {questionCount > 0 && (
            <div className="tabular-nums">
              {answeredCount}/{questionCount} answered
            </div>
          )}
        </div>
      </header>

      {/* Stage */}
      <main
        className="flex flex-1 items-center justify-center px-3 pb-3 md:px-8"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null || slide.kind === "question") return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (dx < -60) next();
          if (dx > 60) go(index - 1);
        }}
      >
        <div className="w-full max-w-[min(100%,calc((100vh-10.5rem)*16/9))]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={slide.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: direction * -60, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <SlideView
                theme={theme}
                layout={slide.layout}
                kind={slide.kind}
                title={slide.title}
                body={slide.body}
                mediaUrl={slide.mediaUrl}
                requireMedia={slide.requireMedia}
                onMediaEnded={() => setPlayed((p) => new Set(p).add(slide.id))}
              >
                {slide.question && (
                  <QuestionUI
                    key={slide.id}
                    question={slide.question}
                    feedback={feedback[slide.id]}
                    onSubmit={submit}
                    dark={theme.dark}
                    accent={theme.accent}
                  />
                )}
              </SlideView>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Controls */}
      <footer className="flex items-center justify-between gap-3 px-4 pb-5 md:px-8">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="glass flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold transition hover:bg-card-solid disabled:opacity-40"
        >
          <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="hidden text-xs text-muted md:block">Use ← → keys to navigate</div>
        <button
          onClick={next}
          disabled={blocked || finishing}
          className={cn(
            "flex h-12 items-center gap-2 rounded-2xl px-6 font-bold text-white transition shine",
            blocked ? "bg-fg/20" : "bg-brand-gradient shadow-[0_10px_30px_-10px_var(--brand)] hover:brightness-110",
          )}
          title={blocked ? (waitingForMedia ? "Play it to the end to continue" : "Answer the question to continue") : undefined}
        >
          {blocked ? (
            <>
              <Lock className="h-4 w-4" /> {waitingForMedia
                ? slide.layout === "audio"
                  ? "Listen to continue"
                  : slide.layout === "document"
                    ? "Open the document to continue"
                    : "Watch to continue"
                : "Answer to continue"}
            </>
          ) : isLast ? (
            <>
              <Flag className="h-5 w-5" /> {finishing ? "Finishing…" : "Finish"}
            </>
          ) : (
            <>
              Next <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </footer>

      {previewScore !== null && preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-3xl bg-card-solid! p-8 text-center">
            <div className="text-5xl">{previewScore >= preview.passMark ? "🎉" : "📝"}</div>
            <h2 className="mt-3 font-display text-2xl font-bold">Preview finished</h2>
            <p className="mt-1 text-muted">
              You scored <b className="text-fg">{previewScore}%</b> (pass mark {preview.passMark}%). Nothing was recorded.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={() => window.location.reload()} className="glass rounded-2xl px-4 py-2.5 font-semibold">
                Try again
              </button>
              <Link href={exitHref} className="rounded-2xl bg-brand-gradient px-4 py-2.5 font-bold text-white">
                Back to editor
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
