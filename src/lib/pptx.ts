import "server-only";
import path from "node:path";
import JSZip from "jszip";
import type { SlideLayout } from "@/db/schema";

/**
 * Minimal .pptx reader: pulls titles, bullet text, tables, pictures, slide
 * background images, embedded video/audio and speaker notes out of each
 * slide so they can become editable slides. Charts, SmartArt and
 * animations are not reproduced.
 */

export type ImportedFile = { data: Buffer; contentType: string };

export type ImportedSlide = {
  layout: SlideLayout;
  title: string;
  /** Markdown. Extra pictures are referenced as {{image:N}} (index into `extraImages`). */
  body: string;
  notes: string | null;
  /** The slide's main picture, video or audio (becomes the slide media). */
  image: ImportedFile | null;
  /** Further pictures on the slide, shown as a gallery under the text. */
  extraImages: ImportedFile[];
};

export type ImportedDeck = { title: string | null; slides: ImportedSlide[] };

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const MEDIA_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

const MAX_SLIDES = 200;
const MAX_EXTRA_IMAGES = 4;

/** Markdown table from a DrawingML table. */
function tableMarkdown(tblXml: string): string {
  const rows = [...tblXml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map((tr) =>
    [...tr[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((tc) =>
      paragraphs(tc[0])
        .map((p) => p.text)
        .join(" ")
        .replace(/\|/g, "/"),
    ),
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] || " ").join(" | ")} |`;
  return [line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}
const MAX_UNZIPPED = 300 * 1024 * 1024;

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function parseRels(xml: string): Map<string, { target: string; type: string }> {
  const map = new Map<string, { target: string; type: string }>();
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    const type = /\bType="([^"]+)"/.exec(attrs)?.[1] ?? "";
    if (id && target) map.set(id, { target: decode(target), type });
  }
  return map;
}

function resolve(fromFile: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), target));
}

function relsPath(file: string) {
  return path.posix.join(path.posix.dirname(file), "_rels", path.posix.basename(file) + ".rels");
}

/** Text paragraphs of a shape, with bullet level. */
function paragraphs(shapeXml: string): { text: string; level: number }[] {
  const out: { text: string; level: number }[] = [];
  for (const p of shapeXml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\s[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const inner = p[1] ?? p[2] ?? "";
    const level = Number(/<a:pPr[^>]*\blvl="(\d)"/.exec(inner)?.[1] ?? 0);
    const text = [...inner.matchAll(/<a:t>([^<]*)<\/a:t>|<a:t\s[^>]*>([^<]*)<\/a:t>/g)]
      .map((t) => decode(t[1] ?? t[2] ?? ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push({ text, level });
  }
  return out;
}

export async function parsePptx(data: Buffer): Promise<ImportedDeck> {
  const zip = await JSZip.loadAsync(data);

  // Guard against zip bombs.
  let total = 0;
  zip.forEach((_, f) => {
    total += (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_UNZIPPED) throw new Error("This presentation is too large to import.");

  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? null;

  const presXml = await read("ppt/presentation.xml");
  if (!presXml) throw new Error("That doesn't look like a PowerPoint (.pptx) file.");
  const presRels = parseRels((await read("ppt/_rels/presentation.xml.rels")) ?? "");

  const order = [...presXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => presRels.get(m[1])?.target)
    .filter((t): t is string => Boolean(t))
    .map((t) => resolve("ppt/presentation.xml", t))
    .slice(0, MAX_SLIDES);

  const core = await read("docProps/core.xml");
  const deckTitle = core ? decode(/<dc:title>([^<]*)<\/dc:title>/.exec(core)?.[1] ?? "").trim() || null : null;

  const slides: ImportedSlide[] = [];
  for (const file of order) {
    const xml = await read(file);
    if (!xml) continue;
    const rels = parseRels((await read(relsPath(file))) ?? "");

    let title = "";
    let isTitleSlide = false;
    const bodyLines: string[] = [];

    for (const sp of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>|<p:sp\s[^>]*>([\s\S]*?)<\/p:sp>/g)) {
      const shape = sp[1] ?? sp[2] ?? "";
      const phType = /<p:ph\b[^>]*\btype="(\w+)"/.exec(shape)?.[1];
      const paras = paragraphs(shape);
      if (paras.length === 0) continue;
      if ((phType === "title" || phType === "ctrTitle") && !title) {
        title = paras.map((p) => p.text).join(" ");
        if (phType === "ctrTitle") isTitleSlide = true;
        continue;
      }
      if (phType === "sldNum" || phType === "dt" || phType === "ftr") continue;
      if (phType === "subTitle") {
        bodyLines.push(paras.map((p) => p.text).join("\n\n"));
        continue;
      }
      const bulleted = paras.length > 1 || /<a:bu(Char|AutoNum)/.test(shape) || phType === "body" || !phType;
      for (const p of paras) {
        bodyLines.push(bulleted && paras.length > 1 ? `${"  ".repeat(p.level)}- ${p.text}` : p.text);
      }
      bodyLines.push("");
    }

    // Tables become markdown tables.
    for (const t of xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)) {
      const md = tableMarkdown(t[0]);
      if (md) bodyLines.push(md, "");
    }

    const load = async (relId: string | undefined, types: Record<string, string>): Promise<ImportedFile | null> => {
      const rel = relId ? rels.get(relId) : undefined;
      if (!rel || /^https?:/i.test(rel.target)) return null;
      const mediaPath = resolve(file, rel.target);
      const contentType = types[path.posix.extname(mediaPath).toLowerCase()];
      const f = zip.file(mediaPath);
      return contentType && f ? { data: await f.async("nodebuffer"), contentType } : null;
    };

    // Embedded video/audio (Office 2010+ stores it as a p14:media relationship).
    let media: ImportedFile | null = null;
    for (const pic of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      const mediaRel = /<p14:media\b[^>]*\br:embed="([^"]+)"/.exec(pic[0])?.[1] ?? /<a:(?:videoFile|audioFile)\b[^>]*\br:link="([^"]+)"/.exec(pic[0])?.[1];
      media = await load(mediaRel, MEDIA_TYPES);
      if (media) break;
    }

    // Pictures (skipping the poster frames of videos).
    const pictures: ImportedFile[] = [];
    for (const pic of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      if (/<p14:media\b|<a:(?:videoFile|audioFile)\b/.test(pic[0])) continue;
      const img = await load(/<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(pic[0])?.[1], IMAGE_TYPES);
      if (img) pictures.push(img);
      if (pictures.length > MAX_EXTRA_IMAGES) break;
    }

    // Background picture, used when the slide has no picture of its own.
    const bgRel = /<p:bg>[\s\S]*?<a:blip\b[^>]*\br:embed="([^"]+)"[\s\S]*?<\/p:bg>/.exec(xml)?.[1];
    const background = pictures.length === 0 && !media ? await load(bgRel, IMAGE_TYPES) : null;

    const image = media ?? pictures[0] ?? background;
    const extraImages = media ? pictures.slice(0, MAX_EXTRA_IMAGES) : pictures.slice(1, MAX_EXTRA_IMAGES + 1);

    // Speaker notes.
    let notes: string | null = null;
    const notesRel = [...rels.values()].find((r) => r.type.endsWith("/notesSlide"));
    if (notesRel) {
      const nx = await read(resolve(file, notesRel.target));
      if (nx) {
        const lines: string[] = [];
        for (const sp of nx.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
          const t = /<p:ph\b[^>]*\btype="(\w+)"/.exec(sp[1])?.[1];
          if (t && t !== "body") continue;
          lines.push(...paragraphs(sp[1]).map((p) => p.text));
        }
        notes = lines.join("\n").trim() || null;
      }
    }

    const body = bodyLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    let layout: SlideLayout = "content";
    if (media) layout = media.contentType.startsWith("audio") ? "audio" : "video";
    else if (isTitleSlide) layout = background ? "image-full" : "title";
    else if (image && !body) layout = "image-full";
    else if (background) layout = "image-full";
    else if (image) layout = "image-right";
    else if (!body && title) layout = "section";

    const gallery = extraImages.map((_, i) => `{{image:${i}}}`).join("\n");
    slides.push({ layout, title, body: gallery ? `${body}\n\n${gallery}`.trim() : body, notes, image, extraImages });
  }

  return { title: deckTitle, slides };
}
