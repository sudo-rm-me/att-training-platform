import * as React from "react";

/**
 * Tiny, safe markdown renderer (no raw HTML). Supports:
 * # / ## / ### headings, paragraphs, - or * bullets, 1. numbered lists,
 * **bold**, *italic*, `code`, [links](https://…) and > quotes.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={className}>{renderBlocks(source)}</div>;
}

function renderBlocks(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2]);
      out.push(
        level === 1 ? <h1 key={key++}>{content}</h1> : level === 2 ? <h2 key={key++}>{content}</h2> : <h3 key={key++} className="font-bold">{content}</h3>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(
        <ul key={key++}>
          {items.map((t, n) => (
            <li key={n}>{inline(t)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push(
        <ol key={key++}>
          {items.map((t, n) => (
            <li key={n}>{inline(t)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(
        <blockquote key={key++} className="mt-3 border-l-4 border-current/30 pl-4 italic opacity-90">
          {inline(q.join(" "))}
        </blockquote>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    )
      para.push(lines[i++]);
    out.push(<p key={key++}>{inline(para.join(" "))}</p>);
  }
  return out;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): React.ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_")))
      return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[0.9em]">
          {p.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (link) {
      const href = /^(https?:|mailto:)/i.test(link[2]) ? link[2] : "#";
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
