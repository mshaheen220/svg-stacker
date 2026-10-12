/**
 * Color parsing (any CSS color an Inkscape file is likely to contain →
 * normalized "#rrggbb") and friendly naming ("#008080" → "teal") for
 * auto-generated part names.
 */

// CSS named colors. Full list, so `fill="cornflowerblue"` works the same as
// it would in a browser.
const NAMED: Record<string, string> = {
  aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff", aquamarine: "#7fffd4",
  azure: "#f0ffff", beige: "#f5f5dc", bisque: "#ffe4c4", black: "#000000",
  blanchedalmond: "#ffebcd", blue: "#0000ff", blueviolet: "#8a2be2", brown: "#a52a2a",
  burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00", chocolate: "#d2691e",
  coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c",
  cyan: "#00ffff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9", darkgreen: "#006400", darkgrey: "#a9a9a9", darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b", darkolivegreen: "#556b2f", darkorange: "#ff8c00", darkorchid: "#9932cc",
  darkred: "#8b0000", darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f", darkturquoise: "#00ced1", darkviolet: "#9400d3",
  deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1e90ff", firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22",
  fuchsia: "#ff00ff", gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff", gold: "#ffd700",
  goldenrod: "#daa520", gray: "#808080", green: "#008000", greenyellow: "#adff2f",
  grey: "#808080", honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c",
  indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa",
  lavenderblush: "#fff0f5", lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6",
  lightcoral: "#f08080", lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3",
  lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightpink: "#ffb6c1", lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa", lightskyblue: "#87cefa", lightslategray: "#778899", lightslategrey: "#778899",
  lightsteelblue: "#b0c4de", lightyellow: "#ffffe0", lime: "#00ff00", limegreen: "#32cd32",
  linen: "#faf0e6", magenta: "#ff00ff", maroon: "#800000", mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd", mediumorchid: "#ba55d3", mediumpurple: "#9370db", mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585", midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5", navajowhite: "#ffdead", navy: "#000080", oldlace: "#fdf5e6",
  olive: "#808000", olivedrab: "#6b8e23", orange: "#ffa500", orangered: "#ff4500",
  orchid: "#da70d6", palegoldenrod: "#eee8aa", palegreen: "#98fb98", paleturquoise: "#afeeee",
  palevioletred: "#db7093", papayawhip: "#ffefd5", peachpuff: "#ffdab9", peru: "#cd853f",
  pink: "#ffc0cb", plum: "#dda0dd", powderblue: "#b0e0e6", purple: "#800080",
  rebeccapurple: "#663399", red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1",
  saddlebrown: "#8b4513", salmon: "#fa8072", sandybrown: "#f4a460", seagreen: "#2e8b57",
  seashell: "#fff5ee", sienna: "#a0522d", silver: "#c0c0c0", skyblue: "#87ceeb",
  slateblue: "#6a5acd", slategray: "#708090", slategrey: "#708090", snow: "#fffafa",
  springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c", teal: "#008080",
  thistle: "#d8bfd8", tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee",
  wheat: "#f5deb3", white: "#ffffff", whitesmoke: "#f5f5f5", yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** Parses a CSS color to "#rrggbb", or null for none/transparent/unrecognized. */
export function parseColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "none" || v === "transparent") return null;
  if (NAMED[v]) return NAMED[v];
  let m = /^#([0-9a-f]{3,4})$/.exec(v);
  if (m) return "#" + [...m[1].slice(0, 3)].map((c) => c + c).join("");
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return "#" + m[1];
  m = /^rgba?\(\s*([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length < 3) return null;
    const nums = parts.map((p) => (p.endsWith("%") ? (parseFloat(p) * 255) / 100 : parseFloat(p)));
    if (nums.some((n) => Number.isNaN(n))) return null;
    return "#" + nums.map(hex2).join("");
  }
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Friendly names for part labels. Deliberately a short, filament-ish list
// rather than all 148 CSS names - "teal" is useful, "mediumaquamarine" isn't.
const FRIENDLY: [string, string][] = [
  ["black", "#000000"], ["charcoal", "#36454f"], ["dark gray", "#555555"], ["gray", "#808080"],
  ["silver", "#b3b3b3"], ["light gray", "#d3d3d3"], ["white", "#ffffff"], ["cream", "#f3e9c6"],
  ["red", "#e02020"], ["dark red", "#8b0000"], ["maroon", "#78214d"], ["pink", "#ff9ec4"],
  ["rose", "#d35f90"], ["magenta", "#e000e0"], ["purple", "#7d3cb5"], ["lavender", "#b9a6e0"],
  ["navy", "#1a237e"], ["blue", "#1e64dc"], ["sky blue", "#87ceeb"], ["cyan", "#00c8d8"],
  ["teal", "#008080"], ["mint", "#98e0b8"], ["green", "#2e9e3e"], ["dark green", "#1b5e20"],
  ["olive", "#808000"], ["lime", "#a6e22e"], ["yellow", "#ffe100"], ["gold", "#ffcc00"],
  ["orange", "#ff8c1a"], ["peach", "#ffccaa"], ["tan", "#d2b48c"], ["skin", "#d38d5f"],
  ["caramel", "#c48845"], ["brown", "#784421"], ["dark brown", "#4a2c17"],
];

// sRGB → CIE Lab, for perceptually sensible nearest-name matching.
function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const FRIENDLY_LAB = FRIENDLY.map(([name, hex]) => [name, toLab(hexToRgb(hex))] as const);

/** Nearest friendly name for a "#rrggbb" color, e.g. "#008080" → "teal". */
export function colorName(hex: string): string {
  const lab = toLab(hexToRgb(hex));
  let best = FRIENDLY_LAB[0][0];
  let bestD = Infinity;
  for (const [name, l] of FRIENDLY_LAB) {
    const d = (l[0] - lab[0]) ** 2 + (l[1] - lab[1]) ** 2 + (l[2] - lab[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
