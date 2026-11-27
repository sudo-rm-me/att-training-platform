import { describe, expect, it } from "vitest";
import { addMonths, isCompliant, requirementStatus, statusText } from "@/lib/assignments";
import { isoWeek, reminderStage } from "@/lib/reminders";
import { validWebhookUrl } from "@/lib/teams-webhook";

const DAY = 86_400_000;
const now = new Date("2026-11-27T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const ahead = (days: number) => new Date(now.getTime() + days * DAY);

describe("addMonths", () => {
  it("adds calendar months and clamps to the end of short months", () => {
    expect(addMonths(new Date("2026-01-15T00:00:00Z"), 12).toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("requirementStatus", () => {
  it("one-off training stays done once passed, whatever the due date", () => {
    expect(requirementStatus({ dueAt: ago(30), recurMonths: null }, ago(40), now).state).toBe("done");
  });

  it("without a pass, follows the due date", () => {
    expect(requirementStatus({ dueAt: ago(1), recurMonths: 12 }, null, now).state).toBe("overdue");
    expect(requirementStatus({ dueAt: ahead(3), recurMonths: null }, null, now).state).toBe("due_soon");
    expect(requirementStatus({ dueAt: null, recurMonths: null }, null, now).state).toBe("open");
  });

  it("recurring training is done, then due for renewal, then expired", () => {
    const fresh = requirementStatus({ dueAt: null, recurMonths: 12 }, ago(100), now);
    expect(fresh.state).toBe("done");
    expect(fresh.validUntil!.getTime()).toBeGreaterThan(now.getTime());
    expect(statusText(fresh, now)).toMatch(/^Done · valid to/);

    const renew = requirementStatus({ dueAt: null, recurMonths: 12 }, addMonths(ahead(10), -12), now);
    expect(renew.state).toBe("renew");
    expect(isCompliant(renew.state)).toBe(true);
    expect(statusText(renew, now)).toMatch(/^Renew by/);

    const expired = requirementStatus({ dueAt: null, recurMonths: 6 }, addMonths(ago(3), -6), now);
    expect(expired.state).toBe("overdue");
    expect(isCompliant(expired.state)).toBe(false);
    expect(statusText(expired, now)).toMatch(/^Expired/);
  });
});

describe("reminderStage", () => {
  const st = (dueAt: Date | null, recurMonths: number | null, pass: Date | null) => requirementStatus({ dueAt, recurMonths }, pass, now);

  it("picks the right reminder for each situation", () => {
    expect(reminderStage(st(ahead(5), null, null), now)?.stage).toBe("due7");
    expect(reminderStage(st(ahead(0.5), null, null), now)?.stage).toBe("due1");
    expect(reminderStage(st(ahead(20), null, null), now)).toBeNull();
    expect(reminderStage(st(ago(3), null, null), now)?.stage).toBe("overdue");
    expect(reminderStage(st(null, 12, addMonths(ahead(20), -12)), now)?.stage).toBe("renew30");
    expect(reminderStage(st(null, 12, addMonths(ahead(5), -12)), now)?.stage).toBe("renew7");
    expect(reminderStage(st(null, 12, ago(10)), now)).toBeNull();
  });

  it("repeats overdue reminders weekly, not daily", () => {
    const s = st(ago(3), null, null);
    const a = reminderStage(s, now)!.key;
    expect(reminderStage(s, new Date(now.getTime() + DAY))!.key).toBe(a);
    expect(reminderStage(s, new Date(now.getTime() + 4 * DAY))!.key).not.toBe(a);
  });
});

describe("isoWeek", () => {
  it("matches ISO 8601 week numbers", () => {
    expect(isoWeek(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(isoWeek(now)).toBe("2026-W48");
  });
});

describe("validWebhookUrl", () => {
  it("only accepts HTTPS Microsoft webhook hosts", () => {
    expect(validWebhookUrl("https://prod-12.westeurope.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=x")).toBe(true);
    expect(validWebhookUrl("https://contoso.webhook.office.com/webhookb2/abc")).toBe(true);
    expect(validWebhookUrl("http://contoso.webhook.office.com/webhookb2/abc")).toBe(false);
    expect(validWebhookUrl("https://evil.example.com/logic.azure.com")).toBe(false);
    expect(validWebhookUrl("https://169.254.169.254/metadata")).toBe(false);
    expect(validWebhookUrl("not a url")).toBe(false);
  });
});
