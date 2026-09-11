import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { track } from "@/lib/track";
import { post, get } from "@/lib/api";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { getToken } from "@/lib/auth";
import { setupWxShare } from "@/lib/wx-share";
import QRCode from "qrcode";
import {
  Baby, Users, Volume2, Image as ImageIcon, Heart, X,
  TriangleAlert, Scale, PenLine, Clock3,
  ShieldCheck, LocateFixed, SlidersHorizontal, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/naming")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.oracle.duimai.net/naming" }],
    meta: [
      { title: "宝宝起名 · 对脉名鉴" },
      { name: "description", content: "按生辰喜用与五格数理，从典籍中为宝宝取一个有出处、有数理、有温度的名字；支持五维雷达、方言谐音检测与亲友投票。" },
      { property: "og:url", content: "https://www.oracle.duimai.net/naming" },
      { property: "og:title", content: "宝宝起名 · 对脉名鉴" },
      { property: "og:description", content: "一次生成 10 个有推荐指数与典籍出处的名字方案，支持亲友投票一起定。" },
      { property: "og:image", content: "https://www.oracle.duimai.net/og-card.jpg" },
    ],
  }),
  component: Naming,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/naming" },
    ],
    meta: [
      { title: "宝宝起名 · 对脉名鉴" },
      { name: "keywords", content: "宝宝起名,生辰起名,诗经楚辞起名,五格数理,起名推荐指数,亲友投票起名" },
      { property: "og:url", content: "https://www.oracle.duimai.net/naming" },
      {
        name: "description",
        content: "按姓氏、生辰与偏好流式生成有出处、有数理的名字方案，含推荐指数与亲友投票。",
      },
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
  classicMeaning?: string;
  charCitations?: { char: string; citation: string; source: string }[];
  sameClassicSource?: boolean;
  originalCouplet?: boolean;
}

/** 起名畅享权益状态（GET /api/v1/naming/pass/status）。 */
type PassStatus = {
  active?: boolean;
  passType?: string;
  expiresAtEpochMs?: number;
  dayPriceFen?: number;
  monthPriceFen?: number;
  batchLockEnabled?: boolean;
};

const DIM_LABELS: [string, string][] = [
  ["bazi", "八字喜用"],
  ["wuge", "五格数理"],
  ["phonetics", "音律韵味"],
  ["culture", "文化底蕴"],
  ["zodiac", "生肖契合"],
];

/** 典故引文中高亮名字用字（PRD 出处展示规范：整联一次展示 + 选中字高亮）。 */
function highlightNameChars(text: string, chars: string[]) {
  const set = new Set(chars.filter((c) => c && c.length === 1));
  return Array.from(text).map((ch, i) =>
    set.has(ch) ? (
      <span key={i} className="font-bold text-vermilion-deep">{ch}</span>
    ) : (
      <span key={i}>{ch}</span>
    )
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
  const ring = (ratio: number) =>
    DIM_LABELS.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const val = (i: number) => Math.min(100, Math.max(0, scores[DIM_LABELS[i][0]] ?? 60)) / 100;
  const area = DIM_LABELS.map((d, i) => pt(i, val(i)).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`-14 -8 ${size + 28} ${size + 16}`} className="mx-auto">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={ring(k)} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.8} />
      ))}
      {DIM_LABELS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.8} />;
      })}
      <polygon points={area} fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={1.6} />
      {DIM_LABELS.map((d, i) => {
        const [x, y] = pt(i, 1.3);
        return (
          <text key={d[0]} x={x} y={y} textAnchor={ANCHOR[i]} dominantBaseline="middle"
            fontSize={size / 15} fill="currentColor" fillOpacity={0.65}>
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
function MultiRadar({ items, size = 190 }: { items: { name: string; scores: Record<string, number>; color: string }[]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 30, n = DIM_LABELS.length;
  const pt = (i: number, k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  };
  const ANCHOR = ["middle", "start", "start", "end", "end"] as const;
  return (
    <svg width={size} height={size} viewBox={`-14 -8 ${size + 28} ${size + 16}`} className="mx-auto">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={DIM_LABELS.map((_, i) => pt(i, k).join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.8} />
      ))}
      {DIM_LABELS.map((d, i) => {
        const [x, y] = pt(i, 1.28);
        return <text key={d[0]} x={x} y={y} textAnchor={ANCHOR[i]} dominantBaseline="middle" fontSize={size / 16} fill="currentColor" fillOpacity={0.6}>{d[1]}</text>;
      })}
      {items.map((it) => (
        <polygon key={it.name} points={DIM_LABELS.map((d, i) => pt(i, Math.min(100, it.scores[d[0]] ?? 60) / 100).join(",")).join(" ")}
          fill={it.color} fillOpacity={0.12} stroke={it.color} strokeWidth={1.6} />
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
  } catch { /* 无 TTS 则静默 */ }
}

/** 古风海报（canvas → PNG dataURL，含 Web 推广二维码）。 */
async function buildPoster(c: NameCardData, infoLine: string, diagLine: string): Promise<string> {
  const W = 720, H = 1120;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas unavailable");
  g.fillStyle = "#F6EFE3"; g.fillRect(0, 0, W, H);
  const ink = "#2B2417", accent = "#9E2B25";
  g.fillStyle = "rgba(43,36,23,.55)"; g.font = "18px sans-serif"; g.textAlign = "left";
  g.fillText("对 脉 名 鉴", 48, 64);
  g.textAlign = "right"; g.fillStyle = accent; g.font = "16px sans-serif";
  g.fillText("五维融通 · 起名鉴赏", W - 48, 64);
  g.textAlign = "center";
  g.fillStyle = ink; g.font = `bold ${c.name.length > 3 ? 108 : 132}px "STKaiti","KaiTi",serif`;
  g.fillText(c.name, W / 2, 250);
  g.fillStyle = "rgba(43,36,23,.6)"; g.font = "24px sans-serif";
  g.fillText([c.pinyin].filter(Boolean).join(" · "), W / 2, 306);
  const cites = (c.charCitations?.length
    ? c.charCitations.map((cc) => ({ tag: cc.char, text: cc.citation, src: cc.source }))
    : c.classicCitation
      ? [{ tag: "", text: c.classicCitation, src: [c.classicSource, c.classicMeaning ? `「${c.classicMeaning}」` : ""].filter(Boolean).join("  ") }]
      : []) as { tag: string; text: string; src: string }[];
  if (cites.length === 1) {
    g.strokeStyle = "rgba(158,43,37,.3)"; g.strokeRect(60, 360, W - 120, 128);
    g.fillStyle = ink; g.font = "26px serif";
    const cite = cites[0].text.length > 26 ? cites[0].text.slice(0, 26) + "…" : cites[0].text;
    g.fillText(cite, W / 2, 412);
    g.fillStyle = accent; g.font = "20px sans-serif";
    g.fillText(cites[0].src, W / 2, 456);
  } else if (cites.length >= 2) {
    // 藏名联/同出联：徽标 + 放大居中两行诗句（名字用字朱红高亮，超宽自适应缩字号）+ 出处
    g.strokeStyle = "rgba(158,43,37,.3)"; g.strokeRect(60, 340, W - 120, 176);
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
    drawVerse(cites[0].text, 428);
    drawVerse(cites[1].text, 482);
    g.fillStyle = "rgba(158,43,37,.9)"; g.font = "19px sans-serif";
    const srcText = cites[0].src === cites[1].src
      ? cites[0].src
      : `${cites[0].src} ／ ${cites[1].src}`; // 历史回放的分典兜底：两出处并列
    const src = srcText.length > 30 ? srcText.slice(0, 30) + "…" : srcText;
    g.fillText(src, W / 2, 512);
  }
  g.fillStyle = "rgba(43,36,23,.75)"; g.font = "22px sans-serif";
  g.fillText(infoLine, W / 2, 548);
  g.fillText(diagLine, W / 2, 586);
  // 五维雷达
  const cx = W / 2, cy = 750, r = 120, n = 5;
  const pt = (i: number, k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  };
  g.strokeStyle = "rgba(43,36,23,.2)";
  [0.4, 0.7, 1].forEach((k) => {
    g.beginPath();
    DIM_LABELS.forEach((_, i) => { const [x, y] = pt(i, k); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.stroke();
  });
  g.fillStyle = accent; g.beginPath();
  DIM_LABELS.forEach((d, i) => { const [x, y] = pt(i, Math.min(100, c.dimensionScores?.[d[0]] ?? 60) / 100); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath(); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.stroke();
  g.fillStyle = "rgba(43,36,23,.6)"; g.font = "17px sans-serif";
  DIM_LABELS.forEach((d, i) => { const [x, y] = pt(i, 1.24); g.fillText(d[1], x, y); });
  // 底部：Web 推广二维码 + 引导
  let qrOk = false;
  try {
    const qrUrl = await QRCode.toDataURL("https://www.oracle.duimai.net/naming", { margin: 1, width: 320, color: { dark: "#2B2417", light: "#F6EFE3" } });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = qrUrl;
    });
    const qrSize = 150;
    g.drawImage(img, W - 48 - qrSize, H - 48 - qrSize - 14, qrSize, qrSize);
    qrOk = true;
  } catch { /* 二维码生成失败不阻断海报 */ }
  g.textAlign = "left";
  g.fillStyle = "rgba(43,36,23,.8)"; g.font = "bold 22px sans-serif";
  g.fillText("对脉名鉴 · 宝宝起名", 48, H - 132);
  g.fillStyle = "rgba(43,36,23,.55)"; g.font = "17px sans-serif";
  g.fillText(qrOk ? "扫码打开网页版，为宝宝定制好名" : "www.oracle.duimai.net/naming", 48, H - 102);
  g.fillStyle = "rgba(43,36,23,.4)"; g.font = "15px sans-serif";
  g.fillText("五行喜用 · 五格数理 · 音律韵味 · 典籍出处", 48, H - 72);
  return cv.toDataURL("image/png");
}

const STAGES = ["真太阳时校正", "喜用五行判定", "候选字库筛选", "AI 典籍推演", "生成完成"];
const STAGE_INDEX: Record<string, number> = { bazi: 0, xiyong: 1, pool: 2, ai: 3, ai_think: 3, fallback: 3, result: 4 };

const ELEMENT_ZH: Record<string, string> = {
  WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水",
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
  子: "WATER", 亥: "WATER", 寅: "WOOD", 卯: "WOOD", 巳: "FIRE", 午: "FIRE",
  丑: "EARTH", 辰: "EARTH", 未: "EARTH", 戌: "EARTH", 申: "METAL", 酉: "METAL",
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
const classicGroups = [
  { name: "诗词歌赋", items: [["shijing", "诗经"], ["chuci", "楚辞"], ["tangshi", "唐诗"], ["songci", "宋词"], ["weijin", "世说文心"]] },
  { name: "思想哲学", items: [["zhouyi", "周易"], ["lunyu", "论语"], ["rujia", "尚书礼记"], ["daojia", "道德庄子"]] },
  { name: "史书博物", items: [["shishi", "史记通鉴"], ["bowu", "山海本草"]] },
] as const;

function Naming() {
  // 表单
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("F");
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
  const [generationChar, setGenerationChar] = useState("");
  const [tabooText, setTabooText] = useState("");
  const [stylesSel, setStylesSel] = useState<string[]>([]);
  const [sourcesSel, setSourcesSel] = useState<string[]>([]);
  const [classicGroup, setClassicGroup] = useState(0);
  const [classicStyle, setClassicStyle] = useState<"大众" | "小众">("大众");
  const [avoidText, setAvoidText] = useState("");
  const [formErr, setFormErr] = useState("");

  // P1：高级选项折叠（起名偏好 + 家族避讳），标题徽标显示已选数量
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const advancedCount =
    (generationChar.trim() ? 1 : 0) + (tabooText.trim() ? 1 : 0) + (avoidText.trim() ? 1 : 0)
    + stylesSel.length + sourcesSel.length;

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
  useEffect(refreshPass, []);

  // 生成状态
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [aiDelta, setAiDelta] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<NameCardData[]>([]);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const excludeRef = useRef<string[]>([]);
  const [placeName, setPlaceName] = useState("");
  const [sortKey, setSortKey] = useState<"recommend" | "phonetics" | "culture" | "zodiac">("recommend");
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
    ...(generationChar.trim() ? { generationChar: generationChar.trim() } : {}),
    ...(tabooText.trim()
      ? { tabooChars: tabooText.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(stylesSel.length ? { styleTags: stylesSel } : {}),
    ...(sourcesSel.length ? { classicSources: sourcesSel } : {}),
    classicStyle,
    ...(avoidText.trim()
      ? { avoidNames: avoidText.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean).slice(0, 8) }
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
        } else if (ev.stage === "error") {
          setError(String(ev.message || ev.error || "生成失败，请重试"));
          setLoading(false);
          track("naming_generate_error");
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
          if (err.dayPriceFen) setPassInfo((p) => ({ ...(p || {}), dayPriceFen: err.dayPriceFen }) as PassStatus);
          if (err.monthPriceFen) setPassInfo((p) => ({ ...(p || {}), monthPriceFen: err.monthPriceFen }) as PassStatus);
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
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : p.length < 5 ? [...p, name] : p));
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
    } catch { /* 忽略 */ }
  }, []);
  const toggleShortlist = (name: string) => {
    setShortlist((p) => {
      const next = p.includes(name) ? p.filter((x) => x !== name) : [...p, name].slice(-12);
      try { localStorage.setItem("naming_shortlist", JSON.stringify(next)); } catch { /* 忽略 */ }
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
      list.sort((a, b) => (b.dimensionScores?.[sortKey] ?? 0) - (a.dimensionScores?.[sortKey] ?? 0));
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
      <PageHeader eyebrow={`功能一 · 消耗 ${namingPrice} 点`} title="宝宝起名" desc="填写姓氏与生辰偏好，为孩子拟一组有来历、有数理的名字。" />

      {/* 表单 */}
      {!hasResult && !loading ? (
        <>
        <section id="naming-form" className="ink-in d1 mt-7 space-y-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          {/* P2 信任条 + 示例填充 */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-ink/50">
            <span className="flex min-w-0 items-center gap-1.5">
              <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-emerald-700" />
              典藏 440+ 典籍名句 · 信息仅用于本次起名
            </span>
            <button type="button" onClick={fillDemo} className="shrink-0 rounded-full bg-paper-3 px-2.5 py-1 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/30">
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
                {([["F", "女"], ["M", "男"]] as const).map(([v, l]) => (
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
            {["王", "李", "张", "刘", "陈", "杨", "黄", "赵", "吴", "周", "徐", "孙"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSurname(s)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 transition-colors ${surname === s ? "bg-ink text-paper ring-ink" : "bg-paper-3/70 text-ink-soft ring-ink/10 hover:ring-ink/25"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex gap-2">
              {([["born", "已出生"], ["unborn", "未出生 · 预产期"]] as const).map(([v, l]) => (
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
              <input className={inputCls} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            {born ? (
              <Field label="出生时间">
                <input className={inputCls} type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
              </Field>
            ) : (
              <div className="flex items-end pb-1">
                <p className="text-[11px] leading-snug text-ink-faint">预产期方案按当日午时（12:00）推演，宝宝出生后可用实际生辰重新生成精算</p>
              </div>
            )}
          </div>
          <Field label={born ? "出生地（用于真太阳时校正）" : "计划出生地（用于真太阳时校正）"} required>
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
                <LocateFixed aria-hidden className={`size-3.5 ${locating ? "animate-pulse" : ""}`} />
                {locating ? "定位中" : "定位"}
              </button>
            </div>
          </Field>
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
                <span className="rounded-full bg-vermilion/12 px-2 py-0.5 text-[10px] font-semibold text-vermilion-deep">已选 {advancedCount}</span>
              ) : null}
              <ChevronDown aria-hidden className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
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
                  {([["DOUBLE", "双字名"], ["SINGLE", "单字名"]] as const).map(([v, l]) => (
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
                  {nameLength === "DOUBLE" ? "双字名重名率更低、更显雅致" : "单字名更响亮利落"}
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
                      title={!stylesSel.includes(s) && stylesSel.length >= 3 ? "最多选择 3 个风格" : undefined}
                      onClick={() => setStylesSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < 3 ? [...p, s] : p))}
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
                          // 分段互斥：切换分组清空其他组已选（组间类目不重叠）
                          setSourcesSel((p) => p.filter((x) => g.items.some(([c2]) => x === c2)));
                        }}
                        className={`${chips} flex-1 ${classicGroup === gi ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                      >
                        {g.name}{cnt ? ` · ${cnt}` : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classicGroups[classicGroup].items.map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => setSourcesSel((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]))}
                      className={`${chips} ${sourcesSel.includes(code) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink/45">可多选类目；切换分组会更换可选类目并清空已选</p>
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
              {surname.trim() || "＿"}家{gender === "M" ? "男" : "女"}宝宝 · {birthLabel}{placeName ? ` · ${shortPlace(placeName)}` : ""}
            </span>
            <span className="shrink-0 text-ink-faint">约 90 秒出 10 个方案</span>
          </div>

          {formErr ? <p className="text-xs text-vermilion-deep">{formErr}</p> : null}
          <button
            onClick={() => start(false)}
            className="hidden w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] md:block"
          >
            开始推演 · 消耗 {namingPrice} 点 · 单次 10 个名字
          </button>
          <p className="hidden text-center text-[11px] text-ink/50 md:block">未充值新用户首次免费体验（展示 3 个精选名字，充值解锁全部）</p>
        </section>

        {/* P1 移动端吸底提交（含安全区适配） */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper-2/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <button onClick={() => start(false)} className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]">
            开始推演 · 消耗 {namingPrice} 点 · 单次 10 个名字
          </button>
          <p className="mt-1 text-center text-[10px] text-ink/50">未充值新用户首次免费（展示 3 个精选名字）</p>
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
                    i < stageIdx ? "bg-ink text-paper" : i === stageIdx ? "bg-vermilion text-paper" : "bg-paper-3 text-ink-faint"
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
                  <span key={l} className="rounded-lg bg-paper px-2.5 py-1 text-sm font-medium tracking-widest ring-1 ring-ink/10">
                    <span className="mr-1 text-[10px] text-ink/45">{l}</span>{diagnosis.pillars?.[i] || "-"}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {stageIdx >= 1 && diagnosis?.primaryElement ? (
            <div className="mt-3 rounded-xl bg-paper-3/60 p-3 text-xs leading-relaxed text-ink-soft">
              喜用判定：日主{ELEMENT_ZH[diagnosis.dayMasterElement || ""]}·{STRENGTH_ZH[diagnosis.strength || ""]}，取{ELEMENT_ZH[diagnosis.primaryElement]}为主、{diagnosis.secondaryElement ? ELEMENT_ZH[diagnosis.secondaryElement] + "为辅" : ""}
              {diagnosis.climateElement ? `；调候喜${ELEMENT_ZH[diagnosis.climateElement]}（加分）` : ""}
            </div>
          ) : null}
          {typeof diagnosis?.poolSize === "number" && diagnosis.poolSize > 0 ? (
            <div className="mt-3 rounded-xl bg-paper-3/60 p-3 text-xs text-ink-soft">
              已按喜用五行与避讳筛出 <b className="text-vermilion-deep">{diagnosis.poolSize}</b> 个优选字，进入典籍推演…
            </div>
          ) : null}
          {aiDelta ? <p className="mt-4 truncate text-xs text-ink-faint">AI {aiDelta}</p> : null}
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
          <button onClick={() => start(false)} className="mt-4 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-paper">
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
                  <span className="rounded-full bg-amber-700/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-600/25">预产期推演</span>
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
                  <div key={i} className="rounded-xl bg-paper-3/70 px-1 py-1.5 text-center ring-1 ring-ink/5">
                    <p className="flex items-center justify-center gap-1 text-[10px] text-ink-faint">
                      <span className={`size-1.5 rounded-full ${ELEMENT_DOT[el] || "bg-ink/20"}`} />
                      {["年柱", "月柱", "日柱", "时柱"][i]}
                    </p>
                    <p className="mt-0.5 font-seal text-lg leading-relaxed tracking-[0.2em] text-ink">{pl}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* 五行分析：核心结论胶囊 + 能量刻度 */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 font-medium">
              <span className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.dayMasterElement || ""] || "bg-ink/25"}`} />
              日主 {ELEMENT_ZH[diagnosis.dayMasterElement || ""] || "-"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-paper-3 px-3 py-1.5">
              {STRENGTH_ZH[diagnosis.strength || ""] || "-"}
              {(() => {
                const m = /能量指数\s*(\d+)%/.exec(diagnosis.reason || "");
                if (!m) return null;
                const pct = Math.min(100, Math.max(0, Number(m[1])));
                return (
                  <>
                    <span className="inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-ink/10">
                      <span className="h-full rounded-full bg-vermilion/70" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="tabular-nums text-[11px] text-ink-faint">{pct}%</span>
                  </>
                );
              })()}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 font-medium">
              喜用
              <span className="inline-flex items-center gap-1">
                <span className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.primaryElement || ""] || "bg-ink/25"}`} />
                {ELEMENT_ZH[diagnosis.primaryElement || ""] || "-"}主
              </span>
              {diagnosis.secondaryElement ? (
                <span className="inline-flex items-center gap-1">
                  <span className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.secondaryElement] || "bg-ink/25"}`} />
                  {ELEMENT_ZH[diagnosis.secondaryElement] || "-"}辅
                </span>
              ) : null}
            </span>
            {diagnosis.climateElement ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1.5 text-ink-soft">
                <span className={`size-2 rounded-full ${ELEMENT_DOT[diagnosis.climateElement] || "bg-ink/25"}`} />
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
            <p className="mt-3 border-t border-ink/5 pt-2.5 text-[11px] leading-relaxed text-ink-faint">{diagnosis.reason}</p>
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
                  title={passInfo.passType === "MONTH" ? "包月畅享：30 天内生成与换一批不限次" : "畅享中：24 小时内生成与换一批不限次"}
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
                className="rounded-lg bg-paper-3 px-2 py-1 text-xs ring-1 ring-ink/10"
              >
                <option value="recommend">按推荐指数</option>
                <option value="phonetics">按音律韵味</option>
                <option value="culture">按文化底蕴</option>
                <option value="zodiac">按生肖契合</option>
              </select>
              <label className="flex items-center gap-1 text-ink-soft">
                <input type="checkbox" checked={onlyCited} onChange={(e) => setOnlyCited(e.target.checked)} />
                只看有出处
              </label>
              <button
                onClick={() => { track("compare_toggle", { on: !compareMode }); setCompareMode(!compareMode); setCompareSel([]); }}
                className={`rounded-full px-2.5 py-1 font-medium ring-1 ${compareMode ? "bg-ink text-paper ring-ink" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
              >
                {compareMode ? "退出对比" : `对比${compareSel.length ? `(${compareSel.length})` : ""}`}
              </button>
            </div>
          </div>
          {shortlist.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 px-4 py-2.5 text-xs ring-1 ring-ink/5">
              <span className="text-ink/50">我的短名单（{shortlist.length}）</span>
              {shortlist.map((nm) => (
                <button key={nm} onClick={() => toggleShortlist(nm)} title="点击移除"
                  className="inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-2.5 py-1 font-medium text-vermilion-deep ring-1 ring-vermilion/25">
                  {nm}
                  <X aria-hidden className="size-3" />
                </button>
              ))}
            </div>
          ) : null}
          {compareMode ? (
            <div className="mt-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              {compareSel.length < 2 ? (
                <p className="text-xs text-ink-soft">在下方名字卡勾选 2~3 个名字进入对比（已选 {compareSel.length}）</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="text-ink-soft">
                    <MultiRadar items={compareSel.map((nm, i) => ({
                      name: nm,
                      scores: cards.find((c) => c.name === nm)?.dimensionScores || {},
                      color: ["#9E2B25", "#1D5B4F", "#8A6D1F"][i % 3],
                    }))} />
                    <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px]">
                      {compareSel.map((nm, i) => (
                        <span key={nm} className="flex items-center gap-1">
                          <span className="size-2 rounded-full" style={{ background: ["#9E2B25", "#1D5B4F", "#8A6D1F"][i % 3] }} />{nm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-ink/8">
                        {[
                          ["推荐指数", (c: NameCardData) => c.recommendScore ?? "-"],
                          ["音律韵味", (c: NameCardData) => c.dimensionScores?.phonetics ?? "-"],
                          ["文化底蕴", (c: NameCardData) => c.dimensionScores?.culture ?? "-"],
                          ["生肖契合", (c: NameCardData) => c.dimensionScores?.zodiac ?? "-"],
                          ["三才", (c: NameCardData) => c.sanCai || "-"],
                          ["人格/总格", (c: NameCardData) => `${c.renGe ?? "-"}/${c.zongGe ?? "-"}`],
                          ["典籍出处", (c: NameCardData) => c.classicSource || "无"],
                          ["方言检测", (c: NameCardData) => (c.dialectCheckPassed === undefined ? "-" : c.dialectCheckPassed ? "通过" : "有提示")],
                        ].map(([label, fn]) => (
                          <tr key={label as string}>
                            <th className="w-20 py-2 pr-2 font-normal text-ink/50">{label as string}</th>
                            {compareSel.map((nm) => (
                              <td key={nm} className="py-2 pr-3 font-medium">{(fn as (c: NameCardData) => string | number)(cards.find((c) => c.name === nm)!)}</td>
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
                onCompare={() => setCompareSel((p) => p.includes(c.name) ? p.filter((x) => x !== c.name) : p.length < 3 ? [...p, c.name] : p)}
                onListen={() => { track("name_listen", { name: c.name }); speakName(c.name); }}
                onShortlist={() => toggleShortlist(c.name)}
                shortlisted={shortlist.includes(c.name)}
                onPoster={async () => {
                  setPosterBusy(true);
                  try {
                    const url = await buildPoster(c, infoLine, diagLine);
                    setPoster({ name: c.name, url });
                    track("poster_open", { name: c.name });
                  } catch { /* 忽略：canvas 异常 */ }
                  finally { setPosterBusy(false); }
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
                <div key={"lock" + i} className="relative min-h-56 overflow-hidden rounded-2xl bg-paper-2 ring-1 ring-ink/5">
                  <div className="space-y-2 p-5 blur-[6px]" aria-hidden>
                    <div className="h-7 w-24 rounded bg-ink/10" />
                    <div className="h-3 w-40 rounded bg-ink/8" />
                    <div className="h-3 w-28 rounded bg-ink/8" />
                    <div className="h-16 rounded-xl bg-ink/6" />
                  </div>
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-paper/45 backdrop-blur-[2px]">
                    <img src="/mp-qrcode.jpg" alt="对脉名鉴小程序码" className="size-24 rounded-lg bg-paper p-1 ring-1 ring-ink/10" />
                    <p className="text-sm font-semibold text-vermilion-deep">充值解锁全部 {diagnosis?.lockedCount} 个名字</p>
                    <p className="px-6 text-center text-[11px] leading-relaxed text-ink-soft">
                      微信扫码进入「对脉名鉴」小程序充值<br />点数网页端与小程序通用，登录同一账号即可
                    </p>
                  </div>
                </div>
              ))
            : null}

          {picking ? (
            <p className="mt-5 text-center text-xs text-ink-soft">已选 {picked.length}/5，勾选 3~5 个名字发起投票</p>
          ) : null}

          <div className="mt-4 flex gap-3">
            {picking ? (
              <>
                <button onClick={() => setPicking(false)} className="flex-1 rounded-xl bg-paper-3 py-3 text-sm font-medium text-ink ring-1 ring-ink/10">
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
                <button onClick={() => setPicking(true)} className="flex-1 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper">
                  发起亲友投票
                </button>
              </>
            )}
          </div>

          {!trial ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm font-medium">对这批名字不满意？</p>
              <p className="text-xs text-ink-soft">
                「换一批」自动排除已看过的名字{passInfo?.active ? " · 畅享期内不限次" : ` · 每次再付 ${namingPrice} 点`} · 勾选 3~5 个还可发起亲友投票
              </p>
              <div className="mt-1 flex items-center gap-4">
                <button
                  onClick={() => {
                    document.getElementById("naming-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-xs font-medium text-vermilion-deep underline underline-offset-2"
                >
                  调整偏好再来一轮 →
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://www.oracle.duimai.net/naming`);
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
                剩余 {diagnosis?.lockedCount ?? 0} 个精选名字待解锁 · 解锁后可「换一批」继续推演<br />
                前往「对脉名鉴」微信小程序 → 我的 → 点数充值
              </p>
            </div>
          )}

          {voteLink ? (
            <section className="mt-5 rounded-2xl bg-vermilion/10 p-5 ring-1 ring-vermilion/20">
              <p className="text-sm font-semibold text-vermilion-deep">投票链接已生成</p>
              <p className="mt-2 break-all rounded-lg bg-paper px-3 py-2 text-xs text-ink ring-1 ring-ink/10">{voteLink}</p>
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
              <button onClick={() => setUpgradeOpen(false)} className="text-ink/50 hover:text-ink" title="关闭">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-600/25">
                <p className="text-[11px] font-medium text-amber-800">24 小时畅享</p>
                <p className="mt-0.5 text-xl font-bold text-amber-900">¥{((passInfo?.dayPriceFen ?? 3990) / 100).toFixed(1)}</p>
                <p className="mt-1 text-[11px] leading-snug text-ink-soft">当日不限次生成与换批</p>
              </div>
              <div className="rounded-xl bg-paper-3 p-3 ring-1 ring-ink/10">
                <p className="text-[11px] font-medium text-ink-soft">包月畅享</p>
                <p className="mt-0.5 text-xl font-bold text-ink">¥{((passInfo?.monthPriceFen ?? 9900) / 100).toFixed(0)}</p>
                <p className="mt-1 text-[11px] leading-snug text-ink-soft">30 天不限次，适合慢慢挑</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-paper-3/60 p-3">
              <img src="/mp-qrcode.jpg" alt="对脉名鉴小程序码" className="size-20 shrink-0 rounded-lg bg-paper ring-1 ring-ink/10" />
              <p className="text-[11px] leading-relaxed text-ink-soft">
                微信扫码进入「对脉名鉴」小程序，在「我的-充值」页选择畅享卡/包月支付；权益与点数登录同一账号通用。
              </p>
            </div>
            {upgradeMode === "locked" ? (
              <button
                onClick={() => { setUpgradeOpen(false); start(false); }}
                className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
              >
                或再付 {namingPrice} 点生成新一批（不排除已看过）
              </button>
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
              <button onClick={() => setPoster(null)} className="text-ink/50 hover:text-ink" title="关闭">
                <X className="size-4" />
              </button>
            </div>
            <img src={poster.url} alt={`起名海报 ${poster.name}`} className="mt-3 max-h-[64vh] w-full rounded-xl object-contain" />
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
                      const file = new File([blob], `起名海报_${poster.name}.png`, { type: "image/png" });
                      if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ files: [file], title: `起名海报 ${poster.name}` });
                      } else {
                        await navigator.share({ title: `起名海报 ${poster.name}`, text: `为「${poster.name}」生成的起名海报`, url: "https://www.oracle.duimai.net/naming" });
                      }
                    } catch { /* 用户取消或浏览器不支持 */ }
                  }}
                  className="flex-1 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper"
                >
                  分享
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-center text-[11px] text-ink/45">长按图片也可保存或转发（手机端）</p>
          </div>
        </div>
      ) : null}
      {posterBusy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <p className="rounded-xl bg-paper px-5 py-3 text-sm text-ink shadow-lg">海报生成中…</p>
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
  // 名字 = 姓(1~2字) + 名;charElements 对应名字部分
  const givenStart = Math.max(1, c.name.length - (c.charElements?.length || 2));
  const chars = useMemo(
    () =>
      c.name.slice(givenStart).split("").map((ch, i) => ({ ch, el: c.charElements?.[i] || "" })),
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
      cls: c.wugeWarning ? "text-amber-800 ring-amber-700/25 bg-amber-700/8" : "text-emerald-800 ring-emerald-800/15 bg-emerald-800/5",
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
      cls: c.homophoneSafe === false
        ? "text-vermilion-deep ring-vermilion/30 bg-vermilion/8"
        : "text-ink-soft ring-ink/10",
    },
  ];
  const toggleDetails = () => {
    if (!open) track("card_expand", { name: c.name });
    setOpen(!open);
  };

  return (
    <section
      className={`group relative rounded-2xl p-5 ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(158,43,37,0.12)] ${c.recommended ? "bg-gradient-to-b from-amber-50/80 to-paper-2 ring-2 ring-amber-600/45 hover:ring-amber-600/70" : "bg-paper-2 ring-ink/5 hover:ring-vermilion/30"}`}
      onClick={picking ? onPick : undefined}
    >
      {c.recommended ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-amber-700 px-2.5 py-0.5 text-[10px] font-semibold text-amber-50 shadow-sm">首选方案</span>
      ) : null}
      {compareMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onCompare?.(); }}
          className={`absolute right-4 top-4 z-10 grid size-5 place-items-center rounded-full text-[10px] ring-1 ${compareChecked ? "bg-ink text-paper ring-ink" : "bg-paper/70 text-ink-faint ring-ink/20"}`}
        >
          {compareChecked ? "✓" : ""}
        </button>
      ) : null}
      {picking ? (
        <span
          className={`absolute top-4 left-4 grid size-6 place-items-center rounded-full text-xs ring-1 ${
            picked ? "bg-vermilion text-paper ring-vermilion" : "bg-paper-3 text-transparent ring-ink/20"
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
                    className={`absolute -top-1 -right-2.5 rounded px-1 text-[9px] leading-4 ring-1 ${c.recommended
                      ? ELEMENT_CLS[el] || "bg-ink/80 text-paper ring-ink/30"
                      : ELEMENT_SOFT[el] || "bg-ink/10 text-ink-soft ring-ink/15"}`}
                  >
                    {ELEMENT_ZH[el] || ""}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs tracking-wide text-ink-soft">{c.pinyin}</p>

      {c.recommended ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-vermilion-deep">
            <span className="size-1.5 rounded-full bg-vermilion" />
            推荐{typeof c.recommendScore === "number" ? ` ${c.recommendScore}` : ""}
          </span>
          {c.recommendReason ? <span className="whitespace-nowrap text-ink-faint">· {c.recommendReason}</span> : null}
        </div>
      ) : null}

      {/* P1 亮点条：一词结论，点击展开详情；移动端横向滚动 */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {highlights.map((h) => (
          <button
            key={h.label}
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!open) toggleDetails(); }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper-3/70 px-2.5 py-1 transition-colors hover:bg-paper-3 ${h.cls}`}
          >
            <span className={`size-1.5 rounded-full ${h.dot}`} />
            {h.label}
            <span className="font-semibold tabular-nums">{h.value}</span>
          </button>
        ))}
      </div>

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
          ) : (
            <span
              title={c.sameClassicSource ? "两字同出一典（同句或同联上下句），逐字校验通过" : "校验规则：每字引文正文均包含该字，出处核验通过"}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.sameClassicSource ? "bg-amber-700/12 text-amber-800 ring-1 ring-amber-600/30" : "bg-emerald-800/10 text-emerald-800"}`}
            >
              {c.sameClassicSource ? "✦ 同出一联 · 字字有典" : "✓ 字字有典 · 已校验"}
            </span>
          )}
          {(c.sameClassicSource || c.originalCouplet) && c.charCitations.length >= 2 ? (
            // 同典/藏名联：整联一次展示（上下句分行），名字用字高亮
            <div className={`rounded-xl p-3 ${c.originalCouplet ? "bg-paper-3/60 ring-1 ring-ink/8" : "bg-paper-3/60"}`}>
              <div className="flex items-center gap-1.5">
                {c.charCitations.map((cc) => (
                  <span key={cc.char} className="grid size-6 place-items-center rounded-full bg-vermilion/10 text-xs font-semibold text-vermilion-deep ring-1 ring-vermilion/25">
                    {cc.char}
                  </span>
                ))}
                {c.classicMeaning ? (
                  <span className="ml-1 text-[11px] text-ink-faint">「{c.classicMeaning}」</span>
                ) : null}
              </div>
              {Array.from(new Set(c.charCitations.map((cc) => cc.citation))).map((t) => (
                <p key={t} className="mt-1.5 text-sm leading-loose text-ink">
                  {highlightNameChars(t, c.charCitations!.map((cc) => cc.char))}
                </p>
              ))}
              {c.charCitations[0].source ? (
                <p className="mt-1 text-xs font-medium text-vermilion-deep">「{c.charCitations[0].source}」</p>
              ) : null}
              {c.originalCouplet ? (
                <p className="mt-1 text-[10px] text-ink-faint">原创藏名联，非典籍原文</p>
              ) : null}
            </div>
          ) : (
            c.charCitations.map((cc) => (
              <div key={cc.char + cc.citation} className="flex items-start gap-2 rounded-xl bg-paper-3/60 p-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-vermilion/10 text-xs font-semibold text-vermilion-deep ring-1 ring-vermilion/25">
                  {cc.char}
                </span>
                <div className="min-w-0">
                  {cc.source ? <p className="text-xs font-medium text-vermilion-deep">「{cc.source}」</p> : null}
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
            <span title="校验规则：引文正文包含名字用字，出处核验通过" className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-800/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              ✓ 已校验 · 引文含名
            </span>
          ) : null}
          {c.classicSource ? <p className="text-xs font-medium text-vermilion-deep">「{c.classicSource}」</p> : null}
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.classicCitation}</p>
          {c.classicMeaning ? <p className="mt-1 text-[11px] text-ink-faint">「{c.classicMeaning}」</p> : null}
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
                        <div className="h-full rounded bg-vermilion-deep/70" style={{ width: `${v}%` }} />
                      </div>
                      <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-ink-soft">{v}</span>
                    </div>
                  );
                })}
                {c.fusionNote ? (
                  <p className="flex items-start gap-1.5 pt-0.5 text-[11px] leading-relaxed text-ink/55">
                    <Scale aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {c.fusionNote}
                  </p>
                ) : null}
                {c.wugeWarning ? <p className="text-[11px] leading-relaxed text-amber-700">· {c.wugeWarning}</p> : null}
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
                    <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">{ch}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {c.phoneticNotes?.length ? (
            <div className="flex flex-wrap gap-1">
              {c.phoneticNotes.map((n) => (
                <span key={n} className="rounded bg-vermilion/10 px-1.5 py-0.5 text-[10px] text-vermilion-deep">{n}</span>
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
            return <p className="text-[11px] text-amber-700">已通过普通话 + {passedCount} 方言谐音检测</p>;
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
              onClick={(e) => { e.stopPropagation(); onListen(); }}
              title="读音试听（连读两遍）"
              className="grid size-8 place-items-center rounded-full bg-paper-3 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
            >
              <Volume2 aria-hidden className="size-4" />
            </button>
          ) : null}
          {onPoster ? (
            <button
              onClick={(e) => { e.stopPropagation(); onPoster(); }}
              title="生成海报"
              className="grid size-8 place-items-center rounded-full bg-paper-3 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
            >
              <ImageIcon aria-hidden className="size-4" />
            </button>
          ) : null}
          {onShortlist ? (
            <button
              onClick={(e) => { e.stopPropagation(); onShortlist(); }}
              title={shortlisted ? "移出短名单" : "收藏到短名单"}
              className={`grid size-8 place-items-center rounded-full ring-1 transition-all hover:scale-105 ${shortlisted ? "bg-vermilion/10 text-vermilion ring-vermilion/35" : "bg-paper-3 text-ink/35 ring-ink/10 hover:text-vermilion-deep hover:ring-vermilion/40"}`}
            >
              <Heart aria-hidden className={`size-4 ${shortlisted ? "fill-current" : ""}`} />
            </button>
          ) : null}
          <button
            onClick={(e) => { e.stopPropagation(); toggleDetails(); }}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-paper-3 px-3 text-[11px] text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-vermilion-deep hover:ring-vermilion/40"
          >
            {open ? "收起详情 ▴" : "评分 · 数理 · 字义 ▾"}
          </button>
        </div>
      </div>
    </section>
  );
}
