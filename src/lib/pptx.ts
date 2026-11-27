import "server-only";
import path from "node:path";
import JSZip from "jszip";
import type { SlideLayout } from "@/db/schema";

/**
 * Minimal .pptx reader: pulls titles, bullet text, the first picture and
 * speaker notes out of each slide so they can become editable slides.
 * Complex layouts, charts, SmartArt and animations are not reproduced.
 */

export type ImportedSlide = {
  layout: SlideLayout;
  title: string;
  body: string;
  notes: string | null;
  image: { data: Buffer; contentType: string } | null;
};

export type ImportedDeck = { title: string | null; slides: ImportedSlide[] };

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const MAX_SLIDES = 200;
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

    // First picture on the slide.
    let image: ImportedSlide["image"] = null;
    const embed = /<p:pic>[\s\S]*?<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(xml)?.[1];
    if (embed) {
      const rel = rels.get(embed);
      if (rel) {
        const mediaPath = resolve(file, rel.target);
        const ext = path.posix.extname(mediaPath).toLowerCase();
        const contentType = IMAGE_TYPES[ext];
        const f = zip.file(mediaPath);
        if (contentType && f) image = { data: await f.async("nodebuffer"), contentType };
      }
    }

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
    if (isTitleSlide) layout = "title";
    else if (image && !body) layout = "image-full";
    else if (image) layout = "image-right";
    else if (!body && title) layout = "section";

    slides.push({ layout, title, body, notes, image });
  }

  return { title: deckTitle, slides };
}
