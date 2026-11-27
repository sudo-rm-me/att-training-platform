import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePptx } from "@/lib/pptx";
import { Markdown } from "@/components/markdown";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function pic(rid: string, extra = "") {
  return `<p:pic><p:nvPicPr><p:cNvPr id="9" name="p"/><p:nvPr>${extra}</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`;
}

async function deck(slidesXml: { body: string; rels: [string, string, string][] }[], media: Record<string, Buffer>) {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst>${slidesXml.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships>${slidesXml.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  slidesXml.forEach((s, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld><p:cSld>${s.body}</p:cSld></p:sld>`);
    zip.file(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      `<Relationships>${s.rels.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`,
    );
  });
  for (const [p, data] of Object.entries(media)) zip.file(p, data);
  return parsePptx(await zip.generateAsync({ type: "nodebuffer" }));
}

const title = (t: string) =>
  `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
const cell = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;

describe("pptx import", () => {
  it("reads tables, several pictures, backgrounds and embedded video", async () => {
    const d = await deck(
      [
        {
          body:
            title("Data") +
            `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr>${cell("Risk")}${cell("Owner")}</a:tr><a:tr>${cell("Phishing")}${cell("Everyone")}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>` +
            pic("rIdA") +
            pic("rIdB"),
          rels: [
            ["rIdA", `${REL}/image`, "../media/a.png"],
            ["rIdB", `${REL}/image`, "../media/b.png"],
          ],
        },
        {
          body: `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="rIdBg"/></a:blipFill></p:bgPr></p:bg>` + title("Welcome"),
          rels: [["rIdBg", `${REL}/image`, "../media/bg.png"]],
        },
        {
          body: title("Watch") + pic("rIdPoster", `<p:extLst><p:ext><p14:media r:embed="rIdVid"/></p:ext></p:extLst>`),
          rels: [
            ["rIdPoster", `${REL}/image`, "../media/poster.png"],
            ["rIdVid", "http://schemas.microsoft.com/office/2007/relationships/media", "../media/clip.mp4"],
          ],
        },
      ],
      {
        "ppt/media/a.png": PNG,
        "ppt/media/b.png": PNG,
        "ppt/media/bg.png": PNG,
        "ppt/media/poster.png": PNG,
        "ppt/media/clip.mp4": Buffer.from("video"),
      },
    );

    const [table, bg, video] = d.slides;
    expect(table.body).toContain("| Risk | Owner |");
    expect(table.body).toContain("| Phishing | Everyone |");
    expect(table.image?.contentType).toBe("image/png");
    expect(table.extraImages).toHaveLength(1);
    expect(table.body).toContain("{{image:0}}");
    expect(table.layout).toBe("image-right");

    expect(bg.layout).toBe("image-full");
    expect(bg.image).not.toBeNull();

    expect(video.layout).toBe("video");
    expect(video.image?.contentType).toBe("video/mp4");
    expect(video.extraImages).toHaveLength(0);
  });
});

describe("markdown", () => {
  it("renders tables and safe image galleries", () => {
    const html = renderToStaticMarkup(
      Markdown({ source: "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![x](/api/media/import/1.png)\n![y](javascript:alert(1))" }),
    );
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain('src="/api/media/import/1.png"');
    expect(html).not.toContain("javascript:");
  });
});
