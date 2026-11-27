import { describe, expect, it } from "vitest";
import { levelFromXp, levelTitle, xpForLevel } from "@/lib/levels";
import { coinsForXp } from "@/lib/rewards";

describe("levels", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, title: "Rookie" });
  });

  it("is monotonic and reaches the next level exactly at the threshold", () => {
    for (let l = 1; l < 30; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
      expect(levelFromXp(xpForLevel(l + 1)).level).toBe(l + 1);
      expect(levelFromXp(xpForLevel(l + 1) - 1).level).toBe(l);
    }
  });

  it("reports progress within the level between 0 and 1", () => {
    const p = levelFromXp(xpForLevel(5) + 10).progress;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("caps titles at Legend", () => {
    expect(levelTitle(1000)).toBe("Legend");
  });

  it("gives half as many coins as XP", () => {
    expect(coinsForXp(90)).toBe(45);
  });
});
