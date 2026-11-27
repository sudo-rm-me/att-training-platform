/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CheckCircle2, Clock, HelpCircle, Layers, PlayCircle } from "lucide-react";
import type { CatalogCourse } from "@/lib/courses";
import { getTheme } from "@/lib/themes";
import { Badge, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

export function CourseCard({ course, dueLabel }: { course: CatalogCourse; dueLabel?: React.ReactNode }) {
  const theme = getTheme(course.theme);
  const p = course.progress;
  return (
    <Link
      href={`/courses/${course.id}`}
      className="glass group flex flex-col overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_var(--brand)]"
    >
      <div className="relative h-36 overflow-hidden" style={{ background: theme.background }}>
        {course.coverImage && (
          <img src={course.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-3 left-4 text-5xl drop-shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
          {course.icon}
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5">
          {p.status === "completed" && (
            <Badge tone="success" className="bg-white/90 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </Badge>
          )}
          {p.status === "in_progress" && <Badge className="bg-white/90 text-brand">In progress</Badge>}
          {p.status === "failed" && <Badge className="bg-white/90 text-rose-600">Retry</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-brand">{course.category}</div>
        <h3 className="mt-1 font-display text-lg font-bold leading-snug">{course.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{course.description}</p>
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {course.estimatedMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> {course.slideCount} slides
            </span>
            {course.questionCount > 0 && (
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" /> {course.questionCount} questions
              </span>
            )}
          </div>
          {dueLabel && <div className="mt-2">{dueLabel}</div>}
          <div className="mt-3 flex items-center gap-3">
            <Progress
              value={p.status === "completed" ? 1 : (p.bestScore ?? 0) / 100}
              className="h-1.5 flex-1"
              barClassName={cn(p.status === "completed" && "bg-success bg-none")}
            />
            <span className="flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">
              <PlayCircle className="h-4 w-4" />
              {p.status === "in_progress" ? "Resume" : p.status === "not_started" ? "Start" : "Open"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
