import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { track } from "@/lib/track";
import { post } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { setupWxShare } from "@/lib/wx-share";
import QRCode from "qrcode";

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
}

const DIM_LABELS: [string, string][] = [
  ["bazi", "八字喜用"],
  ["wuge", "五格数理"],
  ["phonetics", "音律韵味"],
  ["culture", "文化底蕴"],
  ["zodiac", "生肖契合"],
];

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
  if (c.classicCitation) {
    g.strokeStyle = "rgba(158,43,37,.3)"; g.strokeRect(60, 360, W - 120, 128);
    g.fillStyle = ink; g.font = "26px serif";
    const cite = c.classicCitation.length > 26 ? c.classicCitation.slice(0, 26) + "…" : c.classicCitation;
    g.fillText(cite, W / 2, 412);
    g.fillStyle = accent; g.font = "20px sans-serif";
    g.fillText([c.classicSource, c.classicMeaning ? `「${c.classicMeaning}」` : ""].filter(Boolean).join("  "), W / 2, 456);
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
    birthTime: `${birthDate}T${birthTime}:00`,
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
    if (!birthDate) return setFormErr("请选择出生日期");
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
        } else if (ev.stage === "error") {
          setError(String(ev.message || ev.error || "生成失败，请重试"));
          setLoading(false);
          track("naming_generate_error");
        } else if ((ev.stage === "ai" || ev.stage === "ai_think") && ev.delta) {
          setAiDelta(String(ev.delta).slice(0, 60));
        }
      },
      onError: (e) => {
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
  const infoLine = `${surname}家${gender === "M" ? "男" : "女"}宝宝 · ${birthDate || "-"} ${birthTime || ""}${placeName ? ` · 出生于 ${placeName}` : ""}`;
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
      <PageHeader eyebrow="功能一" title="宝宝起名" desc="填写姓氏与生辰偏好，为孩子拟一组有来历、有数理的名字。" />

      {/* 表单 */}
      {!hasResult && !loading ? (
        <section id="naming-form" className="ink-in d1 mt-7 space-y-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓氏">
              <input
                className={inputCls}
                maxLength={4}
                placeholder="如：沈"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </Field>
            <Field label="性别">
              <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="F">女</option>
                <option value="M">男</option>
              </select>
            </Field>
            <Field label="出生日期">
              <input className={inputCls} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <Field label="出生时间">
              <input className={inputCls} type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </Field>
          </div>
          <Field label="出生地（输入关键词选择，用于真太阳时校正）">
            <BirthplaceInput
              lat={lat}
              lng={lng}
              onPick={(v) => {
                setLat(v.lat);
                setLng(v.lng);
                setPlaceName(v.place || "");
              }}
            />
          </Field>
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
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="指定用字（选填）">
              <input
                className={inputCls}
                maxLength={4}
                placeholder="名字首字固定为该字"
                value={generationChar}
                onChange={(e) => setGenerationChar(e.target.value)}
              />
            </Field>
            <Field label="避用字（选填）">
              <input
                className={inputCls}
                placeholder="如：伟, 强"
                value={tabooText}
                onChange={(e) => setTabooText(e.target.value)}
              />
            </Field>
          </div>
          <Field label="长辈避讳（选填，最多 8 位）">
            <input
              className={inputCls}
              maxLength={40}
              placeholder="祖辈/父母姓名，逗号分隔；同字同音自动规避"
              value={avoidText}
              onChange={(e) => setAvoidText(e.target.value)}
            />
          </Field>
          <Field label="风格偏好（选填，最多 3 个）">
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
          <Field label="典籍偏好（选填，限选一组）">
            <div className="flex gap-2">
              {classicGroups.map((g, gi) => {
                const cnt = g.items.filter(([c2]) => sourcesSel.includes(c2)).length;
                return (
                  <button
                    key={g.name}
                    onClick={() => {
                      setClassicGroup(gi);
                      // 分段互斥：切换分组清空其他组已选（组间类目不重叠）
                      setSourcesSel((p) => p.filter((x) => g.items.some(([c2]) => c2 === x)));
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
          {formErr ? <p className="text-xs text-vermilion-deep">{formErr}</p> : null}
          <button
            onClick={() => start(false)}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
          >
            开始推演 · 消耗 6 点 · 24h 内换一批免费
          </button>
          <p className="mt-2 text-center text-[11px] text-ink/50">未充值新用户首次免费体验（展示 3 个精选名字，充值解锁全部）</p>
        </section>
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

      {/* 五行分析 */}
      {diagnosis && hasResult ? (
        <section className="ink-in d1 mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <span>👶 {surname}家{gender === "M" ? "男" : "女"}宝宝</span>
            <span className="text-ink/30">·</span>
            <span className="text-ink-soft">{birthDate} {birthTime}</span>
            {placeName ? (<><span className="text-ink/30">·</span><span className="text-ink-soft">出生于 {placeName}</span></>) : null}
          </div>
          {diagnosis.pillars?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {diagnosis.pillars.map((pl, i) => (
                <span key={i} className="rounded bg-paper-3 px-2 py-0.5 text-xs tracking-widest">{["年", "月", "日", "时"][i]}·{pl}</span>
              ))}
            </div>
          ) : null}
          <h2 className="mt-4 text-base font-semibold">五行分析</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-paper-3 px-3 py-1.5">日主 · {ELEMENT_ZH[diagnosis.dayMasterElement || ""] || "-"}</span>
            <span className="rounded-full bg-paper-3 px-3 py-1.5">{STRENGTH_ZH[diagnosis.strength || ""] || "-"}</span>
            <span className="rounded-full bg-paper-3 px-3 py-1.5">
              喜用 · {(ELEMENT_ZH[diagnosis.primaryElement || ""] || "-") + "主"}
              {diagnosis.secondaryElement ? " · " + (ELEMENT_ZH[diagnosis.secondaryElement] || "") + "辅" : ""}
            </span>
          </div>
          {diagnosis.criticalBoundary?.note ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
              ⏱ {diagnosis.criticalBoundary.note}
            </p>
          ) : null}
          {diagnosis.avoidSummary ? (
            <p className="mt-2 text-xs text-ink/55">👪 {diagnosis.avoidSummary}</p>
          ) : null}
          {diagnosis.reason ? (
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{diagnosis.reason}</p>
          ) : null}
        </section>
      ) : null}

      {/* 名字卡 */}
      {hasResult ? (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">名字方案</h2>
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
                  className="rounded-full bg-vermilion/10 px-2.5 py-1 font-medium text-vermilion-deep ring-1 ring-vermilion/25">
                  {nm} ✕
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
                  {trial ? "充值解锁后可换一批" : `换一批${excludedCount ? `（已排除 ${excludedCount} 个）` : ""}`}
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
                「换一批」会自动排除已看过的名字继续推演 · 24 小时内免扣点 · 勾选 3~5 个还可发起亲友投票
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
              <button onClick={() => setPoster(null)} className="text-ink/50 hover:text-ink">✕</button>
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
}) {
  const [open, setOpen] = useState(false);
  // 名字 = 姓(1~2字) + 名;charElements 对应名字部分
  const givenStart = Math.max(1, c.name.length - (c.charElements?.length || 2));
  const chars = useMemo(
    () =>
      c.name.slice(givenStart).split("").map((ch, i) => ({ ch, el: c.charElements?.[i] || "" })),
    [c, givenStart],
  );

  return (
    <section
      className={`group relative rounded-2xl p-5 ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(158,43,37,0.12)] ${c.recommended ? "bg-gradient-to-b from-amber-50/80 to-paper-2 ring-vermilion/25 hover:ring-vermilion/45" : "bg-paper-2 ring-ink/5 hover:ring-vermilion/30"}`}
      onClick={picking ? onPick : undefined}
    >
      {c.recommended ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-vermilion px-2.5 py-0.5 text-[10px] font-semibold text-paper">今日主推</span>
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

      {c.recommended ? (
        <span className="absolute top-0 right-5 flex flex-col items-center rounded-b-lg bg-vermilion px-2 py-1.5 font-seal text-xs leading-tight text-paper">
          <span>推</span>
          <span>荐</span>
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
                    className={`absolute -top-1 -right-2.5 rounded px-1 text-[9px] leading-4 ${ELEMENT_CLS[el] || "bg-ink/80 text-paper"}`}
                  >
                    {ELEMENT_ZH[el] || ""}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs tracking-wide text-ink-soft">
        {c.pinyin}
        {onListen ? (
          <button onClick={(e) => { e.stopPropagation(); onListen(); }} title="读音试听（连读两遍）"
            className="text-ink/40 transition-colors hover:text-vermilion-deep">🔊</button>
        ) : null}
        {c.classicMeaning ? <span className="ml-auto text-[11px] text-vermilion-deep/80">「{c.classicMeaning}」</span> : null}
      </p>

      {c.recommended ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-vermilion-deep">
            <span className="size-1.5 rounded-full bg-vermilion" />
            推荐{typeof c.recommendScore === "number" ? ` ${c.recommendScore}` : ""}
          </span>
          {c.recommendReason ? <span className="whitespace-nowrap text-ink-faint">· {c.recommendReason}</span> : null}
        </div>
      ) : null}

      {c.dimensionScores && Object.keys(c.dimensionScores).length ? (
        <div className="mt-3 flex items-center gap-4 rounded-xl bg-paper-3/50 p-3 text-ink-soft">
          <div className="shrink-0 text-vermilion-deep/80">
            <DimRadar scores={c.dimensionScores} size={150} />
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
            {c.fusionNote ? <p className="pt-0.5 text-[11px] leading-relaxed text-ink/55">⚖ {c.fusionNote}</p> : null}
            {c.wugeWarning ? <p className="text-[11px] leading-relaxed text-amber-700">· {c.wugeWarning}</p> : null}
            {c.phoneticNotes?.length ? (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {c.phoneticNotes.map((n) => (
                  <span key={n} className="rounded bg-vermilion/10 px-1.5 py-0.5 text-[10px] text-vermilion-deep">{n}</span>
                ))}
              </div>
            ) : null}
            {c.dialectCheckPassed !== undefined ? (
              <p className={`pt-0.5 text-[11px] ${c.dialectCheckPassed ? "text-amber-700" : "text-vermilion-deep"}`}>
                {c.dialectCheckPassed
                  ? `已通过普通话 + ${(c.dialectChecks ?? []).filter((d) => d.status === "passed").length} 方言谐音检测`
                  : "方言谐音检测存在风险提示"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {wuge.length ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
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
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span>三才</span>
          {c.sanCai.split("").map((ch, i) => (
            <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">{ch}</span>
          ))}
        </div>
      ) : null}

      {c.classicCitation ? (
        <div className="mt-3 rounded-xl bg-paper-3/60 p-3">
          {c.classicVerified ? (
            <span title="校验规则：引文正文包含名字用字，出处核验通过" className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-800/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              ✓ 已校验 · 引文含名
            </span>
          ) : null}
          {c.classicSource ? <p className="text-xs font-medium text-vermilion-deep">「{c.classicSource}」</p> : null}
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.classicCitation}</p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className={`text-[11px] ${c.homophoneSafe === false ? "text-vermilion-deep" : "text-ink-faint"}`}>
          {c.homophoneSafe === false ? "⚠ " + (c.safetyNote || "谐音需留意") : "✓ 谐音安全"}
        </span>
        {onListen ? (
          <button onClick={(e) => { e.stopPropagation(); onListen(); }}
            className="ml-auto mr-3 text-[11px] text-ink-soft underline underline-offset-2">
            读音试听
          </button>
        ) : null}
        {onPoster ? (
          <button onClick={(e) => { e.stopPropagation(); onPoster(); }}
            className="mr-3 text-[11px] text-ink-soft underline underline-offset-2">
            生成海报
          </button>
        ) : null}
        {onShortlist ? (
          <button onClick={(e) => { e.stopPropagation(); onShortlist(); }} title="收藏到短名单"
            className={`mr-1 text-sm transition-transform hover:scale-110 ${shortlisted ? "text-vermilion" : "text-ink/30"}`}>
            {shortlisted ? "♥" : "♡"}
          </button>
        ) : null}
        {c.wuxingAnalysis ? (
          <button onClick={(e) => { e.stopPropagation(); if (!open) track("card_expand", { name: c.name }); setOpen(!open); }} className="text-[11px] text-ink-soft underline underline-offset-2">
            {open ? "收起字义" : "字义详解"}
          </button>
        ) : null}
      </div>
      {open && c.wuxingAnalysis ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">{c.wuxingAnalysis}</p>
      ) : null}
    </section>
  );
}
