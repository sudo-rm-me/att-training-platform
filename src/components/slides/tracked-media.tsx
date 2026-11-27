"use client";

import * as React from "react";

/**
 * <video>/<audio> that reports when it has been played to the end. When
 * `noSkip` is set, seeking forward past what has been played is undone.
 */
export function TrackedMedia({
  kind,
  url,
  className,
  noSkip,
  onEnded,
}: {
  kind: "video" | "audio";
  url: string;
  className?: string;
  noSkip?: boolean;
  onEnded?: () => void;
}) {
  const furthest = React.useRef(0);
  const props = {
    src: url,
    controls: true,
    preload: "metadata" as const,
    className,
    controlsList: noSkip ? "nodownload noplaybackrate" : undefined,
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!el.seeking) furthest.current = Math.max(furthest.current, el.currentTime);
    },
    onSeeking: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (noSkip && el.currentTime > furthest.current + 1) el.currentTime = furthest.current;
    },
    onEnded: () => onEnded?.(),
  };
  return kind === "audio" ? <audio {...props} /> : <video {...props} />;
}
