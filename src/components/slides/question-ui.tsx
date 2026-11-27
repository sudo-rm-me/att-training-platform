"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown, ChevronUp, GripVertical, Sparkles, X, Zap } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnswerValue } from "@/db/schema";
import type { ClientQuestion } from "@/lib/quiz";
import { QUESTION_TYPE_LABEL } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export type Feedback = {
  correct: boolean;
  points: number;
  /** Extra XP for answering quickly. */
  bonus?: number;
  explanation?: string;
  correctAnswer: string[];
  answer: AnswerValue;
};

type Props = {
  question: ClientQuestion;
  feedback?: Feedback;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  dark: boolean;
  accent: string;
  /** Editor preview: interactions are disabled */
  preview?: boolean;
};

const PAIR_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#f97316"];

export function QuestionUI({ question, feedback, onSubmit, dark, accent, preview }: Props) {
  const locked = Boolean(feedback) || Boolean(preview);
  const [submitting, setSubmitting] = React.useState(false);

  // Local answer state per question type, seeded from saved feedback.
  const [choice, setChoice] = React.useState<string[]>(() =>
    Array.isArray(feedback?.answer) && question.type !== "ordering" ? (feedback!.answer as string[]) : [],
  );
  const [tf, setTf] = React.useState<boolean | null>(() =>
    typeof feedback?.answer === "boolean" ? feedback.answer : null,
  );
  const [order, setOrder] = React.useState<string[]>(() => {
    if (question.type !== "ordering") return [];
    if (Array.isArray(feedback?.answer)) return feedback!.answer as string[];
    return question.items.map((i) => i.id);
  });
  const [pairs, setPairs] = React.useState<Record<string, string>>(() =>
    feedback?.answer && typeof feedback.answer === "object" && !Array.isArray(feedback.answer)
      ? (feedback.answer as Record<string, string>)
      : {},
  );
  const [activeLeft, setActiveLeft] = React.useState<string | null>(null);
  const [ack, setAck] = React.useState(() => feedback?.answer === true);

  const surface = dark ? "bg-white/10 border-white/20 hover:bg-white/18" : "bg-black/[0.04] border-black/10 hover:bg-black/[0.07]";
  const selected = dark ? "bg-white text-[#1b1440] border-white" : "bg-[#1e1b4b] text-white border-[#1e1b4b]";

  const ready = (() => {
    switch (question.type) {
      case "single":
      case "multi":
        return choice.length > 0;
      case "truefalse":
        return tf !== null;
      case "ordering":
        return true;
      case "matching":
        return question.lefts.every((l) => pairs[l.id]);
      case "acknowledge":
        return ack;
    }
  })();

  async function submit() {
    if (locked || !ready || submitting) return;
    setSubmitting(true);
    try {
      let answer: AnswerValue;
      switch (question.type) {
        case "single":
        case "multi":
          answer = choice;
          break;
        case "truefalse":
          answer = tf!;
          break;
        case "ordering":
          answer = order;
          break;
        case "matching":
          answer = pairs;
          break;
        case "acknowledge":
          answer = true;
          break;
      }
      await onSubmit(answer);
    } finally {
      setSubmitting(false);
    }
  }

  const isCorrectText = (t: string) => feedback?.correctAnswer.includes(t);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-[0.3em] flex items-center gap-2 text-[0.75em] font-semibold opacity-80">
        <span className="rounded-full px-[0.8em] py-[0.25em]" style={{ background: accent, color: dark ? "#1b1440" : "#fff" }}>
          {QUESTION_TYPE_LABEL[question.type]}
        </span>
        <span>{question.points} pts</span>
      </div>
      <h2 className="font-display text-[1.9em] font-bold leading-[1.15]">{question.prompt}</h2>

      <div className="mt-[0.8em] min-h-0 flex-1 overflow-y-auto pr-1">
        {(question.type === "single" || question.type === "multi") && (
          <div className="grid gap-[0.55em] md:grid-cols-2">
            {question.options.map((o, idx) => {
              const on = choice.includes(o.id);
              const showRight = feedback && isCorrectText(o.text);
              const showWrong = feedback && on && !isCorrectText(o.text);
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  disabled={locked}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    setChoice((c) =>
                      question.type === "single" ? [o.id] : c.includes(o.id) ? c.filter((x) => x !== o.id) : [...c, o.id],
                    )
                  }
                  className={cn(
                    "flex items-center gap-[0.7em] rounded-[0.9em] border-2 px-[0.9em] py-[0.7em] text-left text-[1.05em] font-semibold transition-colors",
                    on ? selected : surface,
                    showRight && "!border-emerald-400 ring-4 ring-emerald-400/40",
                    showWrong && "!border-rose-400 ring-4 ring-rose-400/40",
                    locked && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-[1.8em] w-[1.8em] shrink-0 place-items-center text-[0.85em] font-bold",
                      question.type === "multi" ? "rounded-[0.4em]" : "rounded-full",
                      on ? (dark ? "bg-[#1b1440] text-white" : "bg-white text-[#1e1b4b]") : dark ? "bg-white/15" : "bg-black/10",
                    )}
                  >
                    {question.type === "multi" && on ? <Check className="h-[1em] w-[1em]" /> : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="min-w-0 flex-1">{o.text}</span>
                  {showRight && <Check className="h-[1.2em] w-[1.2em] text-emerald-400" />}
                  {showWrong && <X className="h-[1.2em] w-[1.2em] text-rose-400" />}
                </motion.button>
              );
            })}
          </div>
        )}

        {question.type === "acknowledge" && (
          <label
            className={cn(
              "flex cursor-pointer items-start gap-[0.8em] rounded-[1em] border-2 p-[1em] text-[1.15em] font-semibold transition-colors",
              ack ? selected : surface,
              feedback && "!border-emerald-400 ring-4 ring-emerald-400/40",
              locked && "cursor-default",
            )}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={ack}
              disabled={locked}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span
              aria-hidden
              className={cn(
                "mt-[0.1em] grid h-[1.6em] w-[1.6em] shrink-0 place-items-center rounded-[0.4em] border-2 peer-focus-visible:ring-4 peer-focus-visible:ring-current/30",
                ack ? (dark ? "border-[#1b1440] bg-[#1b1440] text-white" : "border-white bg-white text-[#1e1b4b]") : "border-current/40",
              )}
            >
              {ack && <Check className="h-[1em] w-[1em]" />}
            </span>
            <span className="min-w-0 flex-1">{question.statement}</span>
          </label>
        )}

        {question.type === "truefalse" && (
          <div className="grid grid-cols-2 gap-[0.8em]">
            {[true, false].map((v) => {
              const on = tf === v;
              const right = feedback && isCorrectText(v ? "True" : "False");
              return (
                <motion.button
                  key={String(v)}
                  type="button"
                  disabled={locked}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setTf(v)}
                  className={cn(
                    "flex flex-col items-center gap-[0.3em] rounded-[1em] border-2 py-[1.1em] text-[1.4em] font-bold transition-colors",
                    on ? selected : surface,
                    right && "!border-emerald-400 ring-4 ring-emerald-400/40",
                    feedback && on && !right && "!border-rose-400 ring-4 ring-rose-400/40",
                  )}
                >
                  {v ? <Check className="h-[1.4em] w-[1.4em]" /> : <X className="h-[1.4em] w-[1.4em]" />}
                  {v ? "True" : "False"}
                </motion.button>
              );
            })}
          </div>
        )}

        {question.type === "ordering" && (
          <OrderingList
            items={question.items}
            order={order}
            setOrder={setOrder}
            locked={locked}
            surface={surface}
          />
        )}

        {question.type === "matching" && (
          <div className="grid grid-cols-2 gap-[0.8em]">
            <div className="flex flex-col gap-[0.5em]">
              {question.lefts.map((l) => {
                const pairedRight = pairs[l.id];
                const colorIdx = pairedRight ? question.lefts.findIndex((x) => x.id === l.id) : -1;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={locked}
                    onClick={() => setActiveLeft((a) => (a === l.id ? null : l.id))}
                    className={cn(
                      "flex items-center gap-[0.5em] rounded-[0.8em] border-2 px-[0.8em] py-[0.6em] text-left text-[1em] font-semibold transition",
                      surface,
                      activeLeft === l.id && "ring-4 ring-white/60",
                    )}
                    style={colorIdx >= 0 ? { borderColor: PAIR_COLORS[colorIdx % PAIR_COLORS.length] } : undefined}
                  >
                    {colorIdx >= 0 && (
                      <span className="h-[0.8em] w-[0.8em] shrink-0 rounded-full" style={{ background: PAIR_COLORS[colorIdx % PAIR_COLORS.length] }} />
                    )}
                    <span className="flex-1">{l.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-[0.5em]">
              {question.rights.map((r) => {
                const leftId = Object.keys(pairs).find((k) => pairs[k] === r.id);
                const colorIdx = leftId ? question.lefts.findIndex((x) => x.id === leftId) : -1;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={locked || !activeLeft}
                    onClick={() => {
                      if (!activeLeft) return;
                      setPairs((p) => {
                        const next = { ...p };
                        for (const k of Object.keys(next)) if (next[k] === r.id) delete next[k];
                        next[activeLeft] = r.id;
                        return next;
                      });
                      setActiveLeft(null);
                    }}
                    className={cn(
                      "flex items-center gap-[0.5em] rounded-[0.8em] border-2 px-[0.8em] py-[0.6em] text-left text-[1em] transition",
                      surface,
                      activeLeft && !locked && "animate-pulse",
                    )}
                    style={colorIdx >= 0 ? { borderColor: PAIR_COLORS[colorIdx % PAIR_COLORS.length] } : undefined}
                  >
                    {colorIdx >= 0 && (
                      <span className="h-[0.8em] w-[0.8em] shrink-0 rounded-full" style={{ background: PAIR_COLORS[colorIdx % PAIR_COLORS.length] }} />
                    )}
                    <span className="flex-1">{r.text}</span>
                  </button>
                );
              })}
            </div>
            {!locked && (
              <p className="col-span-2 text-[0.8em] opacity-70">
                Tap an item on the left, then its match on the right.
              </p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {feedback ? (
          <motion.div
            key="fb"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-[0.8em] rounded-[1em] px-[1em] py-[0.8em] text-[0.95em]",
              feedback.correct ? "bg-emerald-500/90 text-white" : "bg-rose-500/90 text-white",
            )}
          >
            <div className="flex items-center gap-2 font-bold">
              {feedback.correct ? (
                <>
                  <Sparkles className="h-[1.1em] w-[1.1em]" /> Correct! +{feedback.points} pts
                  {!!feedback.bonus && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[0.85em]">
                      <Zap className="h-[1em] w-[1em]" /> +{feedback.bonus} speed bonus
                    </span>
                  )}
                </>
              ) : (
                <>
                  <X className="h-[1.1em] w-[1.1em]" /> Not quite
                </>
              )}
            </div>
            {!feedback.correct && (
              <div className="mt-1 opacity-95">
                <span className="font-semibold">Answer: </span>
                {feedback.correctAnswer.join(question.type === "ordering" || question.type === "matching" ? " · " : ", ")}
              </div>
            )}
            {feedback.explanation && <div className="mt-1 opacity-90">{feedback.explanation}</div>}
          </motion.div>
        ) : !preview ? (
          <motion.div key="submit" className="mt-[0.8em] flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || submitting}
              className="rounded-full px-[1.6em] py-[0.6em] text-[1em] font-bold shadow-lg transition disabled:opacity-40"
              style={{ background: accent, color: dark ? "#1b1440" : "#fff" }}
            >
              {submitting ? "Checking…" : "Check answer"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function OrderingList({
  items,
  order,
  setOrder,
  locked,
  surface,
}: {
  items: { id: string; text: string }[];
  order: string[];
  setOrder: React.Dispatch<React.SetStateAction<string[]>>;
  locked: boolean;
  surface: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((o) => arrayMove(o, o.indexOf(String(active.id)), o.indexOf(String(over.id))));
  }
  const move = (idx: number, dir: -1 | 1) =>
    setOrder((o) => (idx + dir < 0 || idx + dir >= o.length ? o : arrayMove(o, idx, idx + dir)));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-[0.45em]">
          {order.map((id, idx) => (
            <SortableRow key={id} id={id} disabled={locked} className={surface}>
              <span className="grid h-[1.7em] w-[1.7em] shrink-0 place-items-center rounded-full bg-white/20 text-[0.85em] font-bold">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 font-semibold">{byId[id]?.text}</span>
              {!locked && (
                <span className="flex gap-1">
                  <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} className="rounded p-1 hover:bg-white/20">
                    <ChevronUp className="h-[1em] w-[1em]" />
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => move(idx, 1)} className="rounded p-1 hover:bg-white/20">
                    <ChevronDown className="h-[1em] w-[1em]" />
                  </button>
                </span>
              )}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-[0.6em] rounded-[0.8em] border-2 px-[0.7em] py-[0.55em] text-[1em]",
        className,
        isDragging && "z-10 shadow-2xl ring-4 ring-white/40",
      )}
    >
      {!disabled && (
        <span {...attributes} {...listeners} className="cursor-grab touch-none opacity-70" aria-label="Drag to reorder">
          <GripVertical className="h-[1.1em] w-[1.1em]" />
        </span>
      )}
      {children}
    </li>
  );
}
