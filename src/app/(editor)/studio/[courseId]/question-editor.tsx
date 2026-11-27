"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import type { QuestionData, QuestionType } from "@/db/schema";
import { Input, Label, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { defaultQuestion, QUESTION_OPTIONS, shortId } from "./factory";

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const iconBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-fg/5 hover:text-fg disabled:opacity-30";

export function QuestionEditor({ q, onChange }: { q: QuestionData; onChange: (q: QuestionData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Question type</Label>
        <Select value={q.type} onChange={(e) => onChange(defaultQuestion(e.target.value as QuestionType, q))}>
          {QUESTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Question</Label>
        <Textarea
          value={q.prompt}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          placeholder="What do you want to ask?"
          className="min-h-20"
        />
      </div>

      {(q.type === "single" || q.type === "multi") && (
        <div>
          <Label>
            Answers <span className="font-normal text-muted">· tick the correct {q.type === "single" ? "one" : "ones"}</span>
          </Label>
          <div className="space-y-2">
            {q.options.map((o, i) => {
              const on = q.correct.includes(o.id);
              return (
                <div key={o.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={on ? "Marked correct" : "Mark correct"}
                    onClick={() =>
                      onChange({
                        ...q,
                        correct: q.type === "single" ? [o.id] : on ? q.correct.filter((c) => c !== o.id) : [...q.correct, o.id],
                      })
                    }
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center border-2 transition",
                      q.type === "single" ? "rounded-full" : "rounded-lg",
                      on ? "border-success bg-success text-white" : "border-border text-transparent hover:border-success",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <Input
                    value={o.text}
                    placeholder={`Answer ${String.fromCharCode(65 + i)}`}
                    onChange={(e) =>
                      onChange({ ...q, options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })
                    }
                  />
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Remove answer"
                    disabled={q.options.length <= 2}
                    onClick={() =>
                      onChange({ ...q, options: q.options.filter((x) => x.id !== o.id), correct: q.correct.filter((c) => c !== o.id) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          {q.options.length < 8 && (
            <button
              type="button"
              onClick={() => onChange({ ...q, options: [...q.options, { id: shortId(), text: "" }] })}
              className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand"
            >
              <Plus className="h-4 w-4" /> Add answer
            </button>
          )}
        </div>
      )}

      {q.type === "acknowledge" && (
        <div>
          <Label htmlFor="ack-statement">Statement learners agree to</Label>
          <Textarea
            id="ack-statement"
            rows={3}
            value={q.statement}
            placeholder="I have read and understood the policy and agree to follow it."
            onChange={(e) => onChange({ ...q, statement: e.target.value })}
          />
          <p className="mt-1.5 text-xs text-muted">
            Learners must tick this to continue. The time they did is recorded. Worth 0 points unless you change it.
          </p>
        </div>
      )}

      {q.type === "truefalse" && (
        <div>
          <Label>Correct answer</Label>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => onChange({ ...q, correct: v })}
                className={cn(
                  "rounded-xl border-2 py-2.5 text-sm font-bold transition",
                  q.correct === v ? "border-success bg-success/10 text-success" : "border-border text-muted",
                )}
              >
                {v ? "True" : "False"}
              </button>
            ))}
          </div>
        </div>
      )}

      {q.type === "ordering" && (
        <div>
          <Label>
            Items <span className="font-normal text-muted">· in the correct order (learners see them shuffled)</span>
          </Label>
          <div className="space-y-2">
            {q.items.map((it, i) => (
              <div key={it.id} className="flex items-center gap-1.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <Input
                  value={it.text}
                  placeholder={`Step ${i + 1}`}
                  onChange={(e) =>
                    onChange({ ...q, items: q.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })
                  }
                />
                <button type="button" className={iconBtn} aria-label="Move up" disabled={i === 0} onClick={() => onChange({ ...q, items: move(q.items, i, -1) })}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Move down"
                  disabled={i === q.items.length - 1}
                  onClick={() => onChange({ ...q, items: move(q.items, i, 1) })}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Remove"
                  disabled={q.items.length <= 2}
                  onClick={() => onChange({ ...q, items: q.items.filter((x) => x.id !== it.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {q.items.length < 10 && (
            <button
              type="button"
              onClick={() => onChange({ ...q, items: [...q.items, { id: shortId(), text: "" }] })}
              className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          )}
        </div>
      )}

      {q.type === "matching" && (
        <div>
          <Label>Pairs</Label>
          <div className="space-y-2">
            {q.pairs.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <Input
                  value={p.left}
                  placeholder="Item"
                  onChange={(e) => onChange({ ...q, pairs: q.pairs.map((x) => (x.id === p.id ? { ...x, left: e.target.value } : x)) })}
                />
                <span className="text-muted">→</span>
                <Input
                  value={p.right}
                  placeholder="Its match"
                  onChange={(e) => onChange({ ...q, pairs: q.pairs.map((x) => (x.id === p.id ? { ...x, right: e.target.value } : x)) })}
                />
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Remove pair"
                  disabled={q.pairs.length <= 2}
                  onClick={() => onChange({ ...q, pairs: q.pairs.filter((x) => x.id !== p.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {q.pairs.length < 8 && (
            <button
              type="button"
              onClick={() => onChange({ ...q, pairs: [...q.pairs, { id: shortId(), left: "", right: "" }] })}
              className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand"
            >
              <Plus className="h-4 w-4" /> Add pair
            </button>
          )}
        </div>
      )}

      <div>
        <Label>
          Explanation <span className="font-normal text-muted">· shown after answering</span>
        </Label>
        <Textarea
          value={q.explanation ?? ""}
          onChange={(e) => onChange({ ...q, explanation: e.target.value })}
          placeholder="Why is this the right answer?"
          className="min-h-20"
        />
      </div>
      <div className="w-32">
        <Label>Points</Label>
        <Input
          type="number"
          min={0}
          max={1000}
          value={q.points ?? 10}
          onChange={(e) => onChange({ ...q, points: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
        />
      </div>
    </div>
  );
}
