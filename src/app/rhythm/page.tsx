"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rhythmConfigs, type YunDict } from "./rhythms";
import styles from "./page.module.css";

type CharIndex = Map<string, string[]>;

type AnnotatedToken = {
  char: string;
  groups: string[] | null;
};

type ToneLabel = "平" | "上" | "去" | "入" | "其他";
type ToneColumn = "平" | "上" | "去" | "入";

type ToneKind = "ping" | "shang" | "qu" | "ru" | "unknown";

type RenderRow = {
  kind: "char" | "blank";
  key: string;
  rowId?: string;
  char: string;
  tones: Record<ToneColumn, string[]>;
};

const HAN_CHAR_PATTERN = /\p{Unified_Ideograph}/u;

function isHanChar(char: string): boolean {
  return HAN_CHAR_PATTERN.test(char);
}

function buildCharIndex(dict: YunDict): CharIndex {
  const index: CharIndex = new Map();

  Object.entries(dict).forEach(([group, chars]) => {
    for (const char of chars) {
      if (!isHanChar(char)) {
        continue;
      }

      const existing = index.get(char);
      if (!existing) {
        index.set(char, [group]);
        continue;
      }

      if (!existing.includes(group)) {
        existing.push(group);
      }
    }
  });

  return index;
}

function annotateText(text: string, index: CharIndex): AnnotatedToken[] {
  return Array.from(text).map((char) => ({
    char,
    groups: isHanChar(char) ? (index.get(char) ?? null) : null,
  }));
}

function extractTone(group: string): string {
  const match = group.match(/([平上去入])$/u);
  return match?.[1] ?? "-";
}

function normalizeToneLabel(tone: string): ToneLabel {
  if (tone === "平" || tone === "上" || tone === "去" || tone === "入") {
    return tone;
  }
  return "其他";
}

function toneKindFromTone(tone: string): ToneKind {
  if (tone === "平") {
    return "ping";
  }
  if (tone === "上") {
    return "shang";
  }
  if (tone === "去") {
    return "qu";
  }
  if (tone === "入") {
    return "ru";
  }
  return "unknown";
}

function stripToneFromGroup(group: string): string {
  const stripped = group.replace(/([平上去入])$/u, "");
  return stripped.length > 0 ? stripped : group;
}

function isNonHanChar(char: string): boolean {
  return !isHanChar(char);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "true");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

const TABLE_TONES: ToneColumn[] = ["平", "上", "去", "入"];

const indexByDictId: Record<string, CharIndex> = Object.fromEntries(
  rhythmConfigs.map((config) => [config.id, buildCharIndex(config.dict)]),
) as Record<string, CharIndex>;

const defaultInput = "春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。";

const toneClassMap: Record<ToneKind, string> = {
  ping: styles.dictToneGroupPing,
  shang: styles.dictToneGroupShang,
  qu: styles.dictToneGroupQu,
  ru: styles.dictToneGroupRu,
  unknown: styles.dictToneGroupUnknown,
};

export default function RhythmPage() {
  const [dictId, setDictId] = useState(rhythmConfigs[0]?.id ?? "");
  const [inputText, setInputText] = useState(defaultInput);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [navHeight, setNavHeight] = useState<number | null>(null);
  const [inputMinHeight, setInputMinHeight] = useState(140);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  const currentDict = useMemo(
    () => rhythmConfigs.find((config) => config.id === dictId) ?? rhythmConfigs[0],
    [dictId],
  );

  const annotatedTokens = useMemo(() => {
    if (!currentDict) {
      return [];
    }

    return annotateText(inputText, indexByDictId[currentDict.id]);
  }, [currentDict, inputText]);

  const matchedCount = useMemo(
    () => annotatedTokens.filter((token) => token.groups).length,
    [annotatedTokens],
  );

  const renderRows = useMemo(() => {
    if (!currentDict) {
      return [];
    }

    const groupOrder = new Map(
      Object.keys(currentDict.dict).map((group, idx) => [group, idx]),
    );

    const rows: RenderRow[] = [];

    for (let idx = 0; idx < annotatedTokens.length; idx += 1) {
      const token = annotatedTokens[idx];

      if (isNonHanChar(token.char)) {
        const start = idx;
        while (
          idx + 1 < annotatedTokens.length &&
          isNonHanChar(annotatedTokens[idx + 1].char)
        ) {
          idx += 1;
        }

        rows.push({
          kind: "blank",
          key: `blank-${start}-${idx}`,
          char: "",
          tones: { 平: [], 上: [], 去: [], 入: [] },
        });
        continue;
      }

      const tones: Record<ToneColumn, string[]> = {
        平: [],
        上: [],
        去: [],
        入: [],
      };

      (token.groups ?? [])
        .slice()
        .sort(
          (a, b) =>
            (groupOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (groupOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
        )
        .forEach((group) => {
          const tone = normalizeToneLabel(extractTone(group));
          if (tone === "其他") {
            return;
          }
          tones[tone].push(stripToneFromGroup(group));
        });

      rows.push({
        kind: "char",
        key: `char-${idx}-${token.char}`,
        rowId: `row-${idx}`,
        char: token.char,
        tones,
      });
    }

    return rows;
  }, [annotatedTokens, currentDict]);

  const navItems = useMemo(
    () =>
      renderRows.map((row) =>
        row.kind === "char"
          ? {
              key: `nav-${row.key}`,
              kind: "char" as const,
              char: row.char,
              rowId: row.rowId ?? "",
              rowKey: row.key,
            }
          : { key: `nav-${row.key}`, kind: "blank" as const },
      ),
    [renderRows],
  );

  const expandedGroupCount = useMemo(
    () =>
      renderRows.reduce(
        (sum, row) =>
          sum +
          TABLE_TONES.reduce((innerSum, tone) => innerSum + row.tones[tone].length, 0),
        0,
      ),
    [renderRows],
  );

  useEffect(() => {
    if (!window.location.hash.startsWith("#row-")) {
      return;
    }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    const syncHeight = () => {
      setNavHeight(textarea.offsetHeight);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(textarea);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const syncInputMinHeight = () => {
      const prevHeight = nav.style.height;
      nav.style.height = "auto";
      const contentHeight = Math.ceil(nav.scrollHeight);
      nav.style.height = prevHeight;

      const neededHeight = Math.max(140, contentHeight);
      setInputMinHeight((prev) => (prev === neededHeight ? prev : neededHeight));
    };

    syncInputMinHeight();
    window.addEventListener("resize", syncInputMinHeight);

    return () => {
      window.removeEventListener("resize", syncInputMinHeight);
    };
  }, [navItems]);

  const jumpToRow = (rowId: string) => {
    const row = document.getElementById(rowId);
    if (!row) {
      return;
    }
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const copyGroupText = (group: string) => {
    void copyText(group);
  };

  const activateAndJumpToRow = (rowId: string, rowKey: string) => {
    setActiveRowKey(rowKey);
    jumpToRow(rowId);
  };

  return (
    <main className={styles.dictPage}>
      <section className={styles.dictCard}>
        <header className={styles.dictHeader}>
          <h1 className={styles.dictTitle}>平水韵标注器</h1>
        </header>

        <div className={styles.dictControls}>
          <label className={styles.dictLabel} htmlFor="dict-select">
            字典配置
          </label>
          <select
            className={styles.dictSelect}
            id="dict-select"
            onChange={(event) => setDictId(event.target.value)}
            value={currentDict?.id ?? ""}
          >
            {rhythmConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.label}
              </option>
            ))}
          </select>
          <p className={styles.dictDesc}>{currentDict?.description}</p>
        </div>

        <div className={styles.dictWorkspace}>
          <div className={styles.dictPane}>
            <label className={styles.dictLabel} htmlFor="dict-input">
              输入文本
            </label>
            <textarea
              className={styles.dictInput}
              id="dict-input"
              onChange={(event) => setInputText(event.target.value)}
              ref={inputRef}
              spellCheck={false}
              style={{ minHeight: `${inputMinHeight}px` }}
              value={inputText}
            />
          </div>
          <div className={styles.dictPane}>
            <span className={styles.dictLabel}>字符导航</span>
            <div
              aria-label="字符导航"
              className={styles.dictNav}
              ref={navRef}
              style={navHeight ? { height: `${navHeight}px` } : undefined}
            >
              {navItems.map((item) =>
                item.kind === "char" ? (
                  <button
                    className={`${styles.dictNavChar}${activeRowKey === item.rowKey ? ` ${styles.isActive}` : ""}`}
                    key={item.key}
                    onClick={() => activateAndJumpToRow(item.rowId, item.rowKey)}
                    type="button"
                  >
                    {item.char}
                  </button>
                ) : (
                  <span aria-hidden="true" className={styles.dictNavBreak} key={item.key} />
                ),
              )}
            </div>
          </div>
        </div>

        <div className={styles.dictMeta}>
          命中{" "}{matchedCount} 字， {expandedGroupCount} 条韵部,点击韵部复制到剪贴板。
        </div>

        <div aria-label="平水韵标注结果" className={styles.dictTableWrap}>
          {renderRows.length === 0 ? (
            <p className={styles.dictEmpty}>未命中任何韵部。</p>
          ) : (
            <table className={styles.dictTable}>
              <thead>
                <tr>
                  <th>字</th>
                  <th>平</th>
                  <th>上</th>
                  <th>去</th>
                  <th>入</th>
                </tr>
              </thead>
              <tbody>
                {renderRows.map((row) => (
                  row.kind === "blank" ? (
                    <tr className={styles.dictRowBreak} key={row.key}
                      onMouseEnter={() => setActiveRowKey(row.key)}
                    >
                      <td colSpan={5}>
                        <span aria-hidden="true" className={styles.dictBreakSep} />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      className={activeRowKey === row.key ? styles.dictRowActive : undefined}
                      id={row.rowId}
                        key={row.key}
                        
                      onMouseEnter={() => setActiveRowKey(row.key)}
                    >
                      <td className={styles.dictCellChar}>
                        <span className={styles.dictCharBadge}>{row.char}</span>
                      </td>
                      {TABLE_TONES.map((tone) => (
                        <td key={`${row.key}-${tone}`}>
                          {row.tones[tone].length === 0 ? (
                            <span className={styles.dictCellEmpty}>-</span>
                          ) : (
                            <span className={styles.dictGroupList}>
                              {row.tones[tone].map((group) => (
                                <button
                                  aria-label={`复制韵部 ${group}`}
                                  className={`${styles.dictToneGroup} ${toneClassMap[toneKindFromTone(tone)]}`}
                                  key={`${row.key}-${tone}-${group}`}
                                  onClick={() => copyGroupText(group)}
                                  type="button"
                                >
                                  {group}
                                </button>
                              ))}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className={styles.dictNote}>
          注：当前按单字静态匹配，不处理句读、平仄或多音字语境判别。
        </p>
      </section>
    </main>
  );
}
