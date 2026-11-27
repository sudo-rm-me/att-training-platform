import { expect, test } from "@playwright/test";
import { ADMIN, signInAs } from "./helpers";

test("authors preview a draft, publish it, then publish changes as a new version", async ({ browser }) => {
  const page = await signInAs(browser, ADMIN);
  await page.goto("/studio");
  await page.getByRole("button", { name: "New course" }).click();
  await page.waitForURL(/\/studio\/[0-9a-f-]{36}$/);
  const courseId = page.url().split("/").pop()!;

  // Preview: nothing recorded, finish shows a summary.
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${courseId}`);
  await expect(preview.getByText("Preview", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: /Finish/ }).click();
  await expect(preview.getByRole("heading", { name: "Preview finished" })).toBeVisible();
  await preview.close();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published! Learners can now take this course")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish changes" })).toHaveCount(0);

  // Editing a live course keeps the change in the draft until it's published.
  await page.getByRole("button", { name: "Add slide" }).click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await expect(page.getByText("Saved")).toBeVisible();
  page.once("dialog", (d) => d.accept("Added a slide"));
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByText(/Version 2 is live/)).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.locator("tbody")).toContainText("(version 2)");
});

test("a PDF becomes a reading module that learners must open before the questions", async ({ browser }) => {
  const page = await signInAs(browser, ADMIN);
  await page.goto("/studio");
  await page.getByRole("button", { name: "Import PowerPoint or PDF" }).click();
  const pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  await page.locator('input[name="file"]').setInputFiles({ name: "Data protection policy.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf) });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForURL(/\/studio\/[0-9a-f-]{36}\?imported=pdf$/);
  const courseId = new URL(page.url()).pathname.split("/").pop()!;

  await page.goto(`/preview/${courseId}`);
  await page.getByRole("button", { name: "Next", exact: true }).click(); // title slide
  const gate = page.getByRole("button", { name: /Open the document to continue/ });
  await expect(gate).toBeDisabled();
  await page.getByRole("button", { name: "Open document" }).click();
  const reader = page.getByRole("dialog", { name: "Data protection policy" });
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: "Close" }).click();
  await expect(reader).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click(); // section slide
  await expect(page.getByText("Replace this with a question about the document")).toBeVisible();
});
