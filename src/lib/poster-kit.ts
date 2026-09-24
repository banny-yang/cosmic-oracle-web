/**
 * 海报绘制底座：所有绘制按逻辑尺寸（如 720×1120）书写，高清倍率由
 * createPosterCanvas 统一承担（POSTER_SCALE=2 → 导出 1440×2240）。
 * 提供：字体就绪等待、纸底纸纹、内框线、品牌印章、折行与动态字号、
 * 五行原语（色点/字块/分布/生克）与 PNG+JPEG 双规格导出。
 */
import QRCode from "qrcode";
import { posterQrTarget } from "./promo-config";

export const POSTER_SCALE = 2;

export const PAPER = "#F6EFE3";
export const PAPER_2 = "#F1E7D7";
export const INK = "#2B2417";
export const INK_SOFT = "rgba(43,36,23,.62)";
export const INK_FAINT = "rgba(43,36,23,.45)";
export const ACCENT = "#9E2B25";
export const ACCENT_LINE = "rgba(158,43,37,.3)";

/** 与站点 --font-seal 同栈：毛笔印章体缺字逐级回落楷体/宋体，避免单字突兀 */
export const FONT_SEAL = '"Ma Shan Zheng","KaiTi","STKaiti","Songti SC","SimSun",serif';
export const FONT_KAI = '"STKaiti","KaiTi","Songti SC",serif';
export const FONT_SONG = '"Songti SC","STSongti-SC-Regular","Noto Serif SC","KaiTi",serif';
export const FONT_SANS = 'system-ui,"PingFang SC","Microsoft YaHei",sans-serif';

const FONT_PROBE = "金木水火土喜用日主身强弱相生名鉴对脉沐阳";

let fontsPromise: Promise<void> | null = null;

/** 画字前必须等自托管毛笔字体就绪，否则首帧回落楷体；进程内只等一次，2.5s 兜底 */
export function ensurePosterFonts(): Promise<void> {
  fontsPromise ??= (async () => {
    const df = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!df?.load) return;
    const jobs = [FONT_SEAL, FONT_KAI].map((f) =>
      df.load(`64px ${f}`, FONT_PROBE).catch(() => undefined),
    );
    await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 2500))]);
  })();
  return fontsPromise;
}

export function createPosterCanvas(
  w: number,
  h: number,
): {
  cv: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
} {
  const cv = document.createElement("canvas");
  cv.width = w * POSTER_SCALE;
  cv.height = h * POSTER_SCALE;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas unavailable");
  g.scale(POSTER_SCALE, POSTER_SCALE);
  return { cv, g };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/** 纸底 + 纤维纸纹（正片叠底）；缺图不影响出图 */
export async function drawPaper(g: CanvasRenderingContext2D, w: number, h: number): Promise<void> {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, w, h);
  const grain = await loadImage("/paper-grain.png");
  if (!grain) return;
  const pat = g.createPattern(grain, "repeat");
  if (!pat) return;
  g.save();
  // 纹理按设备像素 1:1 平铺：整图缩放会把 375×600 的细点糊成一片空白（纹理本身极淡）
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = 0.9;
  g.fillStyle = pat;
  g.fillRect(0, 0, w * POSTER_SCALE, h * POSTER_SCALE);
  g.restore();
}

/** 内框线：淡墨双细线，inset 18 / 24 */
export function drawInnerFrame(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.save();
  g.strokeStyle = "rgba(43,36,23,.10)";
  g.lineWidth = 1;
  g.strokeRect(18, 18, w - 36, h - 36);
  g.strokeStyle = "rgba(43,36,23,.05)";
  g.strokeRect(24, 24, w - 48, h - 48);
  g.restore();
}

/** 品牌朱红方章（/brand-logo.png 圆角裁切）；图缺失时回退纯色方块 */
export async function drawBrandSeal(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  const r = size * 0.22;
  const img = await loadImage("/brand-logo.png");
  g.save();
  g.beginPath();
  g.roundRect(x, y, size, size, r);
  g.closePath();
  g.clip();
  if (img) {
    g.drawImage(img, x, y, size, size);
  } else {
    g.fillStyle = ACCENT;
    g.fillRect(x, y, size, size);
    g.fillStyle = PAPER;
    g.font = `${Math.round(size * 0.62)}px ${FONT_SEAL}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("名", x + size / 2, y + size / 2 + 1);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }
  g.restore();
  g.save();
  g.strokeStyle = "rgba(120,25,20,.35)";
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x + 0.5, y + 0.5, size - 1, size - 1, r);
  g.stroke();
  g.restore();
}

/** 折行：CJK 逐字断行、西文按空格断行；行首不断标点（把标点拉回上一行） */
export function wrapText(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const src = (text || "").trim();
  if (!src) return [];
  const noStart = "，。、；：！？）】》」』…·%,.;:!?)]}>";
  const lines: string[] = [];
  let line = "";
  for (const ch of src) {
    if (ch === "\n") {
      if (line) lines.push(line);
      line = "";
      continue;
    }
    if (g.measureText(line + ch).width > maxWidth && line) {
      if (noStart.includes(ch)) {
        line += ch;
        lines.push(line);
        line = "";
        continue;
      }
      lines.push(line);
      line = ch;
      continue;
    }
    line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

/** 动态字号：自 size 递减到 minSize，使单行宽度不超过 maxWidth */
export function fitFontSize(
  g: CanvasRenderingContext2D,
  text: string,
  fontOf: (px: number) => string,
  size: number,
  maxWidth: number,
  minSize = 16,
): number {
  let s = size;
  g.font = fontOf(s);
  while (s > minSize && g.measureText(text).width > maxWidth) {
    s -= 1;
    g.font = fontOf(s);
  }
  return s;
}

/**
 * 居中逐字绘制，名字用字朱红高亮；每个高亮字只标首次出现，
 * 避免「重复字全红」与「非名字用字被标红」。返回整行宽度。
 */
export function drawHighlightedChars(
  g: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  hiChars: Set<string>,
  colors: { base?: string; hi?: string } = {},
): number {
  const base = colors.base ?? INK;
  const hi = colors.hi ?? ACCENT;
  const total = g.measureText(text).width;
  let x = centerX - total / 2;
  const prevAlign = g.textAlign;
  const marked = new Set<string>();
  g.textAlign = "left";
  for (const ch of text) {
    const w = g.measureText(ch).width;
    const on = hiChars.has(ch) && !marked.has(ch);
    if (on) marked.add(ch);
    g.fillStyle = on ? hi : base;
    g.fillText(ch, x, y);
    x += w;
  }
  g.textAlign = prevAlign;
  return total;
}

/* ------------------------------ 五行原语 ------------------------------ */

export const ELEMENT_ZH: Record<string, string> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};

/** 与站内 emerald/red/amber/stone/sky 五行色一致 */
export const ELEMENT_HEX: Record<string, string> = {
  WOOD: "#047857",
  FIRE: "#b91c1c",
  EARTH: "#b45309",
  METAL: "#57534e",
  WATER: "#0369a1",
};

/** 八字五行固定展示序：木火土金水 */
export const ELEMENT_ORDER = ["WOOD", "FIRE", "EARTH", "METAL", "WATER"] as const;

const ZH2ELEMENT: Record<string, string> = {
  木: "WOOD",
  火: "FIRE",
  土: "EARTH",
  金: "METAL",
  水: "WATER",
};
const EN2ELEMENT: Record<string, string> = {
  wood: "WOOD",
  fire: "FIRE",
  earth: "EARTH",
  metal: "METAL",
  water: "WATER",
};
const EL_UNKNOWN = "rgba(43,36,23,.32)";

/** 五行中文名（未识别返回空串） */
export function elementZh(el?: string | null): string {
  const e = normElement(el);
  return (e && ELEMENT_ZH[e]) || "";
}

/** 五行色（未识别返回中性灰） */
export function elementHex(el?: string | null): string {
  const e = normElement(el);
  return (e && ELEMENT_HEX[e]) || EL_UNKNOWN;
}

/** 五行归一（多个）：'Water / Wood' → [WATER, WOOD]，按串中出现顺序，去重 */
export function normElements(v?: string | null): string[] {
  const s = (v ?? "").trim();
  if (!s) return [];
  const out: string[] = [];
  if (s.length > 2) {
    for (const ch of s) {
      const zh = ZH2ELEMENT[ch];
      if (zh && !out.includes(zh)) out.push(zh);
    }
    if (!out.length) {
      const low = s.toLowerCase();
      const hits: { i: number; el: string }[] = [];
      for (const k of Object.keys(EN2ELEMENT)) {
        const i = low.indexOf(k);
        const el = EN2ELEMENT[k];
        if (i >= 0 && el) hits.push({ i, el });
      }
      hits.sort((a, b) => a.i - b.i).forEach((h) => {
        if (!out.includes(h.el)) out.push(h.el);
      });
    }
  }
  if (!out.length) {
    const one = normElement(s);
    if (one) out.push(one);
  }
  return out;
}

/** 五行归一：接受 WOOD/wood/Wood/木 等写法；未知返回 "" */
export function normElement(v?: string | null): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (ELEMENT_ZH[s.toUpperCase()]) return s.toUpperCase();
  if (ZH2ELEMENT[s]) return ZH2ELEMENT[s];
  const en = EN2ELEMENT[s.toLowerCase()];
  if (en) return en;
  // 「Geng Metal (庚金)」「Water / Wood」这类混合串：取串里出现的五行
  for (const ch of s) {
    const zh = ZH2ELEMENT[ch];
    if (zh) return zh;
  }
  const low = s.toLowerCase();
  for (const k of Object.keys(EN2ELEMENT)) {
    const en2 = EN2ELEMENT[k];
    if (en2 && low.includes(k)) return en2;
  }
  return "";
}

export const STEM_ELEMENT: Record<string, string> = {
  甲: "WOOD",
  乙: "WOOD",
  丙: "FIRE",
  丁: "FIRE",
  戊: "EARTH",
  己: "EARTH",
  庚: "METAL",
  辛: "METAL",
  壬: "WATER",
  癸: "WATER",
};

export const BRANCH_ELEMENT: Record<string, string> = {
  子: "WATER",
  丑: "EARTH",
  寅: "WOOD",
  卯: "WOOD",
  辰: "EARTH",
  巳: "FIRE",
  午: "FIRE",
  未: "EARTH",
  申: "METAL",
  酉: "METAL",
  戌: "EARTH",
  亥: "WATER",
};

/** 四柱干支 → 五行计数（8 个字，按木火土金水固定序返回） */
export function wuxingCounts(pillars: string[]): { el: string; count: number }[] {
  const tally: Record<string, number> = {};
  for (const p of pillars ?? []) {
    const stem = STEM_ELEMENT[p.slice(0, 1)];
    const branch = BRANCH_ELEMENT[p.slice(1, 2)];
    if (stem) tally[stem] = (tally[stem] ?? 0) + 1;
    if (branch) tally[branch] = (tally[branch] ?? 0) + 1;
  }
  if (!Object.keys(tally).length) return [];
  return ELEMENT_ORDER.map((el) => ({ el, count: tally[el] ?? 0 }));
}

const GENERATES: Record<string, string> = {
  WOOD: "FIRE",
  FIRE: "EARTH",
  EARTH: "METAL",
  METAL: "WATER",
  WATER: "WOOD",
};
const OVERCOMES: Record<string, string> = {
  WOOD: "EARTH",
  EARTH: "WATER",
  WATER: "FIRE",
  FIRE: "METAL",
  METAL: "WOOD",
};

/** 五行关系（a 对 b）：a 生 b ＝ a 助 b；a 克 b ＝ 需调和 */
export function elementRelation(
  a?: string,
  b?: string,
): { label: string; tone: "good" | "flat" | "warn" } {
  const ea = normElement(a);
  const eb = normElement(b);
  if (!ea || !eb) return { label: "", tone: "flat" };
  if (ea === eb) return { label: `${elementZh(ea)}${elementZh(eb)}比和`, tone: "flat" };
  if (GENERATES[ea] === eb)
    return { label: `${elementZh(ea)}生${elementZh(eb)}相生`, tone: "good" };
  if (GENERATES[eb] === ea)
    return { label: `${elementZh(eb)}生${elementZh(ea)}相生`, tone: "good" };
  if (OVERCOMES[ea] === eb)
    return { label: `${elementZh(ea)}克${elementZh(eb)}需调和`, tone: "warn" };
  if (OVERCOMES[eb] === ea)
    return { label: `${elementZh(eb)}克${elementZh(ea)}需调和`, tone: "warn" };
  return { label: "", tone: "flat" };
}

/**
 * 日主归一：'Ding-Fire' / 'Geng Metal (庚金)' / '丁火' / 'FIRE' → { stem, element, zh }
 * zh 形如「丁火」，缺天干时退化为「火」。
 */
/** 引擎英文天干（Ding-Fire）→ 中文天干，用于日主显示成「丁火」而非「火」 */
const PINYIN_STEM: Record<string, string> = {
  jia: "甲", yi: "乙", bing: "丙", ding: "丁", wu: "戊",
  ji: "己", geng: "庚", xin: "辛", ren: "壬", gui: "癸",
};

export function dayMasterInfo(dm?: string | null): { stem: string; element: string; zh: string } {
  const s = (dm ?? "").trim();
  if (!s) return { stem: "", element: "", zh: "" };
  let stem = [...s].find((ch) => STEM_ELEMENT[ch]) ?? "";
  if (!stem) {
    const head = s.split(/[^A-Za-z]/).filter(Boolean)[0]?.toLowerCase() ?? "";
    stem = PINYIN_STEM[head] ?? "";
  }
  const element = (stem ? STEM_ELEMENT[stem] : normElement(s)) ?? "";
  const zh = `${stem}${elementZh(element)}` || s;
  return { stem, element, zh };
}

export function drawElementDot(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  el?: string,
  r = 5,
): void {
  g.save();
  g.fillStyle = elementHex(el);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * 五行字块：圆角底 + 白字，count 传入时字后带计数（如「木2」）。
 * 返回占用宽度，便于横向排布。
 */
export function drawElementChip(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  el: string,
  opts: { size?: number; count?: number } = {},
): number {
  const e = normElement(el);
  const size = opts.size ?? 22;
  const label = `${e ? elementZh(e) : "—"}${typeof opts.count === "number" ? opts.count : ""}`;
  g.save();
  g.font = `${Math.round(size * 0.66)}px ${FONT_SANS}`;
  const textW = g.measureText(label).width;
  const w = Math.max(size, textW + size * 0.5);
  g.fillStyle = elementHex(el);
  g.beginPath();
  g.roundRect(x, y - size / 2, w, size, size * 0.28);
  g.fill();
  g.fillStyle = PAPER;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, x + w / 2, y + 1);
  g.restore();
  return w;
}

/* ------------------------------ 五行卡片 ------------------------------ */

/** 行内分段：dot=文字前的五行色点；el=按五行色绘制的字；soft=次要小字 */
export type WuxingSeg = { text: string; el?: string; dot?: boolean; soft?: boolean };

export type WuxingRow =
  | { label: string; segs: WuxingSeg[] }
  | { label: string; chips: { zh: string; el?: string; count?: number }[] }
  | { note: string };

function segRowWidth(g: CanvasRenderingContext2D, segs: WuxingSeg[], size: number): number {
  let w = 0;
  for (const s of segs) {
    if (s.dot) w += Math.max(12, size * 0.72);
    if (!s.text) continue;
    g.font = s.el ? `${size}px ${FONT_KAI}` : `${Math.max(13, size - 4)}px ${FONT_SANS}`;
    w += g.measureText(s.text).width;
  }
  return w;
}

function drawSegRow(
  g: CanvasRenderingContext2D,
  segs: WuxingSeg[],
  x: number,
  y: number,
  size: number,
): void {
  let cx = x;
  g.textAlign = "left";
  for (const s of segs) {
    if (s.dot) {
      drawElementDot(
        g,
        cx + size * 0.24,
        y - size * 0.32,
        s.el ?? s.text,
        Math.max(4, size * 0.22),
      );
      cx += Math.max(12, size * 0.72);
    }
    if (!s.text) continue;
    const el = s.el ? normElement(s.el) : "";
    g.font = el ? `${size}px ${FONT_KAI}` : `${Math.max(13, size - 4)}px ${FONT_SANS}`;
    g.fillStyle = el ? elementHex(el) : s.soft ? INK_SOFT : INK;
    g.fillText(s.text, cx, y);
    cx += g.measureText(s.text).width;
  }
}

/**
 * 五行卡片：圆角纸底 + 朱红标题 + 行（分段文本 / 五行色块 / 通栏说明）。
 * 分段行随可用宽度缩字号（19→13）不截断；说明行整宽折行。返回卡片高度。
 */
export function drawWuxingPanel(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  rows: WuxingRow[],
  opts: { title?: string | null; noteLines?: number } = {},
): number {
  const pad = 26;
  const title = opts.title === undefined ? "五 行" : opts.title;
  const labelW = rows.some((r) => !("note" in r)) ? 78 : 0;
  const contentX = x + pad + labelW;
  const contentW = w - pad * 2 - labelW;
  const maxNoteLines = opts.noteLines ?? 3;
  const heightOf = (r: WuxingRow): number => {
    if ("note" in r) {
      g.font = `15px ${FONT_SANS}`;
      return Math.max(1, Math.min(maxNoteLines, wrapText(g, r.note, w - pad * 2).length)) * 22 + 6;
    }
    return "chips" in r ? 34 : 30;
  };
  const heights = rows.map(heightOf);
  const titleH = title ? 30 : 0;
  const h = 20 + titleH + heights.reduce((a, b) => a + b, 0) + 18;
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 14);
  g.fillStyle = PAPER_2;
  g.fill();
  g.strokeStyle = "rgba(43,36,23,.14)";
  g.lineWidth = 1;
  g.stroke();
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  let cy = y + 20;
  if (title) {
    g.fillStyle = ACCENT;
    g.font = `bold 15px ${FONT_SANS}`;
    g.fillText(title, x + pad, cy + 15);
    g.strokeStyle = ACCENT_LINE;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + pad + 52, cy + 11);
    g.lineTo(x + pad + 82, cy + 11);
    g.stroke();
    cy += titleH;
  }
  rows.forEach((r, i) => {
    const rowH = heights[i] ?? 30;
    if ("note" in r) {
      g.fillStyle = INK_SOFT;
      g.font = `15px ${FONT_SANS}`;
      g.textAlign = "left";
      wrapText(g, r.note, w - pad * 2)
        .slice(0, maxNoteLines)
        .forEach((line, li) => g.fillText(line, x + pad, cy + 15 + li * 22));
    } else {
      g.fillStyle = INK_FAINT;
      g.font = `14px ${FONT_SANS}`;
      g.textAlign = "left";
      g.fillText(r.label, x + pad, cy + 19);
      if ("chips" in r) {
        let cx = contentX;
        const mid = cy + rowH / 2 - 1;
        for (const c of r.chips) {
          const chipOpts =
            typeof c.count === "number" ? { size: 22, count: c.count } : { size: 22 };
          cx += drawElementChip(g, cx, mid, c.zh, chipOpts) + 8;
        }
      } else {
        let size = 19;
        while (size > 13 && segRowWidth(g, r.segs, size) > contentW) size -= 1;
        drawSegRow(g, r.segs, contentX, cy + 21, size);
      }
    }
    cy += rowH;
  });
  g.restore();
  return h;
}

/** 合婚类海报的五行块数据（双方日主 + 五行契合 + 一句结论） */
export type WuxingFit = {
  dayMasterA: string;
  dayMasterB: string;
  score: number | null;
  relation: string;
  note: string;
};

/** 合婚预览结果 → 五行块数据（`persons[].dayMaster` + `items[key=wuxing]`）；无日主返回 null */
export function wuxingFitFrom(
  persons?: ({ dayMaster?: string | null } | undefined)[] | null,
  items?: ({ key?: string; score?: number; positives?: string[]; concerns?: string[] } | undefined)[] | null,
): WuxingFit | null {
  const dmA = persons?.[0]?.dayMaster ?? "";
  const dmB = persons?.[1]?.dayMaster ?? "";
  const elA = dayMasterInfo(dmA).element;
  const elB = dayMasterInfo(dmB).element;
  if (!elA && !elB) return null;
  const wu = (items ?? []).find((i) => i?.key === "wuxing");
  const score = typeof wu?.score === "number" ? wu.score : null;
  // 引擎在缺数据时会把 (null) 写进结论句（如「男方喜用（null）恰为对方旺势」），优先挑干净的
  const pick = (arr?: string[]): string =>
    (arr ?? []).find((t) => t && !/null/i.test(t)) ?? arr?.[0] ?? "";
  const pos = pick(wu?.positives);
  const con = pick(wu?.concerns);
  return {
    dayMasterA: dmA || elementZh(elA),
    dayMasterB: dmB || elementZh(elB),
    score,
    relation: elementRelation(elA, elB).label,
    note: (score != null && score < 60 ? con : pos) || con || pos,
  };
}

/** 五行块的合婚行：双方日主 / 五行契合分 / 结论句；无数据返回空数组 */
export function wuxingFitRows(
  fit: WuxingFit | null,
  opts: { scoreLabel?: string } = {},
): WuxingRow[] {
  if (!fit) return [];
  const rows: WuxingRow[] = [];
  const dmA = dayMasterInfo(fit.dayMasterA);
  const dmB = dayMasterInfo(fit.dayMasterB);
  const segs: WuxingSeg[] = [
    { text: dmA.zh || "—", el: dmA.element, dot: true },
    { text: "  ×  ", soft: true },
    { text: dmB.zh || "—", el: dmB.element, dot: true },
  ];
  if (fit.relation) segs.push({ text: "　　" + fit.relation, soft: true });
  rows.push({ label: "双方日主", segs });
  if (fit.score != null) {
    rows.push({
      label: "五行契合",
      segs: [
        { text: String(fit.score) },
        { text: ` 分${opts.scoreLabel ? ` · ${opts.scoreLabel}` : ""}`, soft: true },
      ],
    });
  }
  if (fit.note) rows.push({ note: fit.note });
  return rows;
}

/* ------------------------------ 页面骨架 ------------------------------ */
/** 页头：品牌印章 + 品牌名（左）、副题（右）、朱红分隔线 */
export async function drawPosterHeader(
  g: CanvasRenderingContext2D,
  w: number,
  rightText: string,
): Promise<void> {
  await drawBrandSeal(g, 48, 36, 42);
  g.save();
  g.textAlign = "left";
  g.fillStyle = INK_SOFT;
  g.font = `18px ${FONT_SANS}`;
  g.fillText("对 脉 名 鉴", 100, 64);
  g.textAlign = "right";
  g.fillStyle = ACCENT;
  g.font = `16px ${FONT_SANS}`;
  g.fillText(rightText, w - 48, 64);
  g.strokeStyle = ACCENT_LINE;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(48, 88);
  g.lineTo(w - 48, 88);
  g.stroke();
  g.restore();
}

/** 页脚：朱红分隔线 + 二维码 + 三行引导；二维码失败退化为网址文字 */
export async function drawPosterFooter(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { qrPath: string; brand: string; hint: string; note: string },
): Promise<void> {
  const size = 150;
  let qrOk = false;
  try {
    const target = await posterQrTarget(opts.qrPath, { from: "poster" });
    const url = await QRCode.toDataURL(target, {
      margin: 1,
      width: 512,
      color: { dark: INK, light: PAPER },
    });
    const img = await loadImage(url);
    if (img) {
      g.drawImage(img, w - 48 - size, h - 48 - size - 14, size, size);
      qrOk = true;
    }
  } catch {
    /* 二维码失败不阻断海报 */
  }
  g.save();
  g.strokeStyle = "rgba(43,36,23,.08)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(48, h - 168);
  g.lineTo(w - 48, h - 168);
  g.stroke();
  g.textAlign = "left";
  g.fillStyle = "rgba(43,36,23,.8)";
  g.font = `bold 22px ${FONT_SANS}`;
  g.fillText(opts.brand, 48, h - 132);
  g.fillStyle = "rgba(43,36,23,.55)";
  g.font = `17px ${FONT_SANS}`;
  g.fillText(qrOk ? opts.hint : `name.duimai.net${opts.qrPath}`, 48, h - 102);
  g.fillStyle = "rgba(43,36,23,.4)";
  g.font = `15px ${FONT_SANS}`;
  g.fillText(opts.note, 48, h - 72);
  g.restore();
}

/** 双规格导出：PNG 供下载（无损），JPEG 供分享（0.92，微信体积友好） */
export function exportPoster(cv: HTMLCanvasElement): { png: string; jpg: string } {
  return {
    png: cv.toDataURL("image/png"),
    jpg: cv.toDataURL("image/jpeg", 0.92),
  };
}
