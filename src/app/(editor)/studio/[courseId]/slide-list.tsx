"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Copy, HelpCircle, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import type { EditorSlide } from "@/lib/studio-schema";
import type { SlideTheme } from "@/lib/themes";
import { SlideView } from "@/components/slides/slide-view";
import { cn } from "@/lib/utils";
import { LAYOUT_OPTIONS, newContentSlide, newQuestionSlide, QUESTION_OPTIONS } from "./factory";

type Props = {
  slides: EditorSlide[];
  selected: number;
  theme: SlideTheme;
  problems: Set<number>;
  onSelect: (i: number) => void;
  onChange: (slides: EditorSlide[], select?: number) => void;
};

export function SlideList({ slides, selected, theme, problems, onSelect, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [menu, setMenu] = React.useState(false);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = slides.findIndex((s) => s.id === e.active.id);
    const to = slides.findIndex((s) => s.id === e.over!.id);
    const selectedId = slides[selected]?.id;
    const next = arrayMove(slides, from, to);
    onChange(next, Math.max(0, next.findIndex((s) => s.id === selectedId)));
  }

  function insert(slide: EditorSlide) {
    const at = selected + 1;
    onChange([...slides.slice(0, at), slide, ...slides.slice(at)], at);
    setMenu(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative p-3">
        <button
          onClick={() => setMenu((m) => !m)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_var(--brand)]"
        >
          <Plus className="h-4 w-4" /> Add slide
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="glass absolute left-3 right-3 top-14 z-20 max-h-[70vh] overflow-y-auto rounded-2xl bg-card-solid p-2 md:w-72 md:right-auto">
              <div className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted">Content</div>
              {LAYOUT_OPTIONS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => insert(newContentSlide(l.value))}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-fg/5"
                >
                  <LayoutTemplate className="h-4 w-4 text-brand" /> {l.label}
                </button>
              ))}
              <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-muted">Question</div>
              {QUESTION_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  onClick={() => insert(newQuestionSlide(q.value))}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-fg/5"
                >
                  <HelpCircle className="h-4 w-4 text-[var(--brand-3)]" />
                  <span className="flex-1">{q.label}</span>
                  <span className="text-xs text-muted">{q.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-3 pb-4 lg:overflow-y-auto lg:overflow-x-visible">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex gap-2.5 lg:block lg:space-y-2.5">
              {slides.map((s, i) => (
                <Thumb
                  key={s.id}
                  slide={s}
                  index={i}
                  active={i === selected}
                  hasProblem={problems.has(i)}
                  theme={theme}
                  onSelect={() => onSelect(i)}
                  onDuplicate={() => insertAt(i + 1, { ...structuredClone(s), id: crypto.randomUUID() })}
                  onDelete={
                    slides.length > 1
                      ? () => onChange(slides.filter((x) => x.id !== s.id), Math.min(selected, slides.length - 2))
                      : undefined
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );

  function insertAt(at: number, slide: EditorSlide) {
    onChange([...slides.slice(0, at), slide, ...slides.slice(at)], at);
  }
}

function Thumb({
  slide,
  index,
  active,
  hasProblem,
  theme,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  slide: EditorSlide;
  index: number;
  active: boolean;
  hasProblem: boolean;
  theme: SlideTheme;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative flex w-40 shrink-0 gap-2 lg:w-auto", isDragging && "z-10 opacity-80")}
    >
      <div className="w-5 pt-1 text-right text-xs font-semibold text-muted tabular-nums">{index + 1}</div>
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        className={cn(
          "relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-xl ring-2 transition",
          active ? "ring-brand" : "ring-transparent hover:ring-border",
        )}
      >
        <SlideView
          fixedAspect
          theme={theme}
          layout={slide.layout}
          kind={slide.kind}
          title={slide.title}
          body={slide.body}
          mediaUrl={slide.mediaUrl}
          className="rounded-xl shadow-none"
        >
          {slide.question && (
            <div className="font-display text-[1.8em] font-bold leading-tight">{slide.question.prompt || "Untitled question"}</div>
          )}
        </SlideView>
        {slide.kind === "question" && (
          <span className="absolute bottom-1 left-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">Q</span>
        )}
        {hasProblem && (
          <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-black" title="Needs attention">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="absolute -right-1 top-1 hidden flex-col gap-1 group-hover:flex">
        <button onClick={onDuplicate} title="Duplicate" className="grid h-6 w-6 place-items-center rounded-md bg-card-solid text-muted shadow hover:text-fg">
          <Copy className="h-3 w-3" />
        </button>
        {onDelete && (
          <button onClick={onDelete} title="Delete" className="grid h-6 w-6 place-items-center rounded-md bg-card-solid text-muted shadow hover:text-danger">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </li>
  );
}
