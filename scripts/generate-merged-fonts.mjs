import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDirectory = path.join(root, "bdf");
const outputDirectory = path.join(root, "public", "merged-bdf");
const manifestPath = path.join(root, "generated", "font-catalog.json");

const sanitize = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function property(source, name, fallback = "") {
  return source.match(new RegExp(`^${name}\\s+"?([^"\\r\\n]+)"?`, "m"))?.[1] ?? fallback;
}

function jis208ToUnicode(code) {
  const row = code >> 8;
  const cell = code & 0xff;
  if (row < 0x21 || row > 0x7e || cell < 0x21 || cell > 0x7e) return "";
  let lead = ((row - 0x21) >> 1) + 0x81;
  if (lead > 0x9f) lead += 0x40;
  let trail = row % 2 ? cell + 0x1f : cell + 0x7e;
  if (trail >= 0x7f && row % 2) trail += 1;
  return new TextDecoder("shift_jis").decode(Uint8Array.from([lead, trail]));
}

function encodingToCharacter(code, registry) {
  const upper = registry.toUpperCase();
  if (code < 0) return "";
  if (upper.includes("JISX0208")) return jis208ToUnicode(code);
  if (upper.includes("JISX0201")) {
    if (code === 0x5c) return "\u00a5";
    if (code === 0x7e) return "\u203e";
    if (code >= 0xa1 && code <= 0xdf) {
      return new TextDecoder("shift_jis").decode(Uint8Array.from([code]));
    }
    return code < 0x80 ? String.fromCodePoint(code) : "";
  }
  if (upper.includes("ISO8859")) return code <= 0xff ? String.fromCodePoint(code) : "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function sourcePriority(registry) {
  const upper = registry.toUpperCase();
  if (upper.includes("ISO10646")) return 4;
  if (upper.includes("JISX0208")) return 3;
  if (upper.includes("JISX0201")) return 2;
  if (upper.includes("ISO8859")) return 1;
  return 0;
}

function parseFont(file) {
  const source = readFileSync(path.join(sourceDirectory, file), "utf8");
  const xlfd = property(source, "FONT");
  const fields = xlfd.split("-");
  const bounding = property(source, "FONTBOUNDINGBOX", "8 8 0 0").split(/\s+/).map(Number);
  const metadata = {
    file,
    foundry: fields[1] || property(source, "FOUNDRY", "Unknown"),
    family: fields[2] || property(source, "FAMILY_NAME", file.replace(/\.bdf$/i, "")),
    weight: fields[3] || property(source, "WEIGHT_NAME", "Medium"),
    slant: fields[4] || property(source, "SLANT", "R"),
    setWidth: fields[5] || property(source, "SETWIDTH_NAME", "Normal"),
    addStyle: fields[6] || property(source, "ADD_STYLE_NAME", ""),
    pixelSize: Number(fields[7] || property(source, "PIXEL_SIZE", bounding[1] || 8)),
    spacing: fields[11] || property(source, "SPACING", "C"),
    registry: `${property(source, "CHARSET_REGISTRY")} ${property(source, "CHARSET_ENCODING")}`,
    ascent: Number(property(source, "FONT_ASCENT", String(Math.max(0, bounding[1] + bounding[3])))),
    descent: Number(property(source, "FONT_DESCENT", String(Math.max(0, -bounding[3])))),
    bounding,
  };
  const priority = sourcePriority(metadata.registry);
  const glyphs = [];

  for (const block of source.split("STARTCHAR ").slice(1)) {
    const encoding = Number(block.match(/^ENCODING\s+(-?\d+)/m)?.[1] ?? -1);
    const character = encodingToCharacter(encoding, metadata.registry);
    if (!character || character === "\ufffd" || Array.from(character).length !== 1) continue;
    const dwidth = block.match(/^DWIDTH\s+(-?\d+)\s+(-?\d+)/m)?.slice(1).map(Number) ?? [bounding[0], 0];
    const swidth = block.match(/^SWIDTH\s+(-?\d+)\s+(-?\d+)/m)?.slice(1).map(Number) ?? [500, 0];
    const bbx = block.match(/^BBX\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/m)?.slice(1).map(Number) ?? [0, 0, 0, 0];
    const bitmap = block.match(/BITMAP\r?\n([\s\S]*?)\r?\nENDCHAR/)?.[1].trim() ?? "";
    glyphs.push({ codePoint: character.codePointAt(0), dwidth, swidth, bbx, bitmap, priority });
  }

  return { metadata, glyphs };
}

function groupKey(metadata, includeWeightAndSlant = true) {
  return [
    metadata.pixelSize,
    metadata.foundry,
    metadata.family,
    metadata.setWidth,
    metadata.addStyle,
    metadata.spacing,
    includeWeightAndSlant ? metadata.weight : "",
    includeWeightAndSlant ? metadata.slant : "",
  ].join("|").toLowerCase();
}

function crossedBoxGlyph(height, ascent, descent) {
  const width = Math.max(4, Math.min(16, height));
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let bits = 0n;
    for (let x = 0; x < width; x += 1) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || x === y || x === width - 1 - y) {
        bits |= 1n << BigInt(width - 1 - x);
      }
    }
    const paddedWidth = Math.ceil(width / 8) * 8;
    rows.push((bits << BigInt(paddedWidth - width)).toString(16).toUpperCase().padStart(paddedWidth / 4, "0"));
  }
  return {
    codePoint: 0xfffd,
    dwidth: [width, 0],
    swidth: [1000, 0],
    bbx: [width, height, 0, -descent],
    bitmap: rows.join("\n"),
    priority: 99,
  };
}

function renderGlyph(glyph) {
  const name = glyph.codePoint === 0xfffd ? "replacement" : `uni${glyph.codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  return [
    `STARTCHAR ${name}`,
    `ENCODING ${glyph.codePoint}`,
    `SWIDTH ${glyph.swidth.join(" ")}`,
    `DWIDTH ${glyph.dwidth.join(" ")}`,
    `BBX ${glyph.bbx.join(" ")}`,
    "BITMAP",
    glyph.bitmap,
    "ENDCHAR",
  ].join("\n");
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
mkdirSync(path.dirname(manifestPath), { recursive: true });

const sourceFiles = readdirSync(sourceDirectory)
  .filter((file) => /\.bdf$/i.test(file))
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
const parsedFonts = sourceFiles.map(parseFont);
const groups = new Map();

for (const font of parsedFonts) {
  const key = groupKey(font.metadata);
  const group = groups.get(key) ?? { metadata: font.metadata, fonts: [], sourceFonts: [], glyphs: new Map() };
  group.fonts.push(font.metadata.file);
  group.sourceFonts.push(font);
  group.metadata.ascent = Math.max(group.metadata.ascent, font.metadata.ascent);
  group.metadata.descent = Math.max(group.metadata.descent, font.metadata.descent);
  for (const glyph of font.glyphs) {
    const existing = group.glyphs.get(glyph.codePoint);
    if (!existing || glyph.priority > existing.priority) group.glyphs.set(glyph.codePoint, glyph);
  }
  groups.set(key, group);
}

const latinSupplements = parsedFonts.filter(({ metadata }) => {
  const registry = metadata.registry.toUpperCase();
  return registry.includes("ISO8859") || registry.includes("JISX0201");
});

for (const group of groups.values()) {
  const hasJis208 = group.sourceFonts.some(({ metadata }) => metadata.registry.toUpperCase().includes("JISX0208"));
  if (!hasJis208) continue;

  const supplements = latinSupplements.filter(({ metadata }) =>
    metadata.foundry === group.metadata.foundry
    && metadata.pixelSize === group.metadata.pixelSize
    && metadata.weight === group.metadata.weight
    && metadata.slant === group.metadata.slant
  );

  for (const supplement of supplements) {
    if (!group.fonts.includes(supplement.metadata.file)) group.fonts.push(supplement.metadata.file);
    for (const glyph of supplement.glyphs) {
      const existing = group.glyphs.get(glyph.codePoint);
      if (!existing || glyph.priority > existing.priority) group.glyphs.set(glyph.codePoint, glyph);
    }
  }
}

const generated = [];
for (const group of groups.values()) {
  const metadata = group.metadata;
  const styleParts = [
    `${metadata.pixelSize}px`,
    metadata.foundry,
    metadata.family,
    metadata.addStyle,
    metadata.spacing === "P" ? "proportional" : "",
    metadata.weight.toLowerCase() === "bold" ? "bold" : "regular",
    metadata.slant.toUpperCase() === "I" ? "italic" : "",
  ].filter(Boolean);
  const outputName = `${sanitize(styleParts.join("-"))}.bdf`;
  const replacement = crossedBoxGlyph(metadata.pixelSize, metadata.ascent, metadata.descent);
  group.glyphs.set(replacement.codePoint, replacement);
  const glyphs = Array.from(group.glyphs.values()).sort((left, right) => left.codePoint - right.codePoint);
  const maxWidth = Math.max(...glyphs.map((glyph) => glyph.bbx[0]), 1);
  const minX = Math.min(...glyphs.map((glyph) => glyph.bbx[2]), 0);
  const minY = Math.min(...glyphs.map((glyph) => glyph.bbx[3]), -metadata.descent);
  const familyName = `${metadata.family}-${metadata.pixelSize}px-Merged`;
  const bdf = [
    "STARTFONT 2.1",
    `COMMENT Auto-generated from: ${group.fonts.join(", ")}`,
    `FONT -Merged-${metadata.family}-${metadata.weight}-${metadata.slant}-${metadata.setWidth}-${metadata.addStyle || "Merged"}-${metadata.pixelSize}-${metadata.pixelSize * 10}-75-75-${metadata.spacing}-${maxWidth * 10}-ISO10646-1`,
    `SIZE ${metadata.pixelSize} 75 75`,
    `FONTBOUNDINGBOX ${maxWidth} ${metadata.ascent + metadata.descent} ${minX} ${minY}`,
    "STARTPROPERTIES 11",
    `FOUNDRY "Merged"`,
    `FAMILY_NAME "${familyName}"`,
    `WEIGHT_NAME "${metadata.weight}"`,
    `SLANT "${metadata.slant}"`,
    `PIXEL_SIZE ${metadata.pixelSize}`,
    `SPACING "${metadata.spacing}"`,
    `CHARSET_REGISTRY "ISO10646"`,
    `CHARSET_ENCODING "1"`,
    `FONT_ASCENT ${metadata.ascent}`,
    `FONT_DESCENT ${metadata.descent}`,
    "DEFAULT_CHAR 65533",
    "ENDPROPERTIES",
    `CHARS ${glyphs.length}`,
    ...glyphs.map(renderGlyph),
    "ENDFONT",
    "",
  ].join("\n");
  writeFileSync(path.join(outputDirectory, outputName), bdf);
  generated.push({
    familyKey: groupKey(metadata, false),
    file: `merged-bdf/${outputName}`,
    label: `${metadata.pixelSize}px ${metadata.family}${metadata.addStyle ? ` ${metadata.addStyle}` : ""}${metadata.spacing === "P" ? " 比例宽度" : ""}`,
    pixelSize: metadata.pixelSize,
    bold: metadata.weight.toLowerCase() === "bold",
    italic: metadata.slant.toUpperCase() === "I",
    glyphs: glyphs.length,
    sources: group.fonts,
  });
}

const familyMap = new Map();
for (const font of generated) {
  const family = familyMap.get(font.familyKey) ?? {
    id: font.familyKey,
    label: font.label,
    charset: "ISO10646-1 (Merged)",
    variants: [],
  };
  family.variants.push({
    file: font.file,
    bold: font.bold,
    italic: font.italic,
  });
  familyMap.set(font.familyKey, family);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceCount: sourceFiles.length,
  mergedCount: generated.length,
  fontFiles: generated.map((font) => font.file),
  fontFamilies: Array.from(familyMap.values())
    .map((family) => ({
      ...family,
      variants: family.variants.sort((left, right) => Number(left.bold) - Number(right.bold) || Number(left.italic) - Number(right.italic)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN", { numeric: true })),
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.mergedCount} merged Unicode BDF fonts from ${manifest.sourceCount} source files.`);
