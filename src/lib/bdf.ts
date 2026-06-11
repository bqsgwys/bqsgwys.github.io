export type Glyph = {
  advance: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  rows: bigint[];
};

export type BdfFont = {
  name: string;
  ascent: number;
  descent: number;
  height: number;
  glyphs: Map<string, Glyph>;
  fallback?: Glyph;
};

function jis208ToUnicode(code: number): string {
  const row = code >> 8;
  const cell = code & 0xff;
  if (row < 0x21 || row > 0x7e || cell < 0x21 || cell > 0x7e) return "";

  let lead = ((row - 0x21) >> 1) + 0x81;
  if (lead > 0x9f) lead += 0x40;
  let trail = row % 2 ? cell + 0x1f : cell + 0x7e;
  if (trail >= 0x7f && row % 2) trail += 1;

  try {
    return new TextDecoder("shift_jis").decode(new Uint8Array([lead, trail]));
  } catch {
    return "";
  }
}

function encodingToChar(code: number, registry: string): string {
  if (code < 0) return "";
  const upper = registry.toUpperCase();
  if (upper.includes("JISX0208")) return jis208ToUnicode(code);
  if (upper.includes("JISX0201") && code >= 0x80) {
    try {
      return new TextDecoder("shift_jis").decode(new Uint8Array([code]));
    } catch {
      return "";
    }
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function property(source: string, name: string, fallback = "") {
  return source.match(new RegExp(`^${name}\\s+\"?([^\"\\r\\n]+)\"?`, "m"))?.[1] ?? fallback;
}

export function parseBdf(source: string, fileName: string): BdfFont {
  const registry = `${property(source, "CHARSET_REGISTRY")} ${property(source, "FONT")}`;
  const ascent = Number(property(source, "FONT_ASCENT", "0"));
  const descent = Number(property(source, "FONT_DESCENT", "0"));
  const bounding = property(source, "FONTBOUNDINGBOX", "8 8 0 0").split(/\s+/).map(Number);
  const fontHeight = ascent + descent || bounding[1] || 8;
  const glyphs = new Map<string, Glyph>();
  let fallback: Glyph | undefined;

  for (const block of source.split("STARTCHAR ").slice(1)) {
    const encoding = Number(block.match(/^ENCODING\s+(-?\d+)/m)?.[1] ?? -1);
    const dwidth = Number(block.match(/^DWIDTH\s+(-?\d+)/m)?.[1] ?? bounding[0]);
    const bbx = (block.match(/^BBX\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/m)?.slice(1).map(Number) ??
      [0, 0, 0, 0]) as [number, number, number, number];
    const bitmap = block.match(/BITMAP\r?\n([\s\S]*?)\r?\nENDCHAR/)?.[1].trim();
    const glyph: Glyph = {
      advance: dwidth,
      width: bbx[0],
      height: bbx[1],
      xOffset: bbx[2],
      yOffset: bbx[3],
      rows: bitmap ? bitmap.split(/\r?\n/).map((row) => BigInt(`0x${row.trim() || "0"}`)) : [],
    };
    const character = encodingToChar(encoding, registry);
    if (character) glyphs.set(character, glyph);
    if (encoding === 0xfffd) fallback = glyph;
  }

  return {
    name: fileName.replace(/\.bdf$/i, ""),
    ascent: ascent || Math.max(0, fontHeight - descent),
    descent,
    height: fontHeight,
    glyphs,
    fallback: fallback ?? glyphs.get("\ufffd"),
  };
}
