"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Flag, Lock, X } from "lucide-react";
import { toast } from "sonner";
import type { AnswerValue } from "@/db/schema";
import type { PlayerSlide } from "@/lib/attempts";
import type { SlideTheme } from "@/lib/themes";
import { SlideView } from "@/components/slides/slide-view";
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
};

export function Player({ attemptId, courseId, courseTitle, theme, slides, initialIndex, initialFeedback }: Props) {
  const router = useRouter();
  const [index, setIndex] = React.useState(Math.min(Math.max(0, initialIndex), Math.max(0, slides.length - 1)));
  const [direction, setDirection] = React.useState(1);
  const [feedback, setFeedback] = React.useState<Record<string, Feedback>>(initialFeedback);
  const [finishing, setFinishing] = React.useState(false);

  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const blocked = slide?.kind === "question" && !feedback[slide.id];
  const questionCount = slides.filter((s) => s.kind === "question").length;
  const answeredCount = Object.keys(feedback).length;

  const go = React.useCallback(
    (to: number) => {
      if (to < 0 || to >= slides.length) return;
      setDirection(to > index ? 1 : -1);
      setIndex(to);
      void saveProgressAction(attemptId, to).catch(() => {});
    },
    [attemptId, index, slides.length],
  );

  const finish = React.useCallback(async () => {
    setFinishing(true);
    const res = await finishAttemptAction(attemptId);
    if (!res.ok) {
      toast.error(res.error);
      setFinishing(false);
      return;
    }
    router.push(`/learn/${attemptId}/results`);
  }, [attemptId, router]);

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
          <Link href={`/courses/${courseId}`} className="mt-4 inline-block text-brand underline">
            Back to course
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
          href={`/courses/${courseId}`}
          className="glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:text-fg"
          aria-label="Exit course"
          title="Exit (your progress is saved)"
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{courseTitle}</div>
          <div className="mt-1.5 flex gap-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => (i <= index || !slides.slice(index, i).some((x) => x.kind === "question" && !feedback[x.id]) ? go(i) : undefined)}
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
          title={blocked ? "Answer the question to continue" : undefined}
        >
          {blocked ? (
            <>
              <Lock className="h-4 w-4" /> Answer to continue
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
    </div>
  );
}
