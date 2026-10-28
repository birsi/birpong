export interface Palette {
  surface: number;
  raised: number;
  muted: number;
  text: number;
  strong: number;
  accent: number;
  ground: number;
}

const token = (name: string): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return parseInt(raw.replace("#", ""), 16);
};

/** Colours from the theme tokens in `ui/styles/theme.css`, as numbers Phaser understands. */
export function readPalette(): Palette {
  return {
    surface: token("surface"),
    raised: token("surface-raised"),
    muted: token("text-muted"),
    text: token("text"),
    strong: token("text-strong"),
    accent: token("accent"),
    ground: token("ground-top"),
  };
}

export const toCssColor = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
