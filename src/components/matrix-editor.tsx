"use client";

import {
  Box,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Grid3X3,
  Layers3,
  LoaderCircle,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Trash2,
  Type,
} from "lucide-react";
import { ChangeEvent, DragEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BdfFont, Glyph, parseBdf } from "@/lib/bdf";
import { FontFamily, fontLabel } from "@/lib/fonts";

const DEFAULT_WIDTH = 128;
const DEFAULT_HEIGHT = 32;
const SCALE = 8;
const DEFAULT_FONT = "merged-bdf/8px-kadoma-misakigothic-regular.bdf";

type TextLayer = {
  id: string;
  type: "text";
  name: string;
  visible: boolean;
  x: number;
  y: number;
  text: string;
  font: string;
  fallbackFont: string;
  spacingMode: "advance" | "ink";
  spacing: number;
  color: string;
  outline: boolean;
  outlineColor: string;
};

type RectLayer = {
  id: string;
  type: "rect";
  name: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
  fillEnabled: boolean;
  fillColor: string;
};

type Layer = TextLayer | RectLayer;

const initialLayers: Layer[] = [
  {
    id: "welcome",
    type: "text",
    name: "标题文字",
    visible: true,
    x: 3,
    y: 3,
    text: "点阵屏幕",
    font: DEFAULT_FONT,
    fallbackFont: "auto",
    spacingMode: "advance",
    spacing: 1,
    color: "#d7ff3f",
    outline: false,
    outlineColor: "#ffffff",
  },
  {
    id: "divider",
    type: "rect",
    name: "底部横线",
    visible: true,
    x: 3,
    y: 26,
    width: 122,
    height: 2,
    borderEnabled: true,
    borderWidth: 1,
    borderColor: "#d7ff3f",
    fillEnabled: false,
    fillColor: "#d7ff3f",
  },
];

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function safeProjectName(name: string) {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "") || "未命名项目";
}

function normalizeLayer(layer: Layer): Layer {
  if (layer.type === "text") {
    return {
      ...layer,
      fallbackFont: layer.fallbackFont ?? "auto",
      spacingMode: layer.spacingMode ?? "advance",
      color: layer.color ?? "#d7ff3f",
      outline: layer.outline ?? false,
      outlineColor: layer.outlineColor ?? "#ffffff",
    };
  }
  const legacy = layer as RectLayer & { color?: string; filled?: boolean };
  return {
    ...layer,
    name: layer.name || "边框矩形",
    borderEnabled: layer.borderEnabled ?? true,
    borderWidth: layer.borderWidth ?? 1,
    borderColor: layer.borderColor ?? legacy.color ?? "#d7ff3f",
    fillEnabled: layer.fillEnabled ?? legacy.filled ?? false,
    fillColor: layer.fillColor ?? legacy.color ?? "#d7ff3f",
  };
}

function setPixel<T>(buffer: { length: number; [index: number]: T }, width: number, height: number, x: number, y: number, value: T) {
  if (x >= 0 && x < width && y >= 0 && y < height) buffer[y * width + x] = value;
}

function drawGlyph(buffer: Uint8Array, width: number, height: number, glyph: Glyph, x: number, baseline: number) {
  const rowWidth = Math.ceil(glyph.width / 8) * 8;
  glyph.rows.forEach((bits, row) => {
    for (let column = 0; column < glyph.width; column += 1) {
      const shift = BigInt(rowWidth - 1 - column);
      if (((bits >> shift) & 1n) === 1n) {
        setPixel(buffer, width, height, x + glyph.xOffset + column, baseline - glyph.yOffset - glyph.height + row, 1);
      }
    }
  });
}

function glyphInkBounds(glyph: Glyph) {
  const rowWidth = Math.ceil(glyph.width / 8) * 8;
  let left = glyph.width;
  let right = -1;
  glyph.rows.forEach((bits) => {
    for (let column = 0; column < glyph.width; column += 1) {
      const shift = BigInt(rowWidth - 1 - column);
      if (((bits >> shift) & 1n) === 1n) {
        left = Math.min(left, column);
        right = Math.max(right, column);
      }
    }
  });
  return right >= left ? { left, right } : null;
}

function automaticFallbackFont(file: string) {
  const match = file.match(/^shnmk(12|14|16)(.*)\.bdf$/i);
  if (!match) return "";
  const width = match[1] === "12" ? "6x12" : match[1] === "14" ? "7x14" : "8x16";
  const style = match[2].toLowerCase();
  const suffix = style.endsWith("bi") ? "abi" : style.endsWith("b") ? "ab" : style.endsWith("i") ? "ai" : "a";
  return `shnm${width}${suffix}.bdf`;
}

function resolvedFallbackFont(layer: TextLayer) {
  if (layer.font.includes("/")) return "";
  return layer.fallbackFont === "auto" ? automaticFallbackFont(layer.font) : layer.fallbackFont;
}

function fontUrl(file: string) {
  return file.includes("/") ? `/${file}` : `/bdf/${file}`;
}

function renderLayers(layers: Layer[], fonts: Map<string, BdfFont>, width: number, height: number) {
  const buffer = Array<string | null>(width * height).fill(null);
  [...layers].reverse().forEach((layer) => {
    if (!layer.visible) return;
    if (layer.type === "rect") {
      const borderWidth = clamp(layer.borderWidth ?? 1, 1, Math.ceil(Math.min(layer.width, layer.height) / 2));
      for (let y = 0; y < layer.height; y += 1) {
        for (let x = 0; x < layer.width; x += 1) {
          if (layer.fillEnabled) {
            setPixel(buffer, width, height, layer.x + x, layer.y + y, layer.fillColor ?? "#d7ff3f");
          }
          if (layer.borderEnabled && (x < borderWidth || y < borderWidth || x >= layer.width - borderWidth || y >= layer.height - borderWidth)) {
            setPixel(buffer, width, height, layer.x + x, layer.y + y, layer.borderColor ?? "#d7ff3f");
          }
        }
      }
      return;
    }
    const font = fonts.get(layer.font);
    if (!font) return;
    const fallbackFont = fonts.get(resolvedFallbackFont(layer));
    const textMask = new Uint8Array(width * height);
    let cursor = layer.x;
    for (const character of Array.from(layer.text)) {
      const glyph = font.glyphs.get(character)
        ?? fallbackFont?.glyphs.get(character)
        ?? font.fallback
        ?? fallbackFont?.fallback
        ?? font.glyphs.get("?")
        ?? fallbackFont?.glyphs.get("?");
      if (!glyph) continue;
      if (layer.spacingMode === "ink") {
        const bounds = glyphInkBounds(glyph);
        if (bounds) {
          const glyphOrigin = cursor - glyph.xOffset - bounds.left;
          drawGlyph(textMask, width, height, glyph, glyphOrigin, layer.y + font.ascent);
          cursor += bounds.right - bounds.left + 1 + layer.spacing;
        } else {
          cursor += glyph.advance + layer.spacing;
        }
      } else {
        drawGlyph(textMask, width, height, glyph, cursor, layer.y + font.ascent);
        cursor += glyph.advance + layer.spacing;
      }
    }
    if (layer.outline) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!textMask[y * width + x]) continue;
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              const nx = x + ox;
              const ny = y + oy;
              const neighborIsText = nx >= 0 && nx < width && ny >= 0 && ny < height && textMask[ny * width + nx];
              if ((ox || oy) && !neighborIsText) {
                setPixel(buffer, width, height, nx, ny, layer.outlineColor ?? "#ffffff");
              }
            }
          }
        }
      }
    }
    textMask.forEach((on, index) => {
      if (on) buffer[index] = layer.color ?? "#d7ff3f";
    });
  });
  return buffer;
}

export default function MatrixEditor({ fontFiles, fontFamilies }: { fontFiles: string[]; fontFamilies: FontFamily[] }) {
  const [projectName, setProjectName] = useState("未命名项目");
  const [matrixWidth, setMatrixWidth] = useState(DEFAULT_WIDTH);
  const [matrixHeight, setMatrixHeight] = useState(DEFAULT_HEIGHT);
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedId, setSelectedId] = useState(initialLayers[0].id);
  const [fonts, setFonts] = useState<Map<string, BdfFont>>(new Map());
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());
  const [gridVisible, setGridVisible] = useState(true);
  const [status, setStatus] = useState("就绪");
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const selected = layers.find((layer) => layer.id === selectedId) ?? null;
  const selectedFontFamily = selected?.type === "text"
    ? fontFamilies.find((family) => family.variants.some((variant) => variant.file === selected.font))
    : undefined;
  const selectedFontVariant = selected?.type === "text"
    ? selectedFontFamily?.variants.find((variant) => variant.file === selected.font)
    : undefined;

  const loadFont = useCallback(async (file: string) => {
    if (fonts.has(file) || loadingFonts.has(file)) return;
    setLoadingFonts((current) => new Set(current).add(file));
    try {
      const response = await fetch(fontUrl(file));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseBdf(await response.text(), file);
      setFonts((current) => new Map(current).set(file, parsed));
      setStatus(`已载入 ${fontLabel(file)} · ${parsed.glyphs.size} 字形`);
    } catch (error) {
      setStatus(`字体载入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingFonts((current) => {
        const next = new Set(current);
        next.delete(file);
        return next;
      });
    }
  }, [fonts, loadingFonts]);

  useEffect(() => {
    const requiredFonts = layers
      .filter((layer): layer is TextLayer => layer.type === "text")
      .flatMap((layer) => [layer.font, resolvedFallbackFont(layer)])
      .filter(Boolean);
    new Set(requiredFonts)
      .forEach((file) => void loadFont(file));
  }, [layers, loadFont]);

  const pixels = useMemo(() => renderLayers(layers, fonts, matrixWidth, matrixHeight), [layers, fonts, matrixWidth, matrixHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#070b0d";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < matrixHeight; y += 1) {
      for (let x = 0; x < matrixWidth; x += 1) {
        const color = pixels[y * matrixWidth + x];
        if (color) {
          context.fillStyle = color;
          context.fillRect(x * SCALE + 1, y * SCALE + 1, SCALE - 1, SCALE - 1);
        }
      }
    }
    if (gridVisible) {
      context.strokeStyle = "rgba(148, 163, 184, .11)";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= matrixWidth; x += 1) {
        context.moveTo(x * SCALE + 0.5, 0);
        context.lineTo(x * SCALE + 0.5, matrixHeight * SCALE);
      }
      for (let y = 0; y <= matrixHeight; y += 1) {
        context.moveTo(0, y * SCALE + 0.5);
        context.lineTo(matrixWidth * SCALE, y * SCALE + 0.5);
      }
      context.stroke();
    }
  }, [pixels, gridVisible, matrixWidth, matrixHeight]);

  const updateSelected = (patch: Partial<Layer>) => {
    setLayers((current) => current.map((layer) => layer.id === selectedId ? { ...layer, ...patch } as Layer : layer));
  };

  const selectFontVariant = (family: FontFamily, bold: boolean, italic: boolean) => {
    const variant = family.variants.find((item) => item.bold === bold && item.italic === italic)
      ?? family.variants.find((item) => item.bold === bold && !item.italic)
      ?? family.variants.find((item) => !item.bold && item.italic === italic)
      ?? family.variants[0];
    if (variant) updateSelected({ font: variant.file });
  };

  const addLayer = (type: Layer["type"]) => {
    const id = makeId();
    const layer: Layer = type === "text"
      ? { id, type, name: "文字图层", visible: true, x: 4, y: 4, text: "新文字", font: DEFAULT_FONT, fallbackFont: "auto", spacingMode: "advance", spacing: 0, color: "#d7ff3f", outline: false, outlineColor: "#ffffff" }
      : { id, type, name: "矩形图层", visible: true, x: 8, y: 8, width: 24, height: 12, borderEnabled: true, borderWidth: 1, borderColor: "#d7ff3f", fillEnabled: false, fillColor: "#d7ff3f" };
    setLayers((current) => {
      const selectedIndex = current.findIndex((item) => item.id === selectedId);
      if (selectedIndex < 0) return [layer, ...current];
      const next = [...current];
      next.splice(selectedIndex + 1, 0, layer);
      return next;
    });
    setSelectedId(id);
  };

  const moveLayer = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;
    setLayers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const previewLayerMove = (targetId: string, after: boolean) => {
    if (!draggedLayerId || draggedLayerId === targetId) return;
    setLayers((current) => {
      const sourceIndex = current.findIndex((layer) => layer.id === draggedLayerId);
      if (sourceIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const targetIndex = next.findIndex((layer) => layer.id === targetId);
      if (targetIndex < 0) return current;
      next.splice(targetIndex + (after ? 1 : 0), 0, moved);
      if (next.every((layer, index) => layer.id === current[index].id)) return current;
      return next;
    });
  };

  const dropLayer = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggedLayerId(null);
    setDropTarget(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    setLayers((current) => {
      const next = current.filter((layer) => layer.id !== selected.id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  };

  const pointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) / rect.width * matrixWidth),
      y: Math.floor((event.clientY - rect.top) / rect.height * matrixHeight),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event);
    const hitLayers = layers.filter((layer) => renderLayers([layer], fonts, matrixWidth, matrixHeight)[point.y * matrixWidth + point.x]);
    const target = hitLayers[0];
    if (!target) return;

    setSelectedId(target.id);
    dragRef.current = { id: target.id, dx: point.x - target.x, dy: point.y - target.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointerPosition(event);
    setLayers((current) => current.map((layer) => layer.id === drag.id
      ? { ...layer, x: clamp(point.x - drag.dx, -matrixWidth + 1, matrixWidth - 1), y: clamp(point.y - drag.dy, -matrixHeight + 1, matrixHeight - 1) }
      : layer));
  };

  const exportProject = () => {
    const name = safeProjectName(projectName);
    const blob = new Blob([JSON.stringify({ version: 1, name, width: matrixWidth, height: matrixHeight, layers }, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${name}.json`);
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const project = JSON.parse(await file.text()) as { name?: string; width?: number; height?: number; layers?: Layer[] };
      if (!Array.isArray(project.layers)) throw new Error("缺少 layers 数组");
      const normalized = project.layers.map(normalizeLayer);
      setProjectName(project.name?.trim() || file.name.replace(/\.json$/i, "") || "未命名项目");
      setMatrixWidth(clamp(Math.round(project.width ?? DEFAULT_WIDTH), 8, 512));
      setMatrixHeight(clamp(Math.round(project.height ?? DEFAULT_HEIGHT), 8, 128));
      setLayers(normalized);
      setSelectedId(normalized[0]?.id ?? "");
      setStatus(`已导入 ${project.layers.length} 个图层`);
    } catch (error) {
      setStatus(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
    event.target.value = "";
  };

  const exportPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = matrixWidth;
    canvas.height = matrixHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, matrixWidth, matrixHeight);
    pixels.forEach((color, index) => {
      if (color) {
        context.fillStyle = color;
        context.fillRect(index % matrixWidth, Math.floor(index / matrixWidth), 1, 1);
      }
    });
    canvas.toBlob((blob) => blob && downloadBlob(blob, `${safeProjectName(projectName)}.png`));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Box size={18} strokeWidth={2.4} /></div>
          <div>
            <strong>DOT STUDIO</strong>
            <input
              className="project-name"
              value={projectName}
              maxLength={80}
              aria-label="项目名"
              title="项目名"
              onChange={(event) => setProjectName(event.target.value)}
              onBlur={() => setProjectName((current) => current.trim() || "未命名项目")}
            />
          </div>
        </div>
        <div className="top-actions">
          <button className="button ghost" onClick={() => importRef.current?.click()}><FileUp size={16} />导入</button>
          <input ref={importRef} className="hidden" type="file" accept=".json,application/json" onChange={importProject} />
          <button className="button ghost" onClick={exportProject}><FileDown size={16} />项目</button>
          <button className="button primary" onClick={exportPng}><Download size={16} />导出 PNG</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel layers-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">STRUCTURE</span><h2>图层</h2></div>
            <div className="add-actions">
              <button title="添加文字" onClick={() => addLayer("text")}><Type size={16} /></button>
              <button title="添加矩形" onClick={() => addLayer("rect")}><RectangleHorizontal size={16} /></button>
            </div>
          </div>
          <div className="layer-list">
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                draggable
                className={`layer-row ${selectedId === layer.id ? "selected" : ""} ${draggedLayerId === layer.id ? "dragging" : ""} ${dropTarget?.id === layer.id && draggedLayerId !== layer.id ? (dropTarget.after ? "drop-after" : "drop-before") : ""}`}
                onClick={() => setSelectedId(layer.id)}
                onDragStart={(event) => {
                  setDraggedLayerId(layer.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", layer.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const rect = event.currentTarget.getBoundingClientRect();
                  const after = event.clientY >= rect.top + rect.height / 2;
                  setDropTarget({ id: layer.id, after });
                  previewLayerMove(layer.id, after);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
                }}
                onDrop={dropLayer}
                onDragEnd={() => {
                  setDraggedLayerId(null);
                  setDropTarget(null);
                }}
              >
                <button
                  className="visibility"
                  title={layer.visible ? "隐藏" : "显示"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, visible: !item.visible } : item));
                  }}
                >
                  {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <div className="layer-icon">{layer.type === "text" ? <Type size={16} /> : <RectangleHorizontal size={16} />}</div>
                <div className="layer-copy"><strong>{layer.name}</strong><span>{layer.type === "text" ? layer.text || "空文字" : `${layer.width} × ${layer.height}`}</span></div>
                <div className="order-actions">
                  <button disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveLayer(index, -1); }}><ChevronUp size={13} /></button>
                  <button disabled={index === layers.length - 1} onClick={(event) => { event.stopPropagation(); moveLayer(index, 1); }}><ChevronDown size={13} /></button>
                </div>
              </div>
            ))}
            {!layers.length && <div className="empty-state"><Layers3 size={28} /><span>添加一个图层开始排版</span></div>}
          </div>
          <div className="layer-footer">
            <button className="button wide" onClick={() => addLayer("text")}><Plus size={15} />新增图层</button>
          </div>
        </aside>

        <section className="stage">
          <div className="stage-toolbar">
            <div className="matrix-settings">
              <span className="status-dot" />
              <input
                type="number"
                aria-label="矩阵宽度"
                value={matrixWidth}
                min={8}
                max={512}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) setMatrixWidth(clamp(Math.round(value), 8, 512));
                }}
              />
              <span>×</span>
              <input
                type="number"
                aria-label="矩阵高度"
                value={matrixHeight}
                min={8}
                max={128}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) setMatrixHeight(clamp(Math.round(value), 8, 128));
                }}
              />
              <span>MONO MATRIX</span>
            </div>
            <button className={gridVisible ? "active" : ""} onClick={() => setGridVisible((value) => !value)}><Grid3X3 size={15} />网格</button>
          </div>
          <div className="canvas-wrap">
            <div className="matrix-frame">
              <canvas
                ref={canvasRef}
                width={matrixWidth * SCALE}
                height={matrixHeight * SCALE}
                style={{ aspectRatio: `${matrixWidth} / ${matrixHeight}` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
              />
            </div>
            <div className="axis x-axis">
              {Array.from({ length: 5 }, (_, index) => Math.round((matrixWidth - 1) * index / 4)).map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
            </div>
            <div className="stage-hint">点击图层像素即可选择并拖动 · 重叠时选择最顶层可见图层</div>
          </div>
          <footer className="statusbar">
            <span>{loadingFonts.size ? <><LoaderCircle className="spin" size={13} />正在解析字体…</> : status}</span>
            <span>{pixels.filter(Boolean).length} PIXELS ON</span>
          </footer>
        </section>

        <aside className="panel inspector">
          <div className="panel-heading">
            <div><span className="eyebrow">INSPECTOR</span><h2>属性</h2></div>
            {selected && <button className="danger-icon" title="删除图层" onClick={deleteSelected}><Trash2 size={16} /></button>}
          </div>
          {selected ? (
            <div className="properties">
              <Field label="图层名称">
                <input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
              </Field>
              <div className="property-section">
                <h3>位置</h3>
                <div className="field-grid">
                  <NumberField label="X" value={selected.x} min={-matrixWidth + 1} max={matrixWidth - 1} onChange={(x) => updateSelected({ x })} />
                  <NumberField label="Y" value={selected.y} min={-matrixHeight + 1} max={matrixHeight - 1} onChange={(y) => updateSelected({ y })} />
                </div>
              </div>
              {selected.type === "text" ? (
                <>
                  <div className="property-section">
                    <h3>文字</h3>
                    <Field label="内容">
                      <textarea rows={3} value={selected.text} onChange={(event) => updateSelected({ text: event.target.value.replace(/\r?\n/g, "") })} />
                    </Field>
                    <Field label="BDF 字体">
                      <div className="select-wrap">
                        <select
                          value={selectedFontFamily?.id ?? ""}
                          onChange={(event) => {
                            const family = fontFamilies.find((item) => item.id === event.target.value);
                            if (family) selectFontVariant(family, selectedFontVariant?.bold ?? false, selectedFontVariant?.italic ?? false);
                          }}
                        >
                          {!selectedFontFamily && <option value="">{fontLabel(selected.font)}（未分组）</option>}
                          {fontFamilies.map((family) => <option key={family.id} value={family.id}>{family.label}</option>)}
                        </select>
                        {loadingFonts.has(selected.font) ? <LoaderCircle className="select-icon spin" size={15} /> : <ChevronDown className="select-icon" size={15} />}
                      </div>
                    </Field>
                    {selectedFontFamily && (
                      <div className="font-style-row">
                        <button
                          type="button"
                          className={selectedFontVariant?.bold ? "active" : ""}
                          disabled={!selectedFontFamily.variants.some((variant) => variant.bold === !selectedFontVariant?.bold && variant.italic === (selectedFontVariant?.italic ?? false))}
                          onClick={() => selectFontVariant(selectedFontFamily, !selectedFontVariant?.bold, selectedFontVariant?.italic ?? false)}
                        >
                          <b>B</b> 粗体
                        </button>
                        <button
                          type="button"
                          className={selectedFontVariant?.italic ? "active" : ""}
                          disabled={!selectedFontFamily.variants.some((variant) => variant.bold === (selectedFontVariant?.bold ?? false) && variant.italic === !selectedFontVariant?.italic)}
                          onClick={() => selectFontVariant(selectedFontFamily, selectedFontVariant?.bold ?? false, !selectedFontVariant?.italic)}
                        >
                          <i>I</i> 斜体
                        </button>
                      </div>
                    )}
                    {selectedFontFamily?.charset.toUpperCase().includes("ISO8859") && <p className="font-note"><b>a</b>：ISO-8859-1 西文字集</p>}
                    {selectedFontFamily?.charset.toUpperCase().includes("JISX0201") && <p className="font-note"><b>r</b>：JIS X 0201 罗马字 / 半角片假名</p>}
                    {!selected.font.includes("/") && (
                      <Field label="数字 / 西文回退字体">
                        <div className="select-wrap">
                          <select value={selected.fallbackFont ?? "auto"} onChange={(event) => updateSelected({ fallbackFont: event.target.value })}>
                            <option value="auto">自动匹配{automaticFallbackFont(selected.font) ? `（${fontLabel(automaticFallbackFont(selected.font))}）` : ""}</option>
                            <option value="">不使用回退</option>
                            {fontFiles.map((font) => <option key={font} value={font}>{fontLabel(font)}</option>)}
                          </select>
                          <ChevronDown className="select-icon" size={15} />
                        </div>
                      </Field>
                    )}
                    <Field label="字间距计算">
                      <div className="select-wrap">
                        <select value={selected.spacingMode ?? "advance"} onChange={(event) => updateSelected({ spacingMode: event.target.value as TextLayer["spacingMode"] })}>
                          <option value="advance">字体字宽（DWIDTH）</option>
                          <option value="ink">墨迹边界紧排</option>
                        </select>
                        <ChevronDown className="select-icon" size={15} />
                      </div>
                    </Field>
                    <NumberField label={selected.spacingMode === "ink" ? "墨迹字间距" : "附加字间距"} value={selected.spacing} min={-8} max={32} onChange={(spacing) => updateSelected({ spacing })} />
                    {selected.spacingMode === "ink" && <p className="font-note">按字形实际亮点的左右边界计算，描边不计入字间距。</p>}
                    <ColorField label="文字颜色" value={selected.color ?? "#d7ff3f"} onChange={(color) => updateSelected({ color })} />
                    <label className="toggle-row">
                      <span><strong>1px 外描边</strong><small>在字形外侧扩展一个像素</small></span>
                      <input type="checkbox" checked={selected.outline ?? false} onChange={(event) => updateSelected({ outline: event.target.checked })} />
                      <i />
                    </label>
                    {selected.outline && <ColorField label="描边颜色" value={selected.outlineColor ?? "#ffffff"} onChange={(outlineColor) => updateSelected({ outlineColor })} />}
                  </div>
                  <FontInfo font={fonts.get(selected.font)} />
                </>
              ) : (
                <div className="property-section">
                  <h3>形状</h3>
                  <div className="field-grid">
                    <NumberField label="宽度" value={selected.width} min={1} max={256} onChange={(width) => updateSelected({ width })} />
                    <NumberField label="高度" value={selected.height} min={1} max={64} onChange={(height) => updateSelected({ height })} />
                  </div>
                  <label className="toggle-row">
                    <span><strong>显示边框</strong><small>绘制矩形边缘</small></span>
                    <input type="checkbox" checked={selected.borderEnabled ?? true} onChange={(event) => updateSelected({ borderEnabled: event.target.checked })} />
                    <i />
                  </label>
                  {selected.borderEnabled && (
                    <>
                      <NumberField label="边框粗细" value={selected.borderWidth ?? 1} min={1} max={16} onChange={(borderWidth) => updateSelected({ borderWidth })} />
                      <ColorField label="边框颜色" value={selected.borderColor ?? "#d7ff3f"} onChange={(borderColor) => updateSelected({ borderColor })} />
                    </>
                  )}
                  <label className="toggle-row">
                    <span><strong>显示填充</strong><small>填充矩形内部区域</small></span>
                    <input type="checkbox" checked={selected.fillEnabled ?? false} onChange={(event) => updateSelected({ fillEnabled: event.target.checked })} />
                    <i />
                  </label>
                  {selected.fillEnabled && <ColorField label="填充颜色" value={selected.fillColor ?? "#d7ff3f"} onChange={(fillColor) => updateSelected({ fillColor })} />}
                </div>
              )}
              <button className="button reset" onClick={() => updateSelected({ x: 0, y: 0 })}><RotateCcw size={14} />坐标归零</button>
            </div>
          ) : <div className="empty-state inspector-empty"><Layers3 size={30} /><span>选择一个图层编辑属性</span></div>}
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" value={value} min={min} max={max} onChange={(event) => onChange(clamp(Number(event.target.value), min, max))} />
    </Field>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value.toUpperCase());

  useEffect(() => {
    setText(value.toUpperCase());
  }, [value]);

  const updateHex = (input: string) => {
    const next = input.toUpperCase();
    if (!/^#?[0-9A-F]{0,6}$/.test(next)) return;
    const normalized = next.startsWith("#") ? next : `#${next}`;
    setText(normalized);
    if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized.toLowerCase());
  };

  return (
    <Field label={label}>
      <div className="color-field">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          placeholder="#RRGGBB"
          onChange={(event) => updateHex(event.target.value)}
          onBlur={() => setText(value.toUpperCase())}
          aria-label={`${label}十六进制值`}
        />
      </div>
    </Field>
  );
}

function FontInfo({ font }: { font?: BdfFont }) {
  if (!font) return null;
  return (
    <div className="font-info">
      <span>FONT METRICS</span>
      <div><b>{font.height}px</b><small>高度</small></div>
      <div><b>{font.ascent}</b><small>上伸</small></div>
      <div><b>{font.glyphs.size}</b><small>字形</small></div>
    </div>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
