export type SlideTheme = {
  key: string;
  name: string;
  /** CSS background for the slide stage */
  background: string;
  /** text colour on the slide */
  fg: string;
  /** accent colour for highlights / options */
  accent: string;
  /** whether the slide is dark (for contrast choices) */
  dark: boolean;
};

export const THEMES: SlideTheme[] = [
  {
    key: "aurora",
    name: "Aurora",
    background:
      "radial-gradient(80% 90% at 0% 0%, #7c5cff 0%, transparent 60%), radial-gradient(70% 80% at 100% 100%, #ff7ab6 0%, transparent 60%), linear-gradient(135deg, #2a1b6e, #5b2a86)",
    fg: "#ffffff",
    accent: "#ffd479",
    dark: true,
  },
  {
    key: "ocean",
    name: "Ocean",
    background:
      "radial-gradient(70% 80% at 100% 0%, #38bdf8 0%, transparent 60%), linear-gradient(140deg, #0b3a6e, #0e7490)",
    fg: "#ffffff",
    accent: "#a5f3fc",
    dark: true,
  },
  {
    key: "sunset",
    name: "Sunset",
    background:
      "radial-gradient(80% 90% at 0% 100%, #fb923c 0%, transparent 60%), linear-gradient(135deg, #be185d, #f97316)",
    fg: "#ffffff",
    accent: "#fde68a",
    dark: true,
  },
  {
    key: "forest",
    name: "Forest",
    background:
      "radial-gradient(70% 80% at 100% 0%, #4ade80 0%, transparent 55%), linear-gradient(140deg, #064e3b, #15803d)",
    fg: "#ffffff",
    accent: "#bbf7d0",
    dark: true,
  },
  {
    key: "midnight",
    name: "Midnight",
    background:
      "radial-gradient(60% 70% at 80% 10%, #6366f1 0%, transparent 60%), linear-gradient(160deg, #0f172a, #1e1b4b)",
    fg: "#f8fafc",
    accent: "#a78bfa",
    dark: true,
  },
  {
    key: "paper",
    name: "Paper",
    background:
      "radial-gradient(60% 70% at 100% 0%, #ede9fe 0%, transparent 60%), linear-gradient(160deg, #ffffff, #f5f3ff)",
    fg: "#1e1b4b",
    accent: "#7c3aed",
    dark: false,
  },
];

export function getTheme(key: string | null | undefined): SlideTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
