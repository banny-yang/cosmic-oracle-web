import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { posterQrTarget } from "@/lib/promo-config";
import { CATEGORY_LABELS, categoryToExpectation } from "@/lib/gallery-signals";
import {
  fetchClassicBookTree,
  selectableBooksByCategory,
  type ClassicBookNode,
  type ClassicBookTree,
} from "@/lib/classic-books";
import { BirthplaceInput } from "@/components/birthplace-input";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { track } from "@/lib/track";
import { post, get } from "@/lib/api";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { ScanBuyPanel } from "@/components/scan-buy";
import { getToken, getAuthUser } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { setupWxShare } from "@/lib/wx-share";
import QRCode from "qrcode";
import {
  Baby,
  Users,
  Volume2,
  Image as ImageIcon,
  Heart,
  X,
  TriangleAlert,
  Scale,
  PenLine,
  Clock3,
  ShieldCheck,
  LocateFixed,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/naming")({
  component: Naming,
  // 环 1：灵感库卡片 CTA 带入风格信号——prefer=偏好字（仅汉字≤4）、src=典籍类目码、
  // g=性别（M/F）、cat=气质分类（映射家长期望预选）；book=《典籍馆》指定书目（按书名取典）
  validateSearch: (search: Record<string, unknown>) => ({
    prefer:
      typeof search["prefer"] === "string"
        ? search["prefer"].replace(/[^\u4e00-\u9fa5]/g, "").slice(0, 4)
        : undefined,
    src:
      typeof search["src"] === "string" && CATEGORY_LABELS[search["src"]]
        ? search["src"]
        : undefined,
    g: search["g"] === "M" || search["g"] === "F" ? search["g"] : undefined,
    cat:
      typeof search["cat"] === "string" && categoryToExpectation(search["cat"])
        ? search["cat"]
        : undefined,
    book:
      typeof search["book"] === "string"
        ? search["book"].replace(/[《》\s]/g, "").slice(0, 12)
        : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/naming" }],
    meta: [
      { title: "宝宝起名 · 对脉名鉴" },
      {
        name: "keywords",
        content: "宝宝起名,生辰起名,诗经楚辞起名,五格数理,起名推荐指数,亲友投票起名",
      },
      {
        name: "description",
        content:
          "按生辰喜用与五格数理，从典籍中为宝宝取一个有出处、有数理、有温度的名字；支持五维雷达、方言谐音检测与亲友投票。",
      },
      { property: "og:url", content: "https://name.duimai.net/naming" },
      { property: "og:title", content: "宝宝起名 · 对脉名鉴" },
      {
        property: "og:description",
        content: "一次生成 10 个有推荐指数与典籍出处的名字方案，支持亲友投票一起定。",
      },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  }),
});

/* ───────── 类型（与后端契约一致） ───────── */

interface NameCardData {
  name: string;
  pinyin: string;
  tones?: number[];
  charElements?: string[];
  classicCitation?: string;
  classicSource?: string;
  wuxingAnalysis?: string;
  homophoneSafe?: boolean;
  safetyNote?: string;
  nameLength?: string;
  tianGe?: number;
  renGe?: number;
  diGe?: number;
  waiGe?: number;
  zongGe?: number;
  sanCai?: string;
  recommendScore?: number;
  recommended?: boolean;
  recommendReason?: string;
  dimensionScores?: Record<string, number>;
  fusionNote?: string;
  wugeWarning?: string;
  dialectChecks?: { dialect: string; status: string; note?: string }[];
  dialectCheckPassed?: boolean;
  phoneticNotes?: string[];
  classicVerified?: boolean;
  /** 姓名语法连读（自然具象姓+动宾名，如 叶知秋）——后端 V155 下发。 */
  syntaxReading?: boolean;
  classicMeaning?: string;
  charCitations?: { char: string; citation: string; source: string }[];
  sameClassicSource?: boolean;
  originalCouplet?: boolean;
  /** 名字命中名字灵感库（后端 goodNameHit）：徽标链回 /names。 */
  goodNameHit?: boolean;
}

/** 起名畅享权益状态（GET /api/v1/naming/pass/status）。 */
type PassStatus = {
  active?: boolean;
  passType?: string;
  expiresAtEpochMs?: number;
  dayPriceFen?: number;
  monthPriceFen?: number;
  dayPricePoints?: number;
  monthPricePoints?: number;
  batchLockEnabled?: boolean;
};

const DIM_LABELS: [string, string][] = [
  ["bazi", "八字喜用"],
  ["wuge", "五格数理"],
  ["phonetics", "音律韵味"],
  ["culture", "文化底蕴"],
  ["zodiac", "生肖契合"],
];

/** 声调→平仄（1/2 阴平阳平为平，3/4 上声去声为仄）。 */
function pingzeOf(tones?: number[]): string {
  return (tones || []).map((t) => (t === 1 || t === 2 ? "平" : "仄")).join("");
}

/** 三型典源启发式：名字两字在引文中相邻=典故原词 / 同句=同句取字 / 分居句读两侧=上下句取字；无法判定返回 null。 */
function citationFormOf(citation: string, chars: string[]): "word" | "line" | "couplet" | null {
  const [c1, c2] = chars;
  if (!citation || !c1 || !c2) return null;
  const i1 = citation.indexOf(c1);
  const i2 = citation.indexOf(c2);
  if (i1 < 0 || i2 < 0 || i1 === i2) return null;
  if (Math.abs(i1 - i2) === 1) return "word";
  const samePart = citation
    .split(/[，。！？；、]/)
    .some((seg) => seg.includes(c1) && seg.includes(c2));
  return samePart ? "line" : "couplet";
}

const FORM_BADGE: Record<"word" | "line" | "couplet", { text: string; hint: string }> = {
  word: { text: "典故原词 · 连续成词", hint: "名字两字为典籍原文中的连续词（如 望舒）" },
  line: { text: "同句取字 · 一句成典", hint: "一字上半句、一字下半句，同出一句原文" },
  couplet: { text: "上下句取字 · 集联成典", hint: "一字取上句、一字取下句，同出一联" },
};

/** 出处上下文（GET /api/v1/naming/citation-context）：同书同篇 seq±2 原句窗口。 */
type CitationContext = {
  book?: string;
  chapter?: string;
  sentences?: { seq: number; text: string; hit?: boolean }[];
};

/** 典故引文中高亮名字用字（PRD 出处展示规范：整联一次展示 + 选中字高亮）。 */
function highlightNameChars(text: string, chars: string[]) {
  const set = new Set(chars.filter((c) => c && c.length === 1));
  return Array.from(text).map((ch, i) =>
    set.has(ch) ? (
      <span key={i} className="font-bold text-vermilion-deep">
        {ch}
      </span>
    ) : (
      <span key={i}>{ch}</span>
    ),
  );
}

/** 五维雷达（纯 SVG 五边形，无依赖）。 */
function DimRadar({ scores, size = 150 }: { scores: Record<string, number>; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = DIM_LABELS.length;
  const pt = (i: number, ratio: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio];
  };
  // 顶点角度按五边形分布：0 顶、1 右、2 右下、3 左下、4 左 → 锚点向内收，防止文本越界
  const ANCHOR = ["middle", "start", "start", "end", "end"] as const;
  const ring = (ratio: number) => DIM_LABELS.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const val = (i: number) => Math.min(100, Math.max(0, scores[DIM_LABELS[i][0]] ?? 60)) / 100;
  const area = DIM_LABELS.map((d, i) => pt(i, val(i)).join(",")).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-14 -8 ${size + 28} ${size + 16}`}
      className="mx-auto"
    >
      {[0.33, 0.66, 1].map((k) => (
        <polygon
          key={k}
          points={ring(k)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={0.8}
        />
      ))}
      {DIM_LABELS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={0.8}
          />
        );
      })}
      <polygon
        points={area}
        fill="currentColor"
        fillOpacity={0.16}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      {DIM_LABELS.map((d, i) => {
        const [x, y] = pt(i, 1.3);
        return (
          <text
            key={d[0]}
            x={x}
            y={y}
            textAnchor={ANCHOR[i]}
            dominantBaseline="middle"
            fontSize={size / 15}
            fill="currentColor"
            fillOpacity={0.65}
          >
            {d[1]}
          </text>
        );
      })}
    </svg>
  );
}

interface Diagnosis {
  dayMasterElement?: string;
  strength?: string;
  primaryElement?: string;
  secondaryElement?: string;
  reason?: string;
  aiGenerated?: boolean;
  cards?: NameCardData[];
  criticalBoundary?: { type?: string; near?: string; minutes?: number; note?: string } | null;
  avoidSummary?: string | null;
  freeTrial?: boolean;
  lockedCount?: number;
  climateElement?: string;
  unlockTip?: string;
  pillars?: string[];
  poolSize?: number;
  wuxingMatch?: boolean;
}

/** 维度白话解释（hover title）。 */
const DIM_TIP: Record<string, string> = {
  bazi: "用字五行命中喜用主辅与调候的程度（主 100/调候 85/辅 72）",
  wuge: "康熙笔画五格数理与三才配置（喜用 60% / 数理 40% 融通权重中的数理侧）",
  phonetics: "平仄交替、声母韵母避重与末字响亮度",
  culture: "典籍出处是否通过「引文含名字用字」校验",
  zodiac: "出生年生肖与用字部首的喜忌契合",
};

/** 多名叠加雷达（对比视图）。 */
function MultiRadar({
  items,
  size = 190,
}: {
  items: { name: string; scores: Record<string, number>; color: string }[];
  size?: number;
}) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 30,
    n = DIM_LABELS.length;
  const pt = (i: number, k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  };
  const ANCHOR = ["middle", "start", "start", "end", "end"] as const;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-14 -8 ${size + 28} ${size + 16}`}
      className="mx-auto"
    >
      {[0.33, 0.66, 1].map((k) => (
        <polygon
          key={k}
          points={DIM_LABELS.map((_, i) => pt(i, k).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.8}
        />
      ))}
      {DIM_LABELS.map((d, i) => {
        const [x, y] = pt(i, 1.28);
        return (
          <text
            key={d[0]}
            x={x}
            y={y}
            textAnchor={ANCHOR[i]}
            dominantBaseline="middle"
            fontSize={size / 16}
            fill="currentColor"
            fillOpacity={0.6}
          >
            {d[1]}
          </text>
        );
      })}
      {items.map((it) => (
        <polygon
          key={it.name}
          points={DIM_LABELS.map((d, i) =>
            pt(i, Math.min(100, it.scores[d[0]] ?? 60) / 100).join(","),
          ).join(" ")}
          fill={it.color}
          fillOpacity={0.12}
          stroke={it.color}
          strokeWidth={1.6}
        />
      ))}
    </svg>
  );
}

/** 读音试听（浏览器 TTS，连读两遍）。 */
function speakName(fullName: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    for (let i = 0; i < 2; i++) {
      const u = new SpeechSynthesisUtterance(fullName);
      u.lang = "zh-CN";
      u.rate = 0.85;
      setTimeout(() => synth.speak(u), i * 1400);
    }
  } catch {
    /* 无 TTS 则静默 */
  }
}

/** 古风海报（canvas → PNG dataURL，含 Web 推广二维码）。 */
async function buildPoster(c: NameCardData, infoLine: string, diagLine: string): Promise<string> {
  const W = 720,
    H = 1120;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas unavailable");
  g.fillStyle = "#F6EFE3";
  g.fillRect(0, 0, W, H);
  const ink = "#2B2417",
    accent = "#9E2B25";
  g.fillStyle = "rgba(43,36,23,.55)";
  g.font = "18px sans-serif";
  g.textAlign = "left";
  g.fillText("对 脉 名 鉴", 48, 64);
  g.textAlign = "right";
  g.fillStyle = accent;
  g.font = "16px sans-serif";
  g.fillText("五维融通 · 起名鉴赏", W - 48, 64);
  g.textAlign = "center";
  g.fillStyle = ink;
  g.font = `bold ${c.name.length > 3 ? 108 : 132}px "STKaiti","KaiTi",serif`;
  g.fillText(c.name, W / 2, 250);
  g.fillStyle = "rgba(43,36,23,.6)";
  g.font = "24px sans-serif";
  g.fillText([c.pinyin].filter(Boolean).join(" · "), W / 2, 306);
  const cites = (
    c.charCitations?.length
      ? c.charCitations.map((cc) => ({ tag: cc.char, text: cc.citation, src: cc.source }))
      : c.classicCitation
        ? [
            {
              tag: "",
              text: c.classicCitation,
              src: [c.classicSource, c.classicMeaning ? `「${c.classicMeaning}」` : ""]
                .filter(Boolean)
                .join("  "),
            },
          ]
        : []
  ) as { tag: string; text: string; src: string }[];
  // 整联引文（含逗号）双句分行渲染：抽出的诗句绘制器对两条路径共用
  const drawVerseShared = (text: string, y: number, hiChars: Set<string>) => {
    let size = 30;
    g.font = `bold ${size}px serif`;
    while (size > 18 && g.measureText(text).width > W - 160) {
      size -= 1;
      g.font = `bold ${size}px serif`;
    }
    let x = (W - g.measureText(text).width) / 2;
    g.textAlign = "left";
    for (const ch of text) {
      const w = g.measureText(ch).width;
      g.fillStyle = hiChars.has(ch) ? accent : ink;
      g.fillText(ch, x, y);
      x += w;
    }
    g.textAlign = "center";
  };
  const [c0] = cites;
  const singleCouplet = c0 ? c0.text.split("，") : [];
  if (
    c0 &&
    cites.length === 1 &&
    singleCouplet.length === 2 &&
    singleCouplet[0] &&
    singleCouplet[1]
  ) {
    // 整联（V155 couplet/line 整联引文）：徽标 + 上下句两行 + 出处，避免 26 字截断
    g.strokeStyle = "rgba(158,43,37,.3)";
    g.strokeRect(60, 360, W - 120, 148);
    g.fillStyle = accent;
    g.font = "18px sans-serif";
    g.fillText("✦ 典籍原文 · 一联成典", W / 2, 392);
    const hi = new Set(c.name.slice(1).split(""));
    drawVerseShared(singleCouplet[0], 436, hi);
    drawVerseShared(singleCouplet[1], 480, hi);
    g.fillStyle = accent;
    g.font = "19px sans-serif";
    const s0 = c0.src.length > 30 ? c0.src.slice(0, 30) + "…" : c0.src;
    g.fillText(s0, W / 2, 508);
  } else if (c0 && cites.length === 1) {
    g.strokeStyle = "rgba(158,43,37,.3)";
    g.strokeRect(60, 360, W - 120, 128);
    g.fillStyle = ink;
    g.font = "26px serif";
    const cite = c0.text.length > 26 ? c0.text.slice(0, 26) + "…" : c0.text;
    g.fillText(cite, W / 2, 412);
    g.fillStyle = accent;
    g.font = "20px sans-serif";
    g.fillText(c0.src, W / 2, 456);
  } else if (cites.length >= 2) {
    // 藏名联/同出联：徽标 + 放大居中两行诗句（名字用字朱红高亮，超宽自适应缩字号）+ 出处
    g.strokeStyle = "rgba(158,43,37,.3)";
    g.strokeRect(60, 340, W - 120, 176);
    g.textAlign = "center";
    g.fillStyle = c.originalCouplet ? "rgba(43,36,23,.55)" : accent;
    g.font = "18px sans-serif";
    g.fillText(c.originalCouplet ? "✒ 原创藏名联" : "✦ 同出一联 · 字字有典", W / 2, 372);
    const hiChars = new Set(cites.map((x) => x.tag).filter(Boolean));
    const drawVerse = (text: string, y: number) => {
      let size = 32;
      g.font = `bold ${size}px serif`;
      while (size > 20 && g.measureText(text).width > W - 160) {
        size -= 1;
        g.font = `bold ${size}px serif`;
      }
      let x = (W - g.measureText(text).width) / 2;
      g.textAlign = "left";
      for (const ch of text) {
        const w = g.measureText(ch).width;
        g.fillStyle = hiChars.has(ch) ? accent : ink;
        g.fillText(ch, x, y);
        x += w;
      }
      g.textAlign = "center";
    };
    // 两字同出一句（引文与出处均相同）只画该句一次并垂直居中；同联上下句文本不同，照旧两行
    const sameSentence = cites[0].text === cites[1].text && cites[0].src === cites[1].src;
    drawVerse(cites[0].text, sameSentence ? 455 : 428);
    if (!sameSentence) drawVerse(cites[1].text, 482);
    g.fillStyle = "rgba(158,43,37,.9)";
    g.font = "19px sans-serif";
    const srcText =
      cites[0].src === cites[1].src ? cites[0].src : `${cites[0].src} ／ ${cites[1].src}`; // 历史回放的分典兜底：两出处并列
    const src = srcText.length > 30 ? srcText.slice(0, 30) + "…" : srcText;
    g.fillText(src, W / 2, 512);
  }
  g.fillStyle = "rgba(43,36,23,.75)";
  g.font = "22px sans-serif";
  g.fillText(infoLine, W / 2, 548);
  g.fillText(diagLine, W / 2, 586);
  // 五维雷达
  const cx = W / 2,
    cy = 750,
    r = 120,
    n = 5;
  const pt = (i: number, k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  };
  g.strokeStyle = "rgba(43,36,23,.2)";
  [0.4, 0.7, 1].forEach((k) => {
    g.beginPath();
    DIM_LABELS.forEach((_, i) => {
      const [x, y] = pt(i, k);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
  });
  g.fillStyle = accent;
  g.beginPath();
  DIM_LABELS.forEach((d, i) => {
    const [x, y] = pt(i, Math.min(100, c.dimensionScores?.[d[0]] ?? 60) / 100);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.closePath();
  g.globalAlpha = 0.85;
  g.fill();
  g.globalAlpha = 1;
  g.stroke();
  g.fillStyle = "rgba(43,36,23,.6)";
  g.font = "17px sans-serif";
  DIM_LABELS.forEach((d, i) => {
    const [x, y] = pt(i, 1.24);
    g.fillText(d[1], x, y);
  });
  // 底部：Web 推广二维码 + 引导
  let qrOk = false;
  try {
    const qrUrl = await QRCode.toDataURL(await posterQrTarget("/naming"), {
      margin: 1,
      width: 320,
      color: { dark: "#2B2417", light: "#F6EFE3" },
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = qrUrl;
    });
    const qrSize = 150;
    g.drawImage(img, W - 48 - qrSize, H - 48 - qrSize - 14, qrSize, qrSize);
    qrOk = true;
  } catch {
    /* 二维码生成失败不阻断海报 */
  }
  g.textAlign = "left";
  g.fillStyle = "rgba(43,36,23,.8)";
  g.font = "bold 22px sans-serif";
  g.fillText("对脉名鉴 · 宝宝起名", 48, H - 132);
  g.fillStyle = "rgba(43,36,23,.55)";
  g.font = "17px sans-serif";
  g.fillText(qrOk ? "扫码打开网页版，为宝宝定制好名" : "name.duimai.net/naming", 48, H - 102);
  g.fillStyle = "rgba(43,36,23,.4)";
  g.font = "15px sans-serif";
  g.fillText("五行喜用 · 五格数理 · 音律韵味 · 典籍出处", 48, H - 72);
  return cv.toDataURL("image/png");
}

const STAGES = ["真太阳时校正", "喜用五行判定", "候选字库筛选", "AI 典籍推演", "生成完成"];
const STAGE_INDEX: Record<string, number> = {
  bazi: 0,
  xiyong: 1,
  pool: 2,
  ai: 3,
  ai_think: 3,
  fallback: 3,
  result: 4,
};

const ELEMENT_ZH: Record<string, string> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};
const STRENGTH_ZH: Record<string, string> = { STRONG: "身强", WEAK: "身弱", BALANCED: "中和" };
const ELEMENT_CLS: Record<string, string> = {
  WOOD: "bg-emerald-800/85 text-emerald-50",
  FIRE: "bg-red-800/85 text-red-50",
  EARTH: "bg-amber-800/85 text-amber-50",
  METAL: "bg-stone-600/90 text-stone-50",
  WATER: "bg-sky-800/85 text-sky-50",
};
/** 五行小色点（信息卡四柱/喜用行内标注用）。 */
const ELEMENT_DOT: Record<string, string> = {
  WOOD: "bg-emerald-600",
  FIRE: "bg-red-600",
  EARTH: "bg-amber-600",
  METAL: "bg-stone-500",
  WATER: "bg-sky-600",
};
/** 地支（四柱干支第二字）→ 五行，用于四柱标签色点。 */
const BRANCH_ELEMENT: Record<string, string> = {
  子: "WATER",
  亥: "WATER",
  寅: "WOOD",
  卯: "WOOD",
  巳: "FIRE",
  午: "FIRE",
  丑: "EARTH",
  辰: "EARTH",
  未: "EARTH",
  戌: "EARTH",
  申: "METAL",
  酉: "METAL",
};
/** 出生地短显示：去掉包含其它片段的冗长片段（「广州市 广东省广州市」→「广州市」）。 */
function shortPlace(place: string) {
  const parts = place.split(/[\s,，]+/).filter(Boolean);
  const keep = parts.filter((p) => !parts.some((o) => o !== p && p.includes(o)));
  return (keep.length ? keep : parts).join(" ");
}
/** 非首选卡的名字五行角标降饱和样式（首选卡保留实色，见 ELEMENT_CLS）。 */
const ELEMENT_SOFT: Record<string, string> = {
  WOOD: "bg-emerald-700/8 text-emerald-800 ring-emerald-700/25",
  FIRE: "bg-red-700/8 text-red-800 ring-red-700/25",
  EARTH: "bg-amber-700/10 text-amber-800 ring-amber-700/25",
  METAL: "bg-stone-600/8 text-stone-700 ring-stone-500/30",
  WATER: "bg-sky-700/8 text-sky-800 ring-sky-700/25",
};

/* ───────── 页面 ───────── */

const styleTags = ["典雅古风", "清新自然", "大气开阔", "温润书卷", "坚毅果敢", "诗意悠远"];
const parentExpectTags = [
  "大有可为",
  "健康平安",
  "聪慧睿智",
  "善良仁爱",
  "坚毅勇敢",
  "温文尔雅",
  "乐观开朗",
  "才艺出众",
];
const classicGroups = [
  {
    name: "诗词歌赋",
    items: [
      ["shijing", "诗经"],
      ["chuci", "楚辞"],
      ["tangshi", "唐诗"],
      ["songci", "宋词"],
      ["weijin", "世说文心"],
    ],
  },
  {
    name: "思想哲学",
    items: [
      ["zhouyi", "周易"],
      ["lunyu", "论语"],
      ["rujia", "尚书礼记"],
      ["daojia", "道德庄子"],
    ],
  },
  {
    name: "史书博物",
    items: [
      ["shishi", "史记通鉴"],
      ["bowu", "山海本草"],
    ],
  },
  {
    name: "蒙学启蒙",
    items: [["mengxue", "蒙学"]],
  },
] as const;

function Naming() {
  // 环 1：灵感库跳转带入的四信号（prefer/src/g/cat）
  const preferSearch = Route.useSearch();
  // 表单
  const [surname, setSurname] = useState("");
  // 环 1 预选：灵感库带入的性别（词条 gender）；用户改表单以用户为准
  const [gender, setGender] = useState<"M" | "F">(() =>
    preferSearch["g"] === "M" || preferSearch["g"] === "F" ? preferSearch["g"] : "F",
  );
  // 新生儿场景居多：出生日期与时间默认当前（本地时区）
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  const [birthDate, setBirthDate] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  );
  const [birthTime, setBirthTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  // 出生状态：已出生填出生日期+时间；未出生填预产期（按当日午时 12:00 推演）
  const [born, setBorn] = useState(true);
  const [lat, setLat] = useState(39.9);
  const [lng, setLng] = useState(116.4);
  const [nameLength, setNameLength] = useState<"DOUBLE" | "SINGLE">("DOUBLE");
  // 五行匹配开关：关闭后不按喜用五行筛字库，典籍出处名供给更多
  const [wuxingMatch, setWuxingMatch] = useState(true);
  const [generationChar, setGenerationChar] = useState("");
  // 环 1：灵感库带入的风格信号（偏好字 + 典籍 + 性别 + 期望），全部可在「灵感库带入」面板单独移除
  const [preferChars, setPreferChars] = useState<string[]>(() =>
    (preferSearch["prefer"] ?? "").split("").filter(Boolean).slice(0, 2),
  );
  /** 典籍偏好预选：src 合法时预选该类目并切到对应分组；移除面板 chip 清空 sourcesSel */
  const [preferSrc, setPreferSrc] = useState<string | null>(() =>
    preferSearch["src"] && CATEGORY_LABELS[preferSearch["src"]] ? preferSearch["src"] : null,
  );
  /** 性别预选（仅 M/F；用户改表单性别以用户为准） */
  const [preferGender, setPreferGender] = useState<"M" | "F" | null>(() =>
    preferSearch["g"] === "M" || preferSearch["g"] === "F" ? preferSearch["g"] : null,
  );
  /** 家长期望预选（气质分类映射，≤1 个，与用户手选合并） */
  const [preferExpect, setPreferExpect] = useState<string | null>(() =>
    preferSearch["cat"] ? (categoryToExpectation(preferSearch["cat"]) ?? null) : null,
  );
  const [tabooText, setTabooText] = useState("");
  const [stylesSel, setStylesSel] = useState<string[]>([]);
  // 环 1 预选：灵感库带入的典籍类目直接作为初始 sourcesSel（用户可在表单里改）
  const [sourcesSel, setSourcesSel] = useState<string[]>(() =>
    preferSearch["src"] && CATEGORY_LABELS[preferSearch["src"]] ? [preferSearch["src"]] : [],
  );
  // 书名轴（V171）：书目树来自管理端维护的 t_classic_book，取不到时整块隐藏、退化为类目轴
  const [bookTree, setBookTree] = useState<ClassicBookTree | null>(null);
  const [booksSel, setBooksSel] = useState<string[]>([]);
  /** 《典籍馆》深链带入的书名（可单独移除，与类目偏好互不影响） */
  const [preferBook, setPreferBook] = useState<string | null>(() => preferSearch["book"] ?? null);
  const [classicGroup, setClassicGroup] = useState(() => {
    const src = preferSearch["src"];
    if (!src || !CATEGORY_LABELS[src]) return 0;
    const gi = classicGroups.findIndex((g) => g.items.some(([c2]) => c2 === src));
    return gi >= 0 ? gi : 0;
  });
  const [classicStyle, setClassicStyle] = useState<"大众" | "小众">("大众");
  const [avoidText, setAvoidText] = useState("");
  // 环 1 预选：气质分类映射的期望 tag 并入初始选择（用户可取消）
  const [expectSel, setExpectSel] = useState<string[]>(() => {
    const cat = preferSearch["cat"];
    const tag = cat ? categoryToExpectation(cat) : undefined;
    return tag ? [tag] : [];
  });
  const [formErr, setFormErr] = useState("");

  // P1：高级选项折叠（起名偏好 + 家族避讳），标题徽标显示已选数量
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const advancedCount =
    (generationChar.trim() ? 1 : 0) +
    (tabooText.trim() ? 1 : 0) +
    (avoidText.trim() ? 1 : 0) +
    stylesSel.length +
    sourcesSel.length +
    booksSel.length;

  /** 生效的书目信号：《典籍馆》深链带入的书名被用户摘除（切分组/取消勾选）后不再视为信号 */
  const bookSignal = preferBook && booksSel.includes(preferBook) ? preferBook : null;

  // 书名轴（V171）：挂载时取一次书目树（管理端可维护；取不到则整块隐藏，退化为类目轴）
  useEffect(() => {
    let cancelled = false;
    fetchClassicBookTree().then((t) => {
      if (!cancelled) setBookTree(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 类目编码 → 用户可选书目。 */
  const booksByCat = useMemo(() => selectableBooksByCategory(bookTree), [bookTree]);
  /** 书名 → 类目编码（切换分组/取消类目时清掉不在范围内的选书）。 */
  const catByBook = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of bookTree?.groups ?? []) {
      for (const c of g.categories) {
        for (const b of c.books) m.set(b.book, c.code);
      }
    }
    return m;
  }, [bookTree]);

  /** 类目编码 → 中文名（书目树口径优先，缺时回落前端既有标签）。 */
  const catNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of bookTree?.groups ?? []) {
      for (const c of g.categories) m.set(c.code, c.name);
    }
    return m;
  }, [bookTree]);
  const catName = (code: string) => catNameByCode.get(code) ?? CATEGORY_LABELS[code] ?? code;

  /**
   * 书目行（第二级）：类目被勾选、或该类目下已选书目的类目，展开其可选书目。
   * 行内含「取消类目即收起」的联动——取消类目会同时清掉其下选书（见下方类目 chip）。
   */
  const bookRows = useMemo(() => {
    const rows: { code: string; name: string; books: ClassicBookNode[] }[] = [];
    for (const [code, books] of booksByCat) {
      const active =
        sourcesSel.includes(code) || booksSel.some((b) => catByBook.get(b) === code);
      if (active) rows.push({ code, name: catName(code), books });
    }
    return rows;
  }, [booksByCat, catByBook, sourcesSel, booksSel, catNameByCode]);

  // 《典籍馆》深链：书目树到位后把 ?book= 落到选书——并把该书类目从类目轴摘掉（选书即按书出典）
  useEffect(() => {
    if (!bookTree || !preferBook) return;
    const cat = catByBook.get(preferBook);
    const selectable = cat ? (booksByCat.get(cat) ?? []).some((b) => b.book === preferBook) : false;
    if (!cat || !selectable) {
      // 该书未开放用户选择（管理端 selectable=0）或已下线：忽略深链，不留死状态
      setPreferBook(null);
      return;
    }
    setBooksSel((p) => (p.includes(preferBook) ? p : [...p, preferBook]));
    setSourcesSel((p) => p.filter((c) => c !== cat));
    setClassicGroup((gi) => {
      const idx = classicGroups.findIndex((g) => g.items.some(([c2]) => c2 === cat));
      return idx >= 0 ? idx : gi;
    });
  }, [bookTree, preferBook, catByBook, booksByCat]);

  /** 浏览器定位 → 直接取经纬度（真太阳时校正只需经度，地名仅为展示）。 */
  const locateMe = () => {
    if (!navigator.geolocation) {
      setFormErr("当前浏览器不支持定位，请输入城市名搜索");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setPlaceName("已定位当前位置");
        setLocating(false);
      },
      () => {
        setFormErr("定位失败，请输入城市名搜索");
        setLocating(false);
      },
      { timeout: 8000 },
    );
  };

  /** P2：一键填入演示数据，降低新访客尝试门槛。 */
  const fillDemo = () => {
    setSurname("于");
    setGender("F");
    setBorn(true);
    setBirthDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setBirthTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setLat(23.13);
    setLng(113.27);
    setPlaceName("广东省广州市");
    setNameLength("DOUBLE");
    setFormErr("");
  };

  // 畅享权益：挂载/结果返回时刷新（徽标与升级弹层价格）
  const namingPrice = useFeaturePrice("BABY_NAMING", 10);
  const featureEnabled = useFeatureEnabled("BABY_NAMING");
  const [passInfo, setPassInfo] = useState<PassStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // insufficient=余额不足引导充值/畅享；locked=换批锁定（兼容旧后端码）
  const [upgradeMode, setUpgradeMode] = useState<"insufficient" | "locked">("insufficient");
  const refreshPass = () => {
    get<PassStatus>("/api/v1/naming/pass/status", {}, { timeoutMs: 6000 })
      .then((r) => setPassInfo(r || null))
      .catch(() => {});
  };
  useEffect(() => {
    refreshPass();
    refreshBalance();
  }, []);

  // 点数购买畅享：余额足直接扣点开通；不足（402）留在弹层提示充值
  const [purchasingPass, setPurchasingPass] = useState<"" | "DAY" | "MONTH">("");
  const [passErr, setPassErr] = useState("");
  const [precheckOpen, setPrecheckOpen] = useState(false);
  const purchasePass = async (passType: "DAY" | "MONTH", autoStart = false) => {
    setPurchasingPass(passType);
    setPassErr("");
    try {
      await post("/api/v1/naming/pass/purchase-points", { passType });
      track("naming_pass_purchased", { passType });
      refreshPass();
      refreshBalance();
      setUpgradeOpen(false);
      setPrecheckOpen(false);
      if (autoStart) start(false); // 从"开始推演"前检进入：开通成功自动开始生成
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setPassErr(
        code === "ERR_INSUFFICIENT_BALANCE"
          ? "点数余额不足，请先充值点数"
          : (e as Error).message || "开通失败，请重试",
      );
    } finally {
      setPurchasingPass("");
    }
  };

  // 开始推演前检：未开通畅享且余额足以扣本次点数 → 先弹"开通畅享"建议（点数/¥ 均可），
  // 用户可选直接生成或先开畅享；余额不足走原流程（服务端 402 弹充值引导）
  const handleStartClick = () => {
    if (passInfo?.active || trial) {
      start(false);
      return;
    }
    const balance = getAuthUser()?.tokenBalance ?? 0;
    if (balance >= namingPrice) {
      setPrecheckOpen(true);
      return;
    }
    start(false);
  };

  // 生成状态
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [aiDelta, setAiDelta] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<NameCardData[]>([]);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const excludeRef = useRef<string[]>([]);
  const [placeName, setPlaceName] = useState("");
  const [sortKey, setSortKey] = useState<"recommend" | "phonetics" | "culture" | "zodiac">(
    "recommend",
  );
  const [onlyCited, setOnlyCited] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSel, setCompareSel] = useState<string[]>([]);
  const [slowHint, setSlowHint] = useState(false);
  const [excludedCount, setExcludedCount] = useState(0);
  const [poster, setPoster] = useState<{ name: string; url: string } | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [posterBusy, setPosterBusy] = useState(false);
  const streamRef = useRef<StreamHandle | null>(null);

  // 投票
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);
  const [voteLink, setVoteLink] = useState("");

  const wugeCells = (c: NameCardData) =>
    [
      { label: "天格", value: c.tianGe },
      { label: "人格", value: c.renGe },
      { label: "地格", value: c.diGe },
      { label: "外格", value: c.waiGe },
      { label: "总格", value: c.zongGe },
    ].filter((g) => typeof g.value === "number");

  const body = (exclude: string[]) => ({
    surname,
    gender,
    birthTime: `${birthDate}T${born ? birthTime || "12:00" : "12:00"}:00`,
    latitude: lat,
    longitude: lng,
    nameLength,
    wuxingMatch,
    ...(generationChar.trim() ? { generationChar: generationChar.trim() } : {}),
    ...(preferChars.length ? { preferredChars: preferChars } : {}),
    ...(tabooText.trim()
      ? {
          tabooChars: tabooText
            .split(/[,，、\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : {}),
    ...(stylesSel.length ? { styleTags: stylesSel } : {}),
    ...(expectSel.length ? { parentExpectations: expectSel } : {}),
    ...(sourcesSel.length ? { classicSources: sourcesSel } : {}),
    ...(booksSel.length ? { classicBooks: booksSel } : {}),
    classicStyle,
    ...(avoidText.trim()
      ? {
          avoidNames: avoidText
            .split(/[,，、\s]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 8),
        }
      : {}),
    ...(exclude.length ? { excludeNames: exclude } : {}),
  });

  const start = (exclude: boolean) => {
    setFormErr("");
    if (!surname.trim()) return setFormErr("请输入宝宝姓氏");
    if (!birthDate) return setFormErr(born ? "请选择出生日期" : "请选择预产期");
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/naming");
      return;
    }
    if (exclude) {
      excludeRef.current = [...excludeRef.current, ...cards.map((c) => c.name)];
    } else {
      excludeRef.current = [];
    }
    setExcludedCount(excludeRef.current.length);
    setCards([]);
    setDiagnosis(null);
    setError("");
    setAiDelta("");
    setStageIdx(-1);
    setVoteLink("");
    setPicking(false);
    setPicked([]);
    setLoading(true);
    setSlowHint(false);
    track("naming_generate_start", { regen: exclude });
    streamRef.current = streamPost({
      path: "/api/v1/naming/generate/stream",
      data: body(exclude ? excludeRef.current : []),
      idleTimeoutMs: 480_000,
      onEvent: (ev) => {
        const idx = STAGE_INDEX[String(ev.stage)];
        if (idx !== undefined) setStageIdx(idx);
        if (ev.stage === "bazi" && ev.data?.pillars) {
          setDiagnosis((d) => ({ ...(d || {}), pillars: ev.data.pillars as string[] }));
        } else if (ev.stage === "pool" && ev.data) {
          setDiagnosis((d) => ({ ...(d || {}), poolSize: Number(ev.data.poolSize) || 0 }));
        } else if (ev.stage === "xiyong" && ev.data) {
          setDiagnosis((d) => ({ ...(d || {}), ...(ev.data as Diagnosis) }));
        } else if (ev.stage === "result" && ev.data) {
          const d = ev.data as Diagnosis;
          setCards(d.cards || []);
          track("naming_generate_done", { cards: (d.cards || []).length });
          setDiagnosis((prev) => ({ ...(prev || {}), ...d, aiGenerated: d.aiGenerated !== false }));
          setLoading(false);
          refreshPass();
          // 本次生成已扣点：立即刷新登录态余额，页头实时变化
          refreshBalance();
        } else if (ev.stage === "error") {
          setError(String(ev.message || ev.error || "生成失败，请重试"));
          setLoading(false);
          track("naming_generate_error");
          // 失败可能伴随点数退还（refundedCoins）：刷新余额兜底
          refreshBalance();
        } else if ((ev.stage === "ai" || ev.stage === "ai_think") && ev.delta) {
          setAiDelta(String(ev.delta).slice(0, 60));
        }
      },
      onDone: () => {
        // 流结束但未收到 result/error 事件（服务端异常关闭等）：解除加载态防止「永远生成中」
        setLoading((prev) => {
          if (prev) {
            setError("生成流已结束但未收到结果，请重试");
            track("naming_generate_done_missing", {});
          }
          return false;
        });
      },
      onError: (e) => {
        const code = (e as Error & { code?: string }).code;
        if (code === "ERR_INSUFFICIENT_BALANCE") {
          // 余额不足：弹充值/畅享引导（首免试用由服务端放行，不会走到这里）
          setUpgradeMode("insufficient");
          setUpgradeOpen(true);
          setLoading(false);
          track("naming_insufficient");
          return;
        }
        if (code === "NAMING_BATCH_LOCKED") {
          // 单次 10 个名字已出完：换一批需畅享卡/包月，或再付一次点数生成新一批
          const err = e as Error & { dayPriceFen?: number; monthPriceFen?: number };
          if (err.dayPriceFen)
            setPassInfo((p) => ({ ...(p || {}), dayPriceFen: err.dayPriceFen }) as PassStatus);
          if (err.monthPriceFen)
            setPassInfo((p) => ({ ...(p || {}), monthPriceFen: err.monthPriceFen }) as PassStatus);
          setUpgradeMode("locked");
          setUpgradeOpen(true);
          setLoading(false);
          track("naming_batch_locked");
          return;
        }
        setError(e.message || "连接中断，请重试");
        setLoading(false);
      },
    });
  };

  const togglePick = (name: string) => {
    setPicked((p) =>
      p.includes(name) ? p.filter((n) => n !== name) : p.length < 5 ? [...p, name] : p,
    );
  };

  const createVote = async () => {
    if (picked.length < 3 || picked.length > 5) return;
    setVoting(true);
    track("vote_create", { count: picked.length });
    try {
      const res = await post<{ sessionToken?: string }>("/api/v1/naming/voting/session", {
        babySurname: surname,
        candidateNames: picked,
      });
      if (res?.sessionToken) {
        setVoteLink(`${location.origin}/vote/${res.sessionToken}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票创建失败");
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowHint(true), 90_000);
    return () => clearTimeout(t);
  }, [loading]);

  // 短名单（localStorage 持久，跨会话保留）
  useEffect(() => {
    try {
      setShortlist(JSON.parse(localStorage.getItem("naming_shortlist") || "[]"));
    } catch {
      /* 忽略 */
    }
  }, []);
  const toggleShortlist = (name: string) => {
    setShortlist((p) => {
      const next = p.includes(name) ? p.filter((x) => x !== name) : [...p, name].slice(-12);
      try {
        localStorage.setItem("naming_shortlist", JSON.stringify(next));
      } catch {
        /* 忽略 */
      }
      track("shortlist_toggle", { name, add: !p.includes(name) });
      return next;
    });
  };

  // 微信内分享卡片
  useEffect(() => {
    setupWxShare({
      title: "给宝宝起个有出处的好名字",
      desc: "五行喜用 + 五格数理 + 典籍出处，一次生成 10 个名字方案",
    });
  }, []);

  const hasResult = cards.length > 0;
  const trial = !!diagnosis?.freeTrial && (diagnosis?.lockedCount ?? 0) > 0;
  const birthLabel = born ? `${birthDate || "-"} ${birthTime || ""}` : `预产期 ${birthDate || "-"}`;
  const infoLine = `${surname}家${gender === "M" ? "男" : "女"}宝宝 · ${birthLabel}${placeName ? ` · ${shortPlace(placeName)}` : ""}`;
  const diagLine = diagnosis
    ? `日主${ELEMENT_ZH[diagnosis.dayMasterElement || ""] || "-"} · ${STRENGTH_ZH[diagnosis.strength || ""] || "-"} · 喜用${ELEMENT_ZH[diagnosis.primaryElement || ""] || "-"}主${diagnosis.secondaryElement ? ELEMENT_ZH[diagnosis.secondaryElement] + "辅" : ""}`
    : "";
  const sortedCards = useMemo(() => {
    const list = [...cards];
    if (onlyCited) return list.filter((c) => !!c.classicCitation);
    if (sortKey !== "recommend") {
      list.sort(
        (a, b) => (b.dimensionScores?.[sortKey] ?? 0) - (a.dimensionScores?.[sortKey] ?? 0),
      );
    }
    return list;
  }, [cards, sortKey, onlyCited]);
  const chips = "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors";

  return (
    <AppShell>
      <BreadcrumbJsonLd name="宝宝起名" path="/naming" />
      {featureEnabled === false ? (
        <FeatureClosed title="宝宝起名" />
      ) : (
        <>
          <PageHeader
            eyebrow={`功能一 · 消耗 ${namingPrice} 点`}
            title="宝宝起名"
            desc="填写姓氏与生辰偏好，为孩子拟一组有来历、有数理的名字。"
          />

          {/* 表单 */}
          {!hasResult && !loading ? (
            <>
              <section
                id="naming-form"
                className="ink-in d1 mt-7 space-y-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5"
              >
                {/* P2 信任条 + 示例填充 */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-ink/50">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-emerald-700" />
                    典藏 440+ 典籍名句 · 信息仅用于本次起名
                  </span>
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="shrink-0 rounded-full bg-paper-3 px-2.5 py-1 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/30"
                  >
                    填个示例
                  </button>
                </div>

                {/* 小节一：宝宝信息（必填区） */}
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
                  宝宝信息
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="姓氏" required>
                    <input
                      className={inputCls}
                      maxLength={4}
                      placeholder="如：沈"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                    />
                  </Field>
                  <Field label="性别" required>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["F", "女"],
                          ["M", "男"],
                        ] as const
                      ).map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setGender(v)}
                          className={`rounded-xl py-2.5 text-sm font-medium ring-1 transition-colors ${gender === v ? "bg-vermilion/12 text-vermilion-deep ring-vermilion/35" : "bg-paper-3 text-ink-soft ring-ink/10 hover:ring-vermilion/25"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="-mt-1 flex flex-wrap gap-1.5">
                  {["王", "李", "张", "刘", "陈", "杨", "黄", "赵", "吴", "周", "徐", "孙"].map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSurname(s)}
                        className={`rounded-full px-2.5 py-1 text-xs ring-1 transition-colors ${surname === s ? "bg-ink text-paper ring-ink" : "bg-paper-3/70 text-ink-soft ring-ink/10 hover:ring-ink/25"}`}
                      >
                        {s}
                      </button>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex gap-2">
                    {(
                      [
                        ["born", "已出生"],
                        ["unborn", "未出生 · 预产期"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBorn(v === "born")}
                        className={`${chips} flex-1 ${born === (v === "born") ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <Field label={born ? "出生日期" : "预产期"} required>
                    <input
                      className={inputCls}
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </Field>
                  {born ? (
                    <Field label="出生时间">
                      <input
                        className={inputCls}
                        type="time"
                        value={birthTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                      />
                    </Field>
                  ) : (
                    <div className="flex items-end pb-1">
                      <p className="text-[11px] leading-snug text-ink-faint">
                        预产期方案按当日午时（12:00）推演，宝宝出生后可用实际生辰重新生成精算
                      </p>
                    </div>
                  )}
                </div>
                <Field
                  label={born ? "出生地（用于真太阳时校正）" : "计划出生地（用于真太阳时校正）"}
                  required
                >
                  <div className="flex items-stretch gap-2">
                    <div className="min-w-0 flex-1">
                      <BirthplaceInput
                        lat={lat}
                        lng={lng}
                        place={placeName}
                        placeholder={born ? "输入城市或地区名，如：杭州" : "计划出生地，如：杭州"}
                        onPick={(v) => {
                          setLat(v.lat);
                          setLng(v.lng);
                          setPlaceName(v.place || "");
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={locateMe}
                      disabled={locating}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-paper-3 px-3 text-xs font-medium text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/30 disabled:opacity-60"
                    >
                      <LocateFixed
                        aria-hidden
                        className={`size-3.5 ${locating ? "animate-pulse" : ""}`}
                      />
                      {locating ? "定位中" : "定位"}
                    </button>
                  </div>
                </Field>
                <Field label="家长期望（最多 3 个，选填）">
                  <div className="flex flex-wrap gap-2">
                    {parentExpectTags.map((s) => (
                      <button
                        key={s}
                        disabled={!expectSel.includes(s) && expectSel.length >= 3}
                        title={
                          !expectSel.includes(s) && expectSel.length >= 3
                            ? "最多选择 3 个期望"
                            : undefined
                        }
                        onClick={() =>
                          setExpectSel((p) =>
                            p.includes(s) ? p.filter((x) => x !== s) : p.length < 3 ? [...p, s] : p,
                          )
                        }
                        className={`${chips} ${expectSel.includes(s) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"} disabled:opacity-40`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink/45">
                    选中的期望将用于选字与寓意判词，名字尽量呼应
                  </p>
                </Field>
                {/* 环 1 增强：偏好信号面板——始终可见（不折叠），各信号可单独移除 */}
                {preferChars.length || preferSrc || bookSignal || preferGender || preferExpect ? (
                  <div className="rounded-xl bg-vermilion/[0.06] px-3 py-2.5 ring-1 ring-vermilion/15">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-vermilion-deep">
                        {/* 从《典籍馆》指定书目进来时没有灵感库名字，标题按实际来源写 */}
                        {preferChars.length || preferSrc || preferGender || preferExpect
                          ? "灵感库带入"
                          : "指定典籍"}
                      </span>
                      {preferChars.length ? (
                        <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] ring-1 ring-vermilion/20">
                          {preferChars.map((ch) => (
                            <span key={ch} className="font-semibold text-vermilion-deep">
                              {ch}
                            </span>
                          ))}
                          <button
                            type="button"
                            title="移除偏好字"
                            onClick={() => setPreferChars([])}
                            className="ml-0.5 text-ink-faint hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                      {preferSrc ? (
                        <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-ink/10">
                          典籍 · {CATEGORY_LABELS[preferSrc]}
                          <button
                            type="button"
                            title="移除典籍偏好"
                            onClick={() => {
                              setPreferSrc(null);
                              setSourcesSel([]);
                            }}
                            className="text-ink-faint hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                      {/* 书目信号以实际勾选为准：切分组/取消类目会摘掉书目，此处同步不再显示 */}
                      {bookSignal ? (
                        <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-ink/10">
                          书目 · 《{preferBook}》
                          <button
                            type="button"
                            title="移除指定书目"
                            onClick={() => {
                              setBooksSel((p) => p.filter((x) => x !== preferBook));
                              setPreferBook(null);
                            }}
                            className="text-ink-faint hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                      {preferGender ? (
                        <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-ink/10">
                          性别 · {preferGender === "M" ? "男" : "女"}
                          <button
                            type="button"
                            title="移除性别预选"
                            onClick={() => setPreferGender(null)}
                            className="text-ink-faint hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                      {preferExpect ? (
                        <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-ink/10">
                          期望 · {preferExpect}
                          <button
                            type="button"
                            title="移除期望预选"
                            onClick={() => {
                              setPreferExpect(null);
                              setExpectSel((p) => p.filter((x) => x !== preferExpect));
                            }}
                            className="text-ink-faint hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      {preferChars.length || preferSrc || preferGender || preferExpect
                        ? "按选定名字的风格生成：偏好字优先成卡"
                        : "本次起名的偏好："}
                      {preferSrc ? "、典籍收敛到该出处" : ""}
                      {bookSignal ? "、名字出处限定该书" : ""}
                      {preferExpect ? "、期望呼应其气质" : ""}；点 × 可单独移除任一信号
                    </p>
                  </div>
                ) : null}
                {/* P0 高级选项折叠：起名偏好 + 家族避讳（选填，默认收起） */}
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl bg-paper-3/70 px-4 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-ink/10 transition-colors hover:ring-ink/25"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal aria-hidden className="size-4" />
                    起名偏好与家族避讳（选填）
                  </span>
                  <span className="flex items-center gap-2">
                    {advancedCount > 0 ? (
                      <span className="rounded-full bg-vermilion/12 px-2 py-0.5 text-[10px] font-semibold text-vermilion-deep">
                        已选 {advancedCount}
                      </span>
                    ) : null}
                    <ChevronDown
                      aria-hidden
                      className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
                {advancedOpen ? (
                  <div className="space-y-3 rounded-xl bg-paper-3/30 p-3">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                      <span aria-hidden className="h-3 w-0.5 rounded-full bg-vermilion/60" />
                      起名偏好
                    </h4>
                    <Field label="名字长度">
                      <div className="flex gap-2">
                        {(
                          [
                            ["DOUBLE", "双字名"],
                            ["SINGLE", "单字名"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            onClick={() => setNameLength(v)}
                            className={`${chips} ${nameLength === v ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink/45">
                        {nameLength === "DOUBLE"
                          ? "双字名重名率更低、更显雅致"
                          : "单字名更响亮利落"}
                      </p>
                    </Field>
                    <Field label="五行匹配">
                      <div className="flex gap-2">
                        {(
                          [
                            [true, "匹配喜用五行"],
                            [false, "不匹配（典故优先）"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={String(v)}
                            onClick={() => setWuxingMatch(v)}
                            className={`${chips} ${wuxingMatch === v ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink/45">
                        {wuxingMatch
                          ? "用字优先补益宝宝八字喜用五行，五行维度得分更高"
                          : "不限五行取全量字库，双字名优先取典故原文中的词（如 望舒），有典籍出处的名字更多、更雅"}
                      </p>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Field label="指定用字（字辈）">
                          <input
                            className={inputCls}
                            maxLength={4}
                            placeholder="名字首字固定为该字"
                            value={generationChar}
                            onChange={(e) => setGenerationChar(e.target.value)}
                          />
                        </Field>
                        {generationChar.trim() ? (
                          <p className="mt-1 text-[11px] text-vermilion-deep">
                            {nameLength === "SINGLE"
                              ? `名字将为 ${surname.trim() || "□"}${generationChar.trim()}（单字即字辈）`
                              : `名字将为 ${surname.trim() || "□"}${generationChar.trim()}□（字辈居首）`}
                          </p>
                        ) : null}
                      </div>
                      <Field label="避用字">
                        <input
                          className={inputCls}
                          maxLength={4}
                          placeholder="如：伟, 强"
                          value={tabooText}
                          onChange={(e) => setTabooText(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="风格偏好（最多 3 个）">
                      <div className="flex flex-wrap gap-2">
                        {styleTags.map((s) => (
                          <button
                            key={s}
                            disabled={!stylesSel.includes(s) && stylesSel.length >= 3}
                            title={
                              !stylesSel.includes(s) && stylesSel.length >= 3
                                ? "最多选择 3 个风格"
                                : undefined
                            }
                            onClick={() =>
                              setStylesSel((p) =>
                                p.includes(s)
                                  ? p.filter((x) => x !== s)
                                  : p.length < 3
                                    ? [...p, s]
                                    : p,
                              )
                            }
                            className={`${chips} ${stylesSel.includes(s) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"} disabled:opacity-40`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="典籍偏好（限选一组）">
                      <div className="flex gap-2">
                        {classicGroups.map((g, gi) => {
                          const cnt = g.items.filter(([c2]) => sourcesSel.includes(c2)).length;
                          return (
                            <button
                              key={g.name}
                              onClick={() => {
                                setClassicGroup(gi);
                                // 分段互斥：切换分组清空其他组已选（组间类目不重叠），组外选书一并清掉
                                const codes = g.items.map(([c2]) => c2) as readonly string[];
                                setSourcesSel((p) => p.filter((x) => codes.includes(x)));
                                setBooksSel((p) => p.filter((bk) => codes.includes(catByBook.get(bk) ?? "")));
                              }}
                              className={`${chips} flex-1 ${classicGroup === gi ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                            >
                              {g.name}
                              {cnt ? ` · ${cnt}` : ""}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {classicGroups[classicGroup].items.map(([code, label]) => (
                          <button
                            key={code}
                            onClick={() => {
                              if (sourcesSel.includes(code)) {
                                // 取消类目时同步清掉其下已选书目（书目行随类目一起收起）
                                setBooksSel((bk) => bk.filter((x) => catByBook.get(x) !== code));
                                setSourcesSel((p) => p.filter((x) => x !== code));
                                return;
                              }
                              setSourcesSel((p) => [...p, code]);
                            }}
                            className={`${chips} ${sourcesSel.includes(code) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink/45">
                        可多选类目；切换分组会更换可选类目并清空已选
                      </p>

                      {/* 第二级：书目轴（V171，管理端维护的书单）——选中类目后展开其下书目 */}
                      {bookRows.length ? (
                        <div className="mt-3 space-y-2.5 rounded-xl bg-paper-3/60 p-3 ring-1 ring-ink/5">
                          {bookRows.map(({ code, name, books }) => (
                            <div key={code}>
                              <p className="text-[11px] font-medium text-ink-soft">
                                {name} · 指定书目
                                <span className="ml-1 font-normal text-ink-faint">
                                  （可多选，选定后只从这些典籍出典）
                                </span>
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {books.map((b) => (
                                  <button
                                    key={b.book}
                                    title={b.intro ?? undefined}
                                    onClick={() => {
                                      if (booksSel.includes(b.book)) {
                                        setBooksSel((p) => p.filter((x) => x !== b.book));
                                        return;
                                      }
                                      // 选书即按书出典：把该书类目从类目轴摘掉，避免两轴口径打架
                                      setSourcesSel((sp) => sp.filter((x) => x !== code));
                                      setBooksSel((p) => [...p, b.book]);
                                    }}
                                    className={`${chips} ${booksSel.includes(b.book) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-2 text-ink-soft ring-ink/10"}`}
                                  >
                                    {b.book}
                                    {b.sentenceCount > 0 ? (
                                      <span className="ml-1 opacity-60">
                                        {b.sentenceCount >= 10000
                                          ? `${Math.round(b.sentenceCount / 10000)}万`
                                          : b.sentenceCount}
                                      </span>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          <p className="text-[11px] text-ink-faint">
                            {booksSel.length
                              ? `已选 ${booksSel.length} 部：名字出处只来自所选书目，可在《典籍馆》看每部书的名句`
                              : "不选书目 = 在所选类目（或全部语料）里自由取典"}
                            <Link
                              to="/dianji"
                              className="ml-1 text-vermilion-deep underline underline-offset-2"
                            >
                              查看典籍馆 →
                            </Link>
                          </p>
                        </div>
                      ) : null}
                    </Field>
                    <h4 className="flex items-center gap-2 pt-1 text-xs font-semibold text-ink-soft">
                      <span aria-hidden className="h-3 w-0.5 rounded-full bg-vermilion/60" />
                      家族避讳
                    </h4>
                    <Field label="长辈避讳（最多 8 位）">
                      <input
                        className={inputCls}
                        maxLength={40}
                        placeholder="祖辈/父母姓名，逗号分隔；同字同音自动规避"
                        value={avoidText}
                        onChange={(e) => setAvoidText(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}

                {/* P2 提交摘要条 */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] text-ink-soft">
                  <span className="min-w-0 truncate">
                    {surname.trim() || "＿"}家{gender === "M" ? "男" : "女"}宝宝 · {birthLabel}
                    {placeName ? ` · ${shortPlace(placeName)}` : ""}
                  </span>
                  <span className="shrink-0 text-ink-faint">约 90 秒出 10 个方案</span>
                </div>

                {formErr ? <p className="text-xs text-vermilion-deep">{formErr}</p> : null}
                <button
                  onClick={handleStartClick}
                  className="hidden w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] md:block"
                >
                  开始推演 · 消耗 {namingPrice} 点 · 单次 10 个名字
                </button>
                <p className="hidden text-center text-[11px] text-ink/50 md:block">
                  未充值新用户首次免费体验（展示 3 个精选名字，充值解锁全部）
                </p>
              </section>

              {/* P1 移动端吸底提交（含安全区适配） */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper-2/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
                <button
                  onClick={handleStartClick}
                  className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
                >
                  开始推演 · 消耗 {namingPrice} 点 · 单次 10 个名字
                </button>
                <p className="mt-1 text-center text-[10px] text-ink/50">
                  未充值新用户首次免费（展示 3 个精选名字）
                </p>
              </div>
              <div className="h-24 md:hidden" />
            </>
          ) : null}

          {/* 生成进度 */}
          {loading ? (
            <section className="ink-in d1 mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <div className="flex items-center gap-3">
                <span className="size-2 animate-pulse rounded-full bg-vermilion" />
                <p className="text-sm font-medium">正在生成…</p>
              </div>
              <ol className="mt-4 space-y-2.5">
                {STAGES.map((s, i) => (
                  <li key={s} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                        i < stageIdx
                          ? "bg-ink text-paper"
                          : i === stageIdx
                            ? "bg-vermilion text-paper"
                            : "bg-paper-3 text-ink-faint"
                      }`}
                    >
                      {i < stageIdx ? "✓" : i + 1}
                    </span>
                    <span className={i <= stageIdx ? "text-ink" : "text-ink-faint"}>{s}</span>
                  </li>
                ))}
              </ol>
              {diagnosis?.pillars?.length ? (
                <div className="mt-4 rounded-xl bg-paper-3/60 p-3">
                  <p className="text-[11px] text-ink/50">真太阳时四柱排定</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["年柱", "月柱", "日柱", "时柱"].map((l, i) => (
                      <span
                        key={l}
                        className="rounded-lg bg-paper px-2.5 py-1 text-sm font-medium tracking-widest ring-1 ring-ink/10"
                      >
                        <span className="mr-1 text-[10px] text-ink/45">{l}</span>
                        {diagnosis.pillars?.[i] || "-"}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {stageIdx >= 1 && diagnosis?.primaryElement ? (
                <div className="mt-3 rounded-xl bg-paper-3/60 p-3 text-xs leading-relaxed text-ink-soft">
                  喜用判定：日主{ELEMENT_ZH[diagnosis.dayMasterElement || ""]}·
                  {STRENGTH_ZH[diagnosis.strength || ""]}，取{ELEMENT_ZH[diagnosis.primaryElement]}
                  为主、
                  {diagnosis.secondaryElement
                    ? ELEMENT_ZH[diagnosis.secondaryElement] + "为辅"
                    : ""}
                  {diagnosis.climateElement
                    ? `；调候喜${ELEMENT_ZH[diagnosis.climateElement]}（加分）`
                    : ""}
                </div>
              ) : null}
              {typeof diagnosis?.poolSize === "number" && diagnosis.poolSize > 0 ? (
                <div className="mt-3 rounded-xl bg-paper-3/60 p-3 text-xs text-ink-soft">
                  已按喜用五行与避讳筛出 <b className="text-vermilion-deep">{diagnosis.poolSize}</b>{" "}
                  个优选字，进入典籍推演…
                </div>
              ) : null}
              {aiDelta ? (
                <div className="mt-4 rounded-xl bg-paper-3/60 p-3">
                  <p className="text-[11px] text-ink/50">AI 典籍推演</p>
                  <p className="mt-1 truncate text-xs text-ink-faint">{aiDelta}</p>
                </div>
              ) : null}
              {slowHint ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
                  推演仍在进行（典籍配对较耗时，通常 1~3 分钟）——可以先喝口水，结果出来会自动展示
                </p>
              ) : null}
              <button
                onClick={() => {
                  streamRef.current?.abort();
                  setLoading(false);
                  setError("已取消");
                }}
                className="mt-5 w-full rounded-xl bg-paper-3 py-2.5 text-xs font-medium text-ink-soft ring-1 ring-ink/10"
              >
                取消生成
              </button>
            </section>
          ) : null}

          {error && !loading ? (
            <section className="ink-in mt-7 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm text-vermilion-deep">{error}</p>
              <button
                onClick={handleStartClick}
                className="mt-4 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-paper"
              >
                重试
              </button>
            </section>
          ) : null}

          {/* 宝宝信息 + 五行分析 */}
          {diagnosis && hasResult ? (
            <section className="ink-in d1 mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              {/* 信息头：宝宝为纲，生日/出生地为注，层级分明 */}
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Baby aria-hidden className="size-5 text-ink-soft" />
                    <h2 className="text-lg font-semibold tracking-wide">
                      {surname}家{gender === "M" ? "男" : "女"}宝宝
                    </h2>
                    {!born ? (
                      <span className="rounded-full bg-amber-700/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-600/25">
                        预产期推演
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {born ? `${birthDate} ${birthTime}` : `预产期 ${birthDate}`}
                    {placeName ? ` · ${shortPlace(placeName)}` : ""}
                  </p>
                  {!born ? (
                    <p className="mt-1 max-w-md text-[11px] leading-relaxed text-ink-faint">
                      时柱按当日午时（12:00）推演，宝宝出生后建议用实际生辰重新生成精算
                    </p>
                  ) : null}
                </div>
              </div>

              {/* 四柱：格位化 4 列，地支五行色点呼应 */}
              {diagnosis.pillars?.length ? (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {diagnosis.pillars.map((pl, i) => {
                    const el = BRANCH_ELEMENT[pl[pl.length - 1]];
                    return (
                      <div
                        key={i}
                        className="rounded-xl bg-paper-3/70 px-1 py-1.5 text-center ring-1 ring-ink/5"
                      >
                        <p className="flex items-center justify-center gap-1 text-[10px] text-ink-faint">
                          <span
                            className={`size-1.5 rounded-full ${ELEMENT_DOT[el] || "bg-ink/20"}`}
                          />
                          {["年柱", "月柱", "日柱", "时柱"][i]}
                        </p>
                        <p className="mt-0.5 font-seal text-lg leading-relaxed tracking-[0.2em] text-ink">
                          {pl}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* 五行分析：核心结论胶囊 + 能量刻度 */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 font-medium">
                  <span
                    className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.dayMasterElement || ""] || "bg-ink/25"}`}
                  />
                  日主 {ELEMENT_ZH[diagnosis.dayMasterElement || ""] || "-"}
                </span>
                {diagnosis.wuxingMatch === false ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-vermilion/10 px-3 py-1.5 font-medium text-vermilion-deep">
                    典故优先 · 未做五行匹配
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 rounded-full bg-paper-3 px-3 py-1.5">
                  {STRENGTH_ZH[diagnosis.strength || ""] || "-"}
                  {(() => {
                    const m = /能量指数\s*(\d+)%/.exec(diagnosis.reason || "");
                    if (!m) return null;
                    const pct = Math.min(100, Math.max(0, Number(m[1])));
                    return (
                      <>
                        <span className="inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-ink/10">
                          <span
                            className="h-full rounded-full bg-vermilion/70"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-[11px] text-ink-faint">{pct}%</span>
                      </>
                    );
                  })()}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 font-medium">
                  喜用
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.primaryElement || ""] || "bg-ink/25"}`}
                    />
                    {ELEMENT_ZH[diagnosis.primaryElement || ""] || "-"}主
                  </span>
                  {diagnosis.secondaryElement ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.secondaryElement] || "bg-ink/25"}`}
                      />
                      {ELEMENT_ZH[diagnosis.secondaryElement] || "-"}辅
                    </span>
                  ) : null}
                </span>
                {diagnosis.climateElement ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 text-ink-soft">
                    <span
                      className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.climateElement] || "bg-ink/25"}`}
                    />
                    调候{ELEMENT_ZH[diagnosis.climateElement] || ""} +
                  </span>
                ) : null}
              </div>

              {diagnosis.criticalBoundary?.note ? (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
                  <Clock3 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {diagnosis.criticalBoundary.note}
                </p>
              ) : null}
              {diagnosis.avoidSummary ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink/55">
                  <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {diagnosis.avoidSummary}
                </p>
              ) : null}
              {diagnosis.reason ? (
                <p className="mt-3 border-t border-ink/5 pt-2.5 text-[11px] leading-relaxed text-ink-faint">
                  {diagnosis.reason}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 名字卡 */}
          {hasResult ? (
            <>
              <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  名字方案
                  {passInfo?.active ? (
                    <span
                      title={
                        passInfo.passType === "MONTH"
                          ? "包月畅享：30 天内生成与换一批不限次"
                          : "畅享中：24 小时内生成与换一批不限次"
                      }
                      className="rounded-full bg-amber-700/12 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-600/30"
                    >
                      {passInfo.passType === "MONTH"
                        ? `包月畅享 · 至 ${new Date(passInfo.expiresAtEpochMs || 0).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`
                        : `畅享中 · 剩余 ${Math.max(1, Math.round(((passInfo.expiresAtEpochMs || 0) - Date.now()) / 3600000))}h`}
                    </span>
                  ) : null}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {trial ? (
                    <span className="rounded-full bg-vermilion/10 px-2.5 py-1 font-medium text-vermilion-deep ring-1 ring-vermilion/25">
                      {cards.length}/{cards.length + (diagnosis?.lockedCount ?? 0)} 已解锁
                    </span>
                  ) : (
                    <span className="text-ink-faint">{cards.length} 个</span>
                  )}
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                    className="rounded-lg bg-paper-3 px-2 py-1 text-base ring-1 ring-ink/10 md:text-xs"
                  >
                    <option value="recommend">按推荐指数</option>
                    <option value="phonetics">按音律韵味</option>
                    <option value="culture">按文化底蕴</option>
                    <option value="zodiac">按生肖契合</option>
                  </select>
                  <label className="flex items-center gap-1 text-ink-soft">
                    <input
                      type="checkbox"
                      checked={onlyCited}
                      onChange={(e) => setOnlyCited(e.target.checked)}
                    />
                    只看有出处
                  </label>
                  <button
                    onClick={() => {
                      track("compare_toggle", { on: !compareMode });
                      setCompareMode(!compareMode);
                      setCompareSel([]);
                    }}
                    className={`rounded-full px-2.5 py-1 font-medium ring-1 ${compareMode ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                  >
                    {compareMode
                      ? "退出对比"
                      : `对比${compareSel.length ? `(${compareSel.length})` : ""}`}
                  </button>
                </div>
              </div>
              {shortlist.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 px-4 py-2.5 text-xs ring-1 ring-ink/5">
                  <span className="text-ink/50">我的短名单（{shortlist.length}）</span>
                  {shortlist.map((nm) => (
                    <button
                      key={nm}
                      onClick={() => toggleShortlist(nm)}
                      title="点击移除"
                      className="inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-2.5 py-1 font-medium text-vermilion-deep ring-1 ring-vermilion/25"
                    >
                      {nm}
                      <X aria-hidden className="size-3" />
                    </button>
                  ))}
                </div>
              ) : null}
              {compareMode ? (
                <div className="mt-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
                  {compareSel.length < 2 ? (
                    <p className="text-xs text-ink-soft">
                      在下方名字卡勾选 2~3 个名字进入对比（已选 {compareSel.length}）
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="text-ink-soft">
                        <MultiRadar
                          items={compareSel.map((nm, i) => ({
                            name: nm,
                            scores: cards.find((c) => c.name === nm)?.dimensionScores || {},
                            color: ["#9E2B25", "#1D5B4F", "#8A6D1F"][i % 3],
                          }))}
                        />
                        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px]">
                          {compareSel.map((nm, i) => (
                            <span key={nm} className="flex items-center gap-1">
                              <span
                                className="size-2 rounded-full"
                                style={{ background: ["#9E2B25", "#1D5B4F", "#8A6D1F"][i % 3] }}
                              />
                              {nm}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <tbody className="divide-y divide-ink/8">
                            {[
                              ["推荐指数", (c: NameCardData) => c.recommendScore ?? "-"],
                              [
                                "音律韵味",
                                (c: NameCardData) => c.dimensionScores?.phonetics ?? "-",
                              ],
                              ["文化底蕴", (c: NameCardData) => c.dimensionScores?.culture ?? "-"],
                              ["生肖契合", (c: NameCardData) => c.dimensionScores?.zodiac ?? "-"],
                              ["三才", (c: NameCardData) => c.sanCai || "-"],
                              [
                                "人格/总格",
                                (c: NameCardData) => `${c.renGe ?? "-"}/${c.zongGe ?? "-"}`,
                              ],
                              ["典籍出处", (c: NameCardData) => c.classicSource || "无"],
                              [
                                "方言检测",
                                (c: NameCardData) =>
                                  c.dialectCheckPassed === undefined
                                    ? "-"
                                    : c.dialectCheckPassed
                                      ? "通过"
                                      : "有提示",
                              ],
                            ].map(([label, fn]) => (
                              <tr key={label as string}>
                                <th className="w-20 py-2 pr-2 font-normal text-ink/50">
                                  {label as string}
                                </th>
                                {compareSel.map((nm) => (
                                  <td key={nm} className="py-2 pr-3 font-medium">
                                    {(fn as (c: NameCardData) => string | number)(
                                      cards.find((c) => c.name === nm)!,
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-5">
                {sortedCards.map((c, i) => (
                  <NameCardView
                    key={c.name + i}
                    c={c}
                    picking={picking}
                    compareMode={compareMode}
                    compareChecked={compareSel.includes(c.name)}
                    onCompare={() =>
                      setCompareSel((p) =>
                        p.includes(c.name)
                          ? p.filter((x) => x !== c.name)
                          : p.length < 3
                            ? [...p, c.name]
                            : p,
                      )
                    }
                    onListen={() => {
                      track("name_listen", { name: c.name });
                      speakName(c.name);
                    }}
                    onShortlist={() => toggleShortlist(c.name)}
                    shortlisted={shortlist.includes(c.name)}
                    onPoster={async () => {
                      setPosterBusy(true);
                      try {
                        const url = await buildPoster(c, infoLine, diagLine);
                        setPoster({ name: c.name, url });
                        track("poster_open", { name: c.name });
                      } catch {
                        /* 忽略：canvas 异常 */
                      } finally {
                        setPosterBusy(false);
                      }
                    }}
                    picked={picked.includes(c.name)}
                    onPick={() => togglePick(c.name)}
                    wuge={wugeCells(c)}
                    xiPrimary={diagnosis?.primaryElement}
                  />
                ))}
              </div>

              {trial
                ? Array.from({ length: Math.min(diagnosis?.lockedCount ?? 0, 10) }).map((_, i) => (
                    <div
                      key={"lock" + i}
                      className="relative min-h-56 overflow-hidden rounded-2xl bg-paper-2 ring-1 ring-ink/5"
                    >
                      <div className="space-y-2 p-5 blur-[6px]" aria-hidden>
                        <div className="h-7 w-24 rounded bg-ink/10" />
                        <div className="h-3 w-40 rounded bg-ink/8" />
                        <div className="h-3 w-28 rounded bg-ink/8" />
                        <div className="h-16 rounded-xl bg-ink/6" />
                      </div>
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-paper/45 backdrop-blur-[2px]">
                        <img
                          src="/mp-qrcode.jpg"
                          alt="对脉名鉴小程序码"
                          className="size-24 rounded-lg bg-paper p-1 ring-1 ring-ink/10"
                        />
                        <p className="text-sm font-semibold text-vermilion-deep">
                          充值解锁全部 {diagnosis?.lockedCount} 个名字
                        </p>
                        <p className="px-6 text-center text-[11px] leading-relaxed text-ink-soft">
                          微信扫码进入「对脉名鉴」小程序充值
                          <br />
                          点数网页端与小程序通用，登录同一账号即可
                        </p>
                      </div>
                    </div>
                  ))
                : null}

              {picking ? (
                <p className="mt-5 text-center text-xs text-ink-soft">
                  已选 {picked.length}/5，勾选 3~5 个名字发起投票
                </p>
              ) : null}

              <div className="mt-4 flex gap-3">
                {picking ? (
                  <>
                    <button
                      onClick={() => setPicking(false)}
                      className="flex-1 rounded-xl bg-paper-3 py-3 text-sm font-medium text-ink ring-1 ring-ink/10"
                    >
                      取消
                    </button>
                    <button
                      disabled={voting || picked.length < 3}
                      onClick={createVote}
                      className="flex-1 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper disabled:opacity-50"
                    >
                      {voting ? "创建中…" : `发起投票（${picked.length}）`}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => start(true)}
                      disabled={trial}
                      title={trial ? "充值解锁后可换一批（小程序充值点数）" : undefined}
                      className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-40"
                    >
                      {trial
                        ? "充值解锁后可换一批"
                        : passInfo?.active
                          ? `换一批${excludedCount ? `（已排除 ${excludedCount} 个）` : ""}`
                          : `换一批 · 再付 ${namingPrice} 点${excludedCount ? `（已排除 ${excludedCount} 个）` : ""}`}
                    </button>
                    <button
                      onClick={() => setPicking(true)}
                      className="flex-1 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper"
                    >
                      发起亲友投票
                    </button>
                  </>
                )}
              </div>

              {!trial ? (
                <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
                  <p className="text-sm font-medium">对这批名字不满意？</p>
                  <p className="text-xs text-ink-soft">
                    「换一批」自动排除已看过的名字
                    {passInfo?.active ? " · 畅享期内不限次" : ` · 每次再付 ${namingPrice} 点`} ·
                    勾选 3~5 个还可发起亲友投票
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        document
                          .getElementById("naming-form")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="text-xs font-medium text-vermilion-deep underline underline-offset-2"
                    >
                      调整偏好再来一轮 →
                    </button>
                    {!passInfo?.active ? (
                      <button
                        onClick={() => {
                          setUpgradeMode("locked");
                          setUpgradeOpen(true);
                        }}
                        className="text-xs font-medium text-vermilion-deep underline underline-offset-2"
                      >
                        开通畅享不限次（点数 / ¥ 均可） →
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(`https://name.duimai.net/naming`);
                        track("invite_copy", {});
                      }}
                      className="text-xs font-medium text-ink-soft underline underline-offset-2"
                    >
                      把起名工具分享给准爸妈朋友
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-vermilion/10 p-5 text-center ring-1 ring-vermilion/20">
                  <p className="text-sm font-semibold text-vermilion-deep">充值解锁更多好名字</p>
                  <p className="text-xs leading-relaxed text-ink-soft">
                    剩余 {diagnosis?.lockedCount ?? 0} 个精选名字待解锁 · 解锁后可「换一批」继续推演
                    <br />
                    前往「对脉名鉴」微信小程序 → 我的 → 点数充值
                  </p>
                </div>
              )}

              {voteLink ? (
                <section className="mt-5 rounded-2xl bg-vermilion/10 p-5 ring-1 ring-vermilion/20">
                  <p className="text-sm font-semibold text-vermilion-deep">投票链接已生成</p>
                  <p className="mt-2 break-all rounded-lg bg-paper px-3 py-2 text-xs text-ink ring-1 ring-ink/10">
                    {voteLink}
                  </p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(voteLink)}
                    className="mt-3 rounded-xl bg-vermilion px-5 py-2 text-xs font-semibold text-paper"
                  >
                    复制链接发给亲友
                  </button>
                </section>
              ) : null}
            </>
          ) : null}

          {/* 海报预览弹框 */}
          {/* 换一批升级弹层：单次 10 个名字出完 → 畅享卡/包月 或 再付一次点数 */}
          {upgradeOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
              onClick={() => setUpgradeOpen(false)}
            >
              <div
                className="ink-in w-full max-w-md rounded-2xl bg-paper p-5 ring-1 ring-ink/10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {upgradeMode === "insufficient" ? "点数不足" : "本批 10 个名字已生成完毕"}
                    </h3>
                    <p className="mt-1 text-xs text-ink-soft">
                      {upgradeMode === "insufficient"
                        ? `本次生成需 ${namingPrice} 点，可充值点数或开通畅享（期内不限次）`
                        : "换一批继续推演需开通畅享，也可以再次付费生成新一批"}
                    </p>
                  </div>
                  <button
                    onClick={() => setUpgradeOpen(false)}
                    className="text-ink/50 hover:text-ink"
                    title="关闭"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                  <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-600/25">
                    <p className="text-[11px] font-medium text-amber-800">24 小时畅享</p>
                    <p className="mt-0.5 text-xl font-bold text-amber-900">
                      ¥{((passInfo?.dayPriceFen ?? 3990) / 100).toFixed(1)}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                      当日不限次生成与换批
                    </p>
                    <button
                      onClick={() => purchasePass("DAY")}
                      disabled={purchasingPass !== ""}
                      className="mt-2 w-full rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                    >
                      {purchasingPass === "DAY"
                        ? "开通中..."
                        : `点数开通（${passInfo?.dayPricePoints ?? 40} 点）`}
                    </button>
                  </div>
                  <div className="rounded-xl bg-paper-3 p-3 ring-1 ring-ink/10">
                    <p className="text-[11px] font-medium text-ink-soft">包月畅享</p>
                    <p className="mt-0.5 text-xl font-bold text-ink">
                      ¥{((passInfo?.monthPriceFen ?? 9900) / 100).toFixed(0)}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                      30 天不限次，适合慢慢挑
                    </p>
                    <button
                      onClick={() => purchasePass("MONTH")}
                      disabled={purchasingPass !== ""}
                      className="mt-2 w-full rounded-lg bg-ink py-1.5 text-xs font-semibold text-paper transition-colors hover:bg-ink/85 disabled:opacity-50"
                    >
                      {purchasingPass === "MONTH"
                        ? "开通中..."
                        : `点数开通（${passInfo?.monthPricePoints ?? 100} 点）`}
                    </button>
                  </div>
                </div>
                {passErr ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-200">
                    {passErr}
                  </p>
                ) : null}
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-medium text-ink-faint">
                    或微信扫码直购（点数/畅享充入当前账号，到账自动提示）
                  </p>
                  <ScanBuyPanel trackWhere="naming_paywall" />
                </div>
                {upgradeMode === "locked" ? (
                  <button
                    onClick={() => {
                      setUpgradeOpen(false);
                      start(false);
                    }}
                    className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
                  >
                    或再付 {namingPrice} 点生成新一批（不排除已看过）
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 开始推演前检：余额足够时先建议开通畅享（点数/¥ 均可），可直接生成 */}
          {precheckOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
              onClick={() => setPrecheckOpen(false)}
            >
              <div
                className="ink-in w-full max-w-md rounded-2xl bg-paper p-5 ring-1 ring-ink/10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">开始推演 · 余额足够</h3>
                    <p className="mt-1 text-xs text-ink-soft">
                      当前余额 {getAuthUser()?.tokenBalance ?? 0} 点，本次生成将消耗 {namingPrice}{" "}
                      点。 开通畅享不限次更划算（生成与换一批都不再扣点）。
                    </p>
                  </div>
                  <button
                    onClick={() => setPrecheckOpen(false)}
                    className="text-ink/50 hover:text-ink"
                    title="关闭"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => purchasePass("DAY", true)}
                    disabled={purchasingPass !== ""}
                    className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    {purchasingPass === "DAY"
                      ? "开通中..."
                      : `开通 24 小时畅享（${passInfo?.dayPricePoints ?? 40} 点）并开始推演`}
                  </button>
                  <button
                    onClick={() => purchasePass("MONTH", true)}
                    disabled={purchasingPass !== ""}
                    className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink/85 disabled:opacity-50"
                  >
                    {purchasingPass === "MONTH"
                      ? "开通中..."
                      : `开通包月畅享（${passInfo?.monthPricePoints ?? 100} 点）并开始推演`}
                  </button>
                  <button
                    onClick={() => {
                      setPrecheckOpen(false);
                      start(false);
                    }}
                    className="w-full rounded-xl border border-ink/15 bg-paper-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-3/70"
                  >
                    暂不开通，直接生成（扣 {namingPrice} 点）
                  </button>
                </div>
                {passErr ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-200">
                    {passErr}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {poster ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
              onClick={() => setPoster(null)}
            >
              <div
                className="ink-in max-h-[92vh] w-full max-w-sm overflow-hidden rounded-2xl bg-paper p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">起名海报 · {poster.name}</p>
                  <button
                    onClick={() => setPoster(null)}
                    className="text-ink/50 hover:text-ink"
                    title="关闭"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <img
                  src={poster.url}
                  alt={`起名海报 ${poster.name}`}
                  className="mt-3 max-h-[64vh] w-full rounded-xl object-contain"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.download = `起名海报_${poster.name}.png`;
                      a.href = poster.url;
                      a.click();
                      track("poster_download", { name: poster.name });
                    }}
                    className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
                  >
                    下载图片
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator ? (
                    <button
                      onClick={async () => {
                        track("poster_share", { name: poster.name });
                        try {
                          const blob = await (await fetch(poster.url)).blob();
                          const file = new File([blob], `起名海报_${poster.name}.png`, {
                            type: "image/png",
                          });
                          if (navigator.canShare?.({ files: [file] })) {
                            await navigator.share({
                              files: [file],
                              title: `起名海报 ${poster.name}`,
                            });
                          } else {
                            await navigator.share({
                              title: `起名海报 ${poster.name}`,
                              text: `为「${poster.name}」生成的起名海报`,
                              url: "https://name.duimai.net/naming",
                            });
                          }
                        } catch {
                          /* 用户取消或浏览器不支持 */
                        }
                      }}
                      className="flex-1 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper"
                    >
                      分享
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-center text-[11px] text-ink/45">
                  长按图片也可保存或转发（手机端）
                </p>
              </div>
            </div>
          ) : null}
          {posterBusy ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
              <p className="rounded-xl bg-paper px-5 py-3 text-sm text-ink shadow-lg">
                海报生成中…
              </p>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function NameCardView({
  c,
  picking,
  picked,
  onPick,
  wuge,
  compareMode = false,
  compareChecked = false,
  onCompare,
  onListen,
  onPoster,
  onShortlist,
  shortlisted = false,
  xiPrimary,
}: {
  c: NameCardData;
  picking: boolean;
  picked: boolean;
  onPick: () => void;
  wuge: { label: string; value?: number }[];
  compareMode?: boolean;
  compareChecked?: boolean;
  onCompare?: () => void;
  onListen?: () => void;
  onPoster?: () => void;
  onShortlist?: () => void;
  shortlisted?: boolean;
  xiPrimary?: string;
}) {
  const [open, setOpen] = useState(false);
  const [ctxData, setCtxData] = useState<CitationContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  // 名字 = 姓(1~2字) + 名;charElements 对应名字部分
  const givenStart = Math.max(1, c.name.length - (c.charElements?.length || 2));
  const chars = useMemo(
    () =>
      c.name
        .slice(givenStart)
        .split("")
        .map((ch, i) => ({ ch, el: c.charElements?.[i] || "" })),
    [c, givenStart],
  );

  // P1 亮点条：五维各留一词一分的结论，次要明细全部折叠进详情
  const wugeVerdict = c.wugeWarning ? "偏弱" : "顺畅";
  const classicVerdict = c.originalCouplet
    ? "藏名一联"
    : c.sameClassicSource
      ? "同出一联"
      : c.charCitations?.length
        ? "字字有典"
        : c.classicCitation
          ? "有典可循"
          : "暂无出处";
  const classicGold = c.sameClassicSource === true;
  const highlights = [
    {
      label: "五行喜用",
      value: c.dimensionScores?.bazi != null ? String(c.dimensionScores.bazi) : "-",
      dot: ELEMENT_DOT[xiPrimary || ""] || "bg-ink/25",
      cls: "text-ink-soft ring-ink/10",
    },
    {
      label: "数理",
      value: wugeVerdict,
      dot: c.wugeWarning ? "bg-amber-600" : "bg-emerald-600",
      cls: c.wugeWarning
        ? "text-amber-800 ring-amber-700/25 bg-amber-700/8"
        : "text-emerald-800 ring-emerald-800/15 bg-emerald-800/5",
    },
    {
      label: "音律",
      value: c.dimensionScores?.phonetics != null ? String(c.dimensionScores.phonetics) : "-",
      dot: "bg-vermilion/60",
      cls: "text-ink-soft ring-ink/10",
    },
    {
      label: "文化",
      value: classicVerdict,
      dot: classicGold ? "bg-amber-600" : "bg-ink/25",
      cls: classicGold
        ? "text-amber-800 ring-amber-600/30 bg-amber-700/12"
        : c.originalCouplet
          ? "text-ink-soft ring-ink/15"
          : "text-ink-soft ring-ink/10",
    },
    {
      label: "谐音",
      value: c.homophoneSafe === false ? "需留意" : "安全",
      dot: c.homophoneSafe === false ? "bg-vermilion" : "bg-emerald-600",
      cls:
        c.homophoneSafe === false
          ? "text-vermilion-deep ring-vermilion/30 bg-vermilion/8"
          : "text-ink-soft ring-ink/10",
    },
  ];
  const toggleDetails = () => {
    if (!open) track("card_expand", { name: c.name });
    setOpen(!open);
  };

  // 出处上下文（V155）：引文可点 → 展开同书同篇 seq±2 原句窗口
  const openContext = async (citation: string) => {
    if (!citation) return;
    setCtxLoading(true);
    setCtxData(null);
    track("citation_context", { name: c.name });
    try {
      const res = await get<CitationContext>(
        `/api/v1/naming/citation-context?text=${encodeURIComponent(citation)}`,
      );
      setCtxData(res);
    } catch {
      setCtxData({ sentences: [], book: "", chapter: "未收录上下文（原创联或条目库外引文）" });
    } finally {
      setCtxLoading(false);
    }
  };

  return (
    <section
      className={`group relative rounded-2xl p-5 ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(158,43,37,0.12)] ${c.recommended ? "bg-gradient-to-b from-amber-50/80 to-paper-2 ring-2 ring-amber-600/45 hover:ring-amber-600/70" : "bg-paper-2 ring-ink/5 hover:ring-vermilion/30"}`}
      onClick={picking ? onPick : undefined}
    >
      {c.recommended ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-amber-700 px-2.5 py-0.5 text-[10px] font-semibold text-amber-50 shadow-sm">
          首选方案
        </span>
      ) : null}
      {compareMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCompare?.();
          }}
          className={`absolute right-4 top-4 z-10 grid size-5 place-items-center rounded-full text-[10px] ring-1 ${compareChecked ? "bg-ink text-paper ring-ink" : "bg-paper/70 text-ink-faint ring-ink/20"}`}
        >
          {compareChecked ? "✓" : ""}
        </button>
      ) : null}
      {picking ? (
        <span
          className={`absolute top-4 left-4 grid size-6 place-items-center rounded-full text-xs ring-1 ${
            picked
              ? "bg-vermilion text-paper ring-vermilion"
              : "bg-paper-3 text-transparent ring-ink/20"
          }`}
        >
          ✓
        </span>
      ) : null}

      <div className={`flex flex-wrap items-center gap-3 ${picking ? "pl-8" : ""}`}>
        <div className="flex items-end gap-1.5">
          {c.name.split("").map((ch, i) => {
            const gi = i - givenStart;
            const el = gi >= 0 ? chars[gi]?.el : "";
            return (
              <span key={i} className="relative">
                <span className="font-seal text-4xl leading-none text-ink">{ch}</span>
                {el ? (
                  <span
                    className={`absolute -top-1 -right-2.5 rounded px-1 text-[9px] leading-4 ring-1 ${
                      c.recommended
                        ? ELEMENT_CLS[el] || "bg-ink/80 text-paper ring-ink/30"
                        : ELEMENT_SOFT[el] || "bg-ink/10 text-ink-soft ring-ink/15"
                    }`}
                  >
                    {ELEMENT_ZH[el] || ""}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xs tracking-wide text-ink-soft">
          {c.pinyin}
          {pingzeOf(c.tones) ? (
            <span className="ml-1.5 rounded bg-ink/6 px-1.5 py-0.5 text-[10px] text-ink-faint">
              {pingzeOf(c.tones)}
            </span>
          ) : null}
        </p>
        {c.syntaxReading ? (
          <span
            title="姓氏与名连读构成主谓/动宾诗意句式（如 叶知秋 · 一叶知秋）"
            className="inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-2 py-0.5 text-[10px] font-medium text-vermilion-deep ring-1 ring-vermilion/25"
          >
            ✧ 诗联成句
          </span>
        ) : null}
      </div>

      {c.recommended ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-vermilion-deep">
            <span className="size-1.5 rounded-full bg-vermilion" />
            推荐{typeof c.recommendScore === "number" ? ` ${c.recommendScore}` : ""}
          </span>
          {c.recommendReason ? (
            <span className="whitespace-nowrap text-ink-faint">· {c.recommendReason}</span>
          ) : null}
        </div>
      ) : null}

      {/* P1 亮点条：一词结论，点击展开详情；移动端横向滚动 */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {highlights.map((h) => (
          <button
            key={h.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!open) toggleDetails();
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper-3/70 px-2.5 py-1 transition-colors hover:bg-paper-3 ${h.cls}`}
          >
            <span className={`size-1.5 rounded-full ${h.dot}`} />
            {h.label}
            <span className="font-semibold tabular-nums">{h.value}</span>
          </button>
        ))}
      </div>

      {/* 环 1 回流：名字命中灵感库 → 徽章链回 /names（深链该名字搜索） */}
      {c.goodNameHit ? (
        <Link
          to="/names"
          search={{ keyword: c.name.slice(1) }}
          onClick={(e) => e.stopPropagation()}
          title="名字命中名字灵感库（人工甄别的好名字清单）"
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-2 py-0.5 text-[10px] font-medium text-vermilion-deep ring-1 ring-vermilion/25 transition-colors hover:bg-vermilion/15"
        >
          ✦ 灵感库同款 · 点击查看
        </Link>
      ) : null}

      {c.charCitations?.length ? (
        <div className="mt-3 space-y-2">
          {c.originalCouplet ? (
            <span
              title="两字未能同出真实典籍，已按鹤顶格原创藏名联：一字居上句之首、一字居下句之首"
              className="inline-flex items-center gap-1 rounded-full bg-ink/8 px-2 py-0.5 text-[10px] font-medium text-ink-soft ring-1 ring-ink/15"
            >
              <PenLine aria-hidden className="size-3" />
              藏名一联 · 原创嵌名
            </span>
          ) : c.sameClassicSource ? (
            (() => {
              const citeText = Array.from(new Set(c.charCitations!.map((cc) => cc.citation))).join(
                "",
              );
              const form = citationFormOf(
                citeText,
                c.charCitations!.map((cc) => cc.char),
              );
              const badge = form ? FORM_BADGE[form] : null;
              return (
                <span
                  title={badge ? badge.hint : "两字同出一典（同句或同联上下句），逐字校验通过"}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-700/12 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-600/30"
                >
                  {badge ? `✦ ${badge.text}` : "✦ 同出一联 · 字字有典"}
                </span>
              );
            })()
          ) : (
            <span
              title="校验规则：每字引文正文均包含该字，出处核验通过"
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-800/10 text-emerald-800"
            >
              ✓ 字字有典 · 已校验
            </span>
          )}
          {(c.sameClassicSource || c.originalCouplet) && c.charCitations.length >= 2 ? (
            // 同典/藏名联：整联一次展示（上下句分行），名字用字高亮
            <div
              className={`rounded-xl p-3 ${c.originalCouplet ? "bg-paper-3/60 ring-1 ring-ink/8" : "bg-paper-3/60"}`}
            >
              <div className="flex items-center gap-1.5">
                {c.charCitations.map((cc) => (
                  <span
                    key={cc.char}
                    className="grid size-6 place-items-center rounded-full bg-vermilion/10 text-xs font-semibold text-vermilion-deep ring-1 ring-vermilion/25"
                  >
                    {cc.char}
                  </span>
                ))}
                {c.classicMeaning ? (
                  <span className="ml-1 text-[11px] text-ink-faint">「{c.classicMeaning}」</span>
                ) : null}
              </div>
              {Array.from(new Set(c.charCitations.map((cc) => cc.citation))).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openContext(t);
                  }}
                  title="查看出处上下文（同篇原句）"
                  className="mt-1.5 block w-full text-left text-sm leading-loose text-ink hover:text-vermilion-deep"
                >
                  {highlightNameChars(
                    t,
                    c.charCitations!.map((cc) => cc.char),
                  )}
                </button>
              ))}
              {c.charCitations[0].source ? (
                <p className="mt-1 text-xs font-medium text-vermilion-deep">
                  「{c.charCitations[0].source}」
                </p>
              ) : null}
              {c.originalCouplet ? (
                <p className="mt-1 text-[10px] text-ink-faint">原创藏名联，非典籍原文</p>
              ) : null}
            </div>
          ) : (
            c.charCitations.map((cc) => (
              <div
                key={cc.char + cc.citation}
                className="flex items-start gap-2 rounded-xl bg-paper-3/60 p-3"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-vermilion/10 text-xs font-semibold text-vermilion-deep ring-1 ring-vermilion/25">
                  {cc.char}
                </span>
                <div className="min-w-0">
                  {cc.source ? (
                    <p className="text-xs font-medium text-vermilion-deep">「{cc.source}」</p>
                  ) : null}
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                    {highlightNameChars(cc.citation, [cc.char])}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : c.classicCitation ? (
        <div className="mt-3 rounded-xl bg-paper-3/60 p-3">
          {c.classicVerified ? (
            <span
              title="校验规则：引文正文包含名字用字，出处核验通过"
              className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-800/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
            >
              ✓ 已校验 · 引文含名
            </span>
          ) : null}
          {c.classicSource ? (
            <p className="text-xs font-medium text-vermilion-deep">「{c.classicSource}」</p>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openContext(c.classicCitation!);
            }}
            title="查看出处上下文（同篇原句）"
            className="mt-1 block w-full text-left text-xs leading-relaxed text-ink-soft hover:text-vermilion-deep"
          >
            {c.classicCitation}
          </button>
          {c.classicMeaning ? (
            <p className="mt-1 text-[11px] text-ink-faint">「{c.classicMeaning}」</p>
          ) : null}
        </div>
      ) : null}

      {/* P1 折叠详情：五维评分 / 五格三才 / 方言 / 音律 / 字义全部收纳于此 */}
      {open ? (
        <div className="mt-3 space-y-3 rounded-xl bg-paper-3/40 p-3">
          {c.dimensionScores && Object.keys(c.dimensionScores).length ? (
            <div className="flex items-center gap-4 text-ink-soft">
              <div className="shrink-0 text-vermilion-deep/80">
                <DimRadar scores={c.dimensionScores} size={130} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {DIM_LABELS.map(([k, label]) => {
                  const v = Math.min(100, Math.max(0, c.dimensionScores?.[k] ?? 60));
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[11px] text-ink/55">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-ink/10">
                        <div
                          className="h-full rounded bg-vermilion-deep/70"
                          style={{ width: `${v}%` }}
                        />
                      </div>
                      <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-ink-soft">
                        {v}
                      </span>
                    </div>
                  );
                })}
                {c.fusionNote ? (
                  <p className="flex items-start gap-1.5 pt-0.5 text-[11px] leading-relaxed text-ink/55">
                    <Scale aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {c.fusionNote}
                  </p>
                ) : null}
                {c.wugeWarning ? (
                  <p className="text-[11px] leading-relaxed text-amber-700">· {c.wugeWarning}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {wuge.length || c.sanCai ? (
            <div className="flex flex-wrap items-center gap-3">
              {wuge.length ? (
                <div className="grid flex-1 grid-cols-5 gap-1.5">
                  {wuge.map((g) => (
                    <div key={g.label} className="rounded-lg bg-paper-3 py-1.5 text-center">
                      <p className="text-sm font-semibold tabular-nums">
                        {g.value}
                        <span className="text-[10px] font-normal text-ink-soft">画</span>
                      </p>
                      <p className="text-[10px] text-ink-soft">{g.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {c.sanCai ? (
                <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span>三才</span>
                  {c.sanCai.split("").map((ch, i) => (
                    <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">
                      {ch}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {c.phoneticNotes?.length ? (
            <div className="flex flex-wrap gap-1">
              {c.phoneticNotes.map((n) => (
                <span
                  key={n}
                  className="rounded bg-vermilion/10 px-1.5 py-0.5 text-[10px] text-vermilion-deep"
                >
                  {n}
                </span>
              ))}
            </div>
          ) : null}

          {(() => {
            if (c.dialectCheckPassed === undefined) return null;
            if (!c.dialectCheckPassed) {
              return <p className="text-[11px] text-vermilion-deep">方言谐音检测存在风险提示</p>;
            }
            const passedCount = (c.dialectChecks ?? []).filter((d) => d.status === "passed").length;
            // 无方言数据通过（0 条）时不显示，避免「+ 0 方言」的空洞表述
            if (passedCount === 0) return null;
            return (
              <p className="text-[11px] text-amber-700">
                已通过普通话 + {passedCount} 方言谐音检测
              </p>
            );
          })()}

          {c.wuxingAnalysis ? (
            <p className="border-t border-ink/5 pt-2 text-xs leading-relaxed text-ink-soft">
              <span className="mr-1 font-medium text-ink">字义详解</span>
              {c.wuxingAnalysis}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* P2 操作组：图标化常驻（试听 / 海报 / 收藏 / 详情） */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {c.homophoneSafe === false ? (
          <span className="flex min-w-0 items-start gap-1 text-[11px] leading-snug text-vermilion-deep">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {c.safetyNote || "谐音需留意"}
          </span>
        ) : (
          <span className="text-[11px] text-ink-faint">✓ 谐音安全</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {onListen ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onListen();
              }}
              title="读音试听（连读两遍）"
              className="grid size-8 place-items-center rounded-full bg-paper-3 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
            >
              <Volume2 aria-hidden className="size-4" />
            </button>
          ) : null}
          {onPoster ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPoster();
              }}
              title="生成海报"
              className="grid size-8 place-items-center rounded-full bg-paper-3 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
            >
              <ImageIcon aria-hidden className="size-4" />
            </button>
          ) : null}
          {onShortlist ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShortlist();
              }}
              title={shortlisted ? "移出短名单" : "收藏到短名单"}
              className={`grid size-8 place-items-center rounded-full ring-1 transition-all hover:scale-105 ${shortlisted ? "bg-vermilion/10 text-vermilion ring-vermilion/35" : "bg-paper-3 text-ink/35 ring-ink/10 hover:text-vermilion-deep hover:ring-vermilion/40"}`}
            >
              <Heart aria-hidden className={`size-4 ${shortlisted ? "fill-current" : ""}`} />
            </button>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDetails();
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-paper-3 px-3 text-[11px] text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
          >
            {open ? "收起详情 ▴" : "评分 · 数理 · 字义 ▾"}
          </button>
        </div>
      </div>

      {/* 出处上下文弹层（V155）：同书同篇原句窗口，命中行朱红高亮 */}
      {ctxLoading || ctxData ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4"
          onClick={() => {
            setCtxData(null);
            setCtxLoading(false);
          }}
        >
          <div
            className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl bg-paper p-5 ring-1 ring-ink/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-seal text-lg text-ink">
                {ctxData?.book
                  ? `${ctxData.book}${ctxData.chapter ? ` · ${ctxData.chapter}` : ""}`
                  : "出处上下文"}
              </p>
              <button
                onClick={() => {
                  setCtxData(null);
                  setCtxLoading(false);
                }}
                className="grid size-7 place-items-center rounded-full bg-paper-3 text-ink-soft ring-1 ring-ink/10"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            {ctxLoading ? (
              <p className="mt-6 text-center text-sm text-ink-faint">正在回查典籍原文…</p>
            ) : (ctxData?.sentences?.length ?? 0) > 0 ? (
              <div className="mt-3 space-y-2">
                {ctxData!.sentences!.map((s) => (
                  <p
                    key={s.seq}
                    className={`rounded-lg px-3 py-2 text-sm leading-loose ${s.hit ? "bg-vermilion/8 font-medium text-vermilion-deep ring-1 ring-vermilion/20" : "text-ink-soft"}`}
                  >
                    {s.text}
                  </p>
                ))}
                <p className="pt-1 text-center text-[10px] text-ink-faint">
                  同书同篇 · 句序前后各二句
                </p>
              </div>
            ) : (
              <p className="mt-6 text-center text-sm text-ink-faint">
                {ctxData?.chapter || "未收录上下文"}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
