import * as React from "react";
import { Markdown } from "@/components/markdown";
import type { SlideTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { SlideImage, SlideVideo } from "./media";

export type SlideViewProps = {
  theme: SlideTheme;
  layout: string;
  kind: "content" | "question";
  title: string;
  body: string;
  mediaUrl: string | null;
  /** Rendered in the question area for question slides. */
  children?: React.ReactNode;
  className?: string;
  /** Fixed 16:9 at every size (editor thumbnails); otherwise flows on mobile. */
  fixedAspect?: boolean;
};

/**
 * Presentational slide used by the player, the editor preview and thumbnails.
 * Text scales with the stage width via container query units.
 */
export function SlideView({ theme, layout, kind, title, body, mediaUrl, children, className, fixedAspect }: SlideViewProps) {
  const prose = cn("slide-prose", theme.dark ? "[&_a]:text-[var(--slide-accent)]" : "[&_a]:text-[var(--slide-accent)]");
  const style = {
    background: theme.background,
    color: theme.fg,
    "--slide-accent": theme.accent,
  } as React.CSSProperties;

  const stage = cn(
    "@container relative w-full overflow-hidden rounded-[1.75rem] shadow-2xl",
    fixedAspect ? "aspect-video text-[1.7cqw]" : "min-h-[70vh] text-base md:aspect-video md:min-h-0 md:text-[1.7cqw]",
    className,
  );

  const deco = (
    <>
      <div className="pointer-events-none absolute -right-[8%] -top-[20%] h-[55%] w-[35%] rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-[25%] left-[10%] h-[50%] w-[30%] rounded-full bg-white/10 blur-3xl" />
    </>
  );

  if (kind === "question") {
    return (
      <div className={stage} style={style}>
        {deco}
        <div className="relative flex h-full flex-col p-[6%] md:p-[4.5%]">
          {title && (
            <div className="mb-[0.6em] text-[0.8em] font-bold uppercase tracking-[0.18em] opacity-75">{title}</div>
          )}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    );
  }

  const media =
    mediaUrl && layout === "video" ? (
      <SlideVideo url={mediaUrl} className="aspect-video w-full rounded-2xl bg-black/40 shadow-xl" />
    ) : mediaUrl ? (
      <SlideImage url={mediaUrl} className="h-full max-h-full w-full rounded-2xl object-cover shadow-xl" />
    ) : null;

  switch (layout) {
    case "title":
      return (
        <div className={stage} style={style}>
          {deco}
          <div className="relative flex h-full flex-col items-center justify-center p-[8%] text-center">
            <h1 className="font-display text-[3.2em] font-extrabold leading-[1.02] tracking-tight">{title}</h1>
            {body && <Markdown source={body} className={cn(prose, "mt-[0.6em] max-w-[80%] text-[1.25em] opacity-85")} />}
          </div>
        </div>
      );
    case "section":
      return (
        <div className={stage} style={style}>
          {deco}
          <div className="relative flex h-full flex-col justify-center p-[8%]">
            <div className="mb-[0.8em] h-[0.35em] w-[4em] rounded-full" style={{ background: theme.accent }} />
            <h2 className="font-display text-[3em] font-extrabold leading-[1.05]">{title}</h2>
            {body && <Markdown source={body} className={cn(prose, "mt-[0.5em] max-w-[70%] text-[1.2em] opacity-80")} />}
          </div>
        </div>
      );
    case "quote":
      return (
        <div className={stage} style={style}>
          {deco}
          <div className="relative flex h-full flex-col justify-center p-[9%]">
            <div className="font-display text-[6em] leading-none opacity-40" style={{ color: theme.accent }}>
              &ldquo;
            </div>
            <Markdown source={body} className={cn(prose, "-mt-[0.6em] font-display text-[2em] font-semibold leading-snug")} />
            {title && <div className="mt-[1em] text-[1.1em] font-semibold opacity-75">— {title}</div>}
          </div>
        </div>
      );
    case "image-full":
      return (
        <div className={stage} style={style}>
          {mediaUrl && <SlideImage url={mediaUrl} className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-[6%] text-white">
            <h2 className="font-display text-[2.6em] font-extrabold leading-[1.05]">{title}</h2>
            {body && <Markdown source={body} className={cn(prose, "max-w-[75%] text-[1.15em] opacity-90")} />}
          </div>
        </div>
      );
    case "image-left":
    case "image-right":
      return (
        <div className={stage} style={style}>
          {deco}
          <div
            className={cn(
              "relative grid h-full gap-[5%] p-[6%] md:grid-cols-2 md:items-center",
              layout === "image-left" && "md:[&>*:first-child]:order-2",
            )}
          >
            <div className="min-w-0">
              <h2 className="font-display text-[2.4em] font-extrabold leading-[1.08]">{title}</h2>
              {body && <Markdown source={body} className={cn(prose, "text-[1.15em] opacity-90")} />}
            </div>
            <div className="flex h-full max-h-full min-h-[12em] items-center">
              {media ?? <div className="h-full w-full rounded-2xl border-2 border-dashed border-current/25" />}
            </div>
          </div>
        </div>
      );
    case "video":
      return (
        <div className={stage} style={style}>
          {deco}
          <div className="relative flex h-full flex-col p-[5%]">
            {title && <h2 className="mb-[0.5em] font-display text-[2em] font-extrabold">{title}</h2>}
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {media ?? <div className="aspect-video w-full rounded-2xl border-2 border-dashed border-current/25" />}
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className={stage} style={style}>
          {deco}
          <div className="relative flex h-full flex-col p-[6%]">
            <h2 className="font-display text-[2.4em] font-extrabold leading-[1.08]">{title}</h2>
            <div className="mt-[0.4em] flex min-h-0 flex-1 gap-[4%]">
              {body && <Markdown source={body} className={cn(prose, "min-w-0 flex-1 text-[1.2em] opacity-90")} />}
              {media && <div className="hidden w-[38%] md:block">{media}</div>}
            </div>
          </div>
        </div>
      );
  }
}
