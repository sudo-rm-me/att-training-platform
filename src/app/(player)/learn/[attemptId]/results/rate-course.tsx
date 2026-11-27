"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rateCourseAction } from "../actions";

const LABELS = ["", "Not for me", "Could be better", "Good", "Great", "Loved it!"];

export function RateCourse({ courseId, initialStars, initialComment }: { courseId: string; initialStars: number | null; initialComment: string | null }) {
  const [stars, setStars] = React.useState(initialStars ?? 0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState(initialComment ?? "");
  const [saved, setSaved] = React.useState(initialStars != null);
  const [pending, start] = React.useTransition();
  const shown = hover || stars;

  const save = (value: number, text = comment) =>
    start(async () => {
      const r = await rateCourseAction(courseId, value, text);
      if (r.ok) {
        setSaved(true);
        toast.success("Thanks for the feedback!");
      } else toast.error(r.error);
    });

  return (
    <div className="text-center">
      <div className="text-sm font-semibold">{saved ? "Your rating" : "How was this course?"}</div>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Rate this course" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}: ${LABELS[n]}`}
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => {
              setStars(n);
              save(n);
            }}
            className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Star className={cn("h-8 w-8 transition", n <= shown ? "fill-amber-400 text-amber-400" : "text-fg/25")} />
          </button>
        ))}
      </div>
      <div className="mt-1 h-5 text-xs font-semibold text-muted">{LABELS[shown]}</div>
      {stars > 0 && (
        <form
          className="mx-auto mt-2 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(stars);
          }}
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder="Anything we should improve? (optional)"
            aria-label="Feedback comment"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
          />
          <button disabled={pending} className="rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-60">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
