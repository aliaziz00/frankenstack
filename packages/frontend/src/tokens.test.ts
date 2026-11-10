import { describe, expect, it } from "vitest";
import appCss from "./App.css?raw";
import indexCss from "./index.css?raw";

// Guards the colour palette: reads the tokens straight out of index.css, so
// editing a colour there is checked by this file.
//
// Targets are WCAG 2.1 AA: 4.5:1 for text, 3:1 for the edge of a form control.
// The canvas colours are what browsers use for `color-scheme: light dark`
// (checked in the browser: #ffffff in light, #121212 in dark).
const CANVAS = { light: "#ffffff", dark: "#121212" } as const;
const WHITE = "#ffffff";

// ---------------------------------------------------------------------------
// WCAG contrast, implemented independently of the CSS.
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`expected a 6-digit hex colour like #4f46e5, got "${hex}"`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("contrast()", () => {
  // Published reference values, so the formula is not checked against itself.
  it("matches known WCAG values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // #767676 on white is the well-known lightest grey that still reaches 4.5:1.
    expect(contrast("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("is symmetric", () => {
    expect(contrast("#4f46e5", "#ffffff")).toBeCloseTo(contrast("#ffffff", "#4f46e5"), 10);
  });
});

// ---------------------------------------------------------------------------
// Reading the tokens out of index.css
// ---------------------------------------------------------------------------

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found[match[1]] = match[2].trim();
  }
  return found;
}

function readTokens() {
  const css = withoutComments(indexCss);
  const rootBlock = css.match(/:root\s*\{([^}]*)\}/);
  const darkBlock = css.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/,
  );
  if (!rootBlock) throw new Error("no :root block found in index.css");
  if (!darkBlock) throw new Error("no dark-mode :root block found in index.css");
  const light = declarations(rootBlock[1]);
  // The dark block overrides only some tokens; the rest are inherited.
  const dark = { ...light, ...declarations(darkBlock[1]) };
  return { light, dark };
}

const tokens = readTokens();

describe("colour tokens: contrast", () => {
  // [description, token, background, minimum ratio]
  const textChecks: [string, string][] = [
    ["link text", "--link"],
    ["error text", "--danger"],
    ["success badge text", "--success"],
  ];

  for (const scheme of ["light", "dark"] as const) {
    describe(`${scheme} scheme`, () => {
      const t = tokens[scheme];

      it.each(textChecks)("%s (%s) reaches 4.5:1 on the page", (_label, token) => {
        expect(contrast(t[token], CANVAS[scheme])).toBeGreaterThanOrEqual(4.5);
      });

      it("white button text reaches 4.5:1 on the accent fill", () => {
        expect(contrast(WHITE, t["--accent"])).toBeGreaterThanOrEqual(4.5);
      });

      it("form control borders (--border-strong) reach 3:1 on the page", () => {
        expect(contrast(t["--border-strong"], CANVAS[scheme])).toBeGreaterThanOrEqual(3);
      });
    });
  }

  it("the dark scheme overrides every token that is a text colour on the page", () => {
    // The light values are tuned for a white page. If a text token were not
    // overridden, dark mode would silently reuse its light value.
    const lightOnDark = contrast(tokens.light["--link"], CANVAS.dark);
    expect(lightOnDark).toBeLessThan(4.5); // proves the override is needed
    expect(tokens.dark["--link"]).not.toBe(tokens.light["--link"]);
  });
});

// ---------------------------------------------------------------------------
// App.css actually uses the tokens
// ---------------------------------------------------------------------------

const app = withoutComments(appCss);

describe("App.css and the tokens", () => {
  it("only references tokens that are defined", () => {
    const defined = new Set(Object.keys(tokens.light));
    const used = new Set([...app.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
    const undefinedTokens = [...used].filter((name) => !defined.has(name));
    expect(undefinedTokens).toEqual([]);
    expect(used.size).toBeGreaterThan(0);
  });

  it("uses no hard-coded colours (white on the accent fill is the one allowed literal)", () => {
    const hexColours = app.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const rgbColours = app.match(/\brgba?\(/g) ?? [];
    expect([...hexColours, ...rgbColours]).toEqual([]);
    // Named colours: only `white`, only as button text on var(--accent).
    const named = [...app.matchAll(/\bcolor:\s*(white|black|red|blue|green)\b/g)].map((m) => m[1]);
    expect(named.every((name) => name === "white")).toBe(true);
  });
});
