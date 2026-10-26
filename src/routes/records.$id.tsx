import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DimRadar } from "@/components/dim-radar";
import { ScanBuyPanel } from "@/components/scan-buy";
import { ApiError, get, post } from "@/lib/api";
import { getToken, getAuthUser } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { track } from "@/lib/track";
import { useFeaturePrice } from "@/lib/use-feature-price";
import { setupWxShare } from "@/lib/wx-share";
import type { ZodiacInfo } from "@/lib/zodiac-guide";
import { Copy, Lock, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/records/$id")({
  component: RecordDetail,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "方案详情 · 对脉名鉴" },
      { name: "description", content: "历史起名方案回放：出生五行分析与名字卡。" },
    ],
  }),
});

interface CharCitationData {
  char?: string;
  citation?: string;
  source?: string;
  composed?: boolean;
}

interface CardData {
  name: string;
  pinyin?: string;
  tones?: number[];
  charElements?: string[];
  classicCitation?: string;
  classicSource?: string;
  classicMeaning?: string;
  charCitations?: CharCitationData[];
  sameClassicSource?: boolean;
  surnameNote?: string;
  surnameSameSource?: boolean;
  surnameCitation?: string;
  twinGender?: string;
  wuxingAnalysis?: string;
  homophoneSafe?: boolean;
  safetyNote?: string;
  phoneticNotes?: string[];
  dialectChecks?: { dialect?: string; status?: string; note?: string }[];
  dialectCheckPassed?: boolean;
  polyphoneNotes?: string[];
  clicheChars?: string[];
  rareChars?: string[];
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
  zodiacHits?: { animal?: string; branch?: string; preferred?: string[]; forbidden?: string[]; note?: string } | null;
  fusionNote?: string;
  wugeWarning?: string;
  commonNameIndex?: number | null;
}

/** 落库的 result：新记录是完整响应对象，老记录是纯卡片数组（两种形态都兼容）。 */
interface ReportResult {
  cards?: CardData[];
  dayMasterElement?: string;
  strength?: string;
  primaryElement?: string;
  secondaryElement?: string;
  climateElement?: string;
  reason?: string;
  pillars?: string[];
  wuxingMatch?: boolean;
  avoidSummary?: string | null;
  criticalBoundary?: { type?: string; near?: string; minutes?: number; note?: string } | null;
  zodiacGuide?: ZodiacInfo | null;
  lockedCount?: number;
  unlockTip?: string;
  reportId?: string;
}

interface LogDetail {
  id: string;
  request?: { surname?: string; gender?: string; birthTime?: string; twin?: boolean };
  result?: ReportResult | CardData[] | null;
  created_at?: string;
  /** 试用态未解锁（后端按 trial_locked_count 裁掉了卡片，打开历史页不能绕过付费墙）。 */
  locked?: boolean;
  locked_count?: number;
}

interface UnlockResponse {
  unlocked?: boolean;
  charged?: number;
  passActive?: boolean;
  result?: ReportResult;
  cards?: CardData[];
}

const ELEMENT_ZH: Record<string, string> = { WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水" };
const STRENGTH_ZH: Record<string, string> = { STRONG: "身强", WEAK: "身弱", BALANCED: "中和" };
const GENDER_ZH: Record<string, string> = { M: "男宝", F: "女宝", U: "未定" };

const DIM_LABELS: [string, string][] = [
  ["bazi", "八字喜用"],
  ["wuge", "五格数理"],
  ["phonetics", "音律韵味"],
  ["culture", "文化底蕴"],
  ["zodiac", "生肖契合"],
];

/** 声调→平仄（1/2 为平，3/4 为仄）；无声调数据返回空串。 */
function pingzeOf(tones?: number[]): string {
  return (tones || []).map((t) => (t === 1 || t === 2 ? "平" : "仄")).join("");
}

/** 五格（仅渲染有值的项）。 */
function wugeOf(c: CardData) {
  return [
    { label: "天格", value: c.tianGe },
    { label: "人格", value: c.renGe },
    { label: "地格", value: c.diGe },
    { label: "外格", value: c.waiGe },
    { label: "总格", value: c.zongGe },
  ].filter((g): g is { label: string; value: number } => typeof g.value === "number");
}

/** 整份报告的可复制纯文本（按人读的顺序，不依赖页面结构）。 */
function buildReportText(opts: {
  surname: string;
  time: string;
  diag: ReportResult | null;
  cards: CardData[];
  locked: boolean;
  lockedCount: number;
}): string {
  const { surname, time, diag, cards, locked, lockedCount } = opts;
  const lines: string[] = ["对脉名鉴 · 取名方案（回放）"];
  const head = [surname ? `姓氏：${surname}` : "", time ? `生成于 ${time}` : ""].filter(Boolean);
  if (head.length) lines.push(head.join(" · "));
  if (diag) {
    const dx = [
      diag.dayMasterElement ? `日主 ${ELEMENT_ZH[diag.dayMasterElement] || "-"}` : "",
      diag.strength ? STRENGTH_ZH[diag.strength] || "" : "",
      diag.primaryElement
        ? `喜用 ${ELEMENT_ZH[diag.primaryElement] || "-"}主${
            diag.secondaryElement ? ` ${ELEMENT_ZH[diag.secondaryElement] || ""}辅` : ""
          }`
        : "",
      diag.climateElement ? `调候 ${ELEMENT_ZH[diag.climateElement] || ""}` : "",
    ].filter(Boolean);
    if (dx.length) lines.push("出生五行：" + dx.join(" · "));
    if (diag.pillars?.length) lines.push("四柱：" + diag.pillars.join(" "));
    if (diag.reason) lines.push("分析：" + diag.reason);
    const z = diag.zodiacGuide;
    if (z) {
      lines.push(
        `生肖用字：${z.ganzhi}${z.animal}年 · 宜 ${z.preferredRadicals.join("、") || "-"} · 忌 ${
          z.forbiddenRadicals.join("、") || "-"
        }`,
      );
    }
    if (diag.criticalBoundary?.note) lines.push("提示：" + diag.criticalBoundary.note);
    if (diag.avoidSummary) lines.push("避讳：" + diag.avoidSummary);
    if (diag.wuxingMatch === false) lines.push("说明：本次按典故优先，未按喜用五行筛字。");
  }
  lines.push("");

  cards.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.name}${c.pinyin ? `（${c.pinyin}）` : ""}`);
    const top = [
      c.recommended && c.recommendScore != null ? `推荐指数 ${c.recommendScore}` : "",
      c.recommendReason || "",
      c.twinGender ? GENDER_ZH[c.twinGender] || "" : "",
    ].filter(Boolean);
    if (top.length) lines.push("   " + top.join(" · "));
    const elements = (c.charElements || []).map((e) => ELEMENT_ZH[e] || e).filter(Boolean);
    if (elements.length || c.sanCai) {
      lines.push(
        "   " +
          [
            elements.length ? `用字五行：${elements.join(" ")}` : "",
            c.sanCai ? `三才：${c.sanCai}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
      );
    }
    const wuge = wugeOf(c);
    if (wuge.length) lines.push("   五格：" + wuge.map((g) => `${g.label} ${g.value}`).join(" / "));
    if (c.dimensionScores && Object.keys(c.dimensionScores).length) {
      lines.push(
        "   五维评分：" +
          DIM_LABELS.map(([k, label]) => `${label} ${c.dimensionScores?.[k] ?? "-"}`).join(" · "),
      );
    }
    if (c.classicCitation) {
      lines.push(`   典故：${c.classicSource ? `《${c.classicSource}》` : ""}「${c.classicCitation}」`);
    }
    if (c.charCitations?.length) {
      lines.push(
        "   逐字：" +
          c.charCitations
            .map(
              (cc) =>
                `${cc.char || ""} —${cc.composed ? "原创·藏名联" : cc.source || ""}「${cc.citation || ""}」`,
            )
            .join("；"),
      );
    }
    if (c.surnameSameSource && c.surnameCitation) {
      lines.push("   姓+名同出一句：「" + c.surnameCitation + "」");
    }
    if (c.surnameNote) lines.push("   姓+名：" + c.surnameNote);
    if (c.fusionNote) lines.push("   融通：" + c.fusionNote);
    if (c.wugeWarning) lines.push("   提示：" + c.wugeWarning);
    if (c.phoneticNotes?.length) lines.push("   音律：" + c.phoneticNotes.join(" · "));
    if (c.zodiacHits?.note) lines.push("   生肖：" + c.zodiacHits.note);
    if (c.wuxingAnalysis) lines.push("   字义：" + c.wuxingAnalysis);
    if (c.homophoneSafe === false) lines.push("   注意：" + (c.safetyNote || "谐音需留意"));
    if (c.commonNameIndex) {
      lines.push(`   重名：常见名榜单估算档位 ${c.commonNameIndex}（估算，非户籍重名实数）`);
    }
    lines.push("");
  });

  if (locked && lockedCount > 0) {
    lines.push(`（本报告还有 ${lockedCount} 个名字未解锁，解锁后可完整导出。）`);
  }
  lines.push("—— 评分为字义、音律、典籍、五行搭配等维度的综合参考，非命理断言；");
  lines.push("重名为公开榜单估算，非户籍重名实数。");
  return lines.join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 权限被拒或非安全上下文，走回退 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function RecordDetail() {
  const { id } = Route.useParams();
  // 与起名页同源（t_feature）：调价后解锁按钮上的点数同步
  const namingPrice = useFeaturePrice("BABY_NAMING", 10);
  const [cards, setCards] = useState<CardData[]>([]);
  const [diag, setDiag] = useState<ReportResult | null>(null);
  const [surname, setSurname] = useState("");
  const [time, setTime] = useState("");
  const [locked, setLocked] = useState(false);
  const [lockedCount, setLockedCount] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockErr, setUnlockErr] = useState("");
  const [unlockNotice, setUnlockNotice] = useState("");
  const [needRecharge, setNeedRecharge] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/records/" + id);
      return;
    }
    get<LogDetail>(`/api/v1/naming/my-logs/${id}`, { user_id: getAuthUser()?.userId })
      .then((d) => {
        const r = d?.result;
        if (Array.isArray(r)) {
          // 老记录只有卡片数组，没有五行分析
          setCards(r);
          setDiag(null);
        } else {
          setCards(r?.cards || []);
          setDiag(r ?? null);
        }
        setLocked(!!d?.locked);
        setLockedCount(d?.locked_count ?? 0);
        setSurname(d?.request?.surname || "");
        setTime(d?.created_at ? String(d.created_at).replace("T", " ").slice(0, 16) : "");
        setLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "记录加载失败");
        setLoaded(true);
      });
  }, [id]);

  /* 微信内分享卡片：本页是私密页（noindex），卡片链接改指公开起名页，把好友引到可体验的入口 */
  useEffect(() => {
    setupWxShare({
      title: `${surname || "宝宝"}的起名方案 · 对脉名鉴`,
      desc: "AI 六道工序为宝宝取一个好名字：字义出处、五格数理、五行补缺逐一把关。",
      link: "https://name.duimai.net/naming",
    });
  }, [surname]);

  async function handleUnlock() {
    if (unlocking) return;
    const uid = getAuthUser()?.userId;
    if (!uid) {
      location.href = "/login?redirect=" + encodeURIComponent("/records/" + id);
      return;
    }
    setUnlocking(true);
    setUnlockErr("");
    track("records_unlock_click", { lockedCount });
    try {
      const res = await post<UnlockResponse>(
        `/api/v1/naming/reports/${id}/unlock?user_id=${encodeURIComponent(uid)}`,
      );
      const full = res?.result;
      if (full?.cards?.length) {
        setCards(full.cards);
        setDiag(full);
      } else if (res?.cards?.length) {
        setCards(res.cards);
      }
      setLocked(false);
      setLockedCount(0);
      setNeedRecharge(false);
      setUnlockNotice(
        res?.charged && res.charged > 0
          ? `已解锁全部名字，扣 ${res.charged} 点`
          : "畅享卡期内，已免费解锁全部名字",
      );
      track("records_unlock_success", {
        charged: res?.charged ?? 0,
        cards: full?.cards?.length ?? res?.cards?.length ?? 0,
      });
      void refreshBalance();
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 402) {
        setNeedRecharge(true);
        setUnlockErr(e.message || "点数不足，充值后即可解锁");
        track("records_unlock_insufficient", {});
      } else {
        setUnlockErr(e instanceof Error ? e.message : "解锁失败，请稍后重试");
      }
      setUnlocking(false);
      return;
    }
    setUnlocking(false);
  }

  async function handleCopy() {
    const text = buildReportText({ surname, time, diag, cards, locked, lockedCount });
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    if (ok) track("records_copy", { cards: cards.length });
    setTimeout(() => setCopied("idle"), 2400);
  }

  const reportTextLength = useMemo(
    () => buildReportText({ surname, time, diag, cards, locked, lockedCount }).length,
    [surname, time, diag, cards, locked, lockedCount],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="历史方案"
        title={`${surname || "起名"}方案回放`}
        {...(time ? { desc: "生成于 " + time } : {})}
      />

      {error ? (
        <div className="mt-7 rounded-2xl bg-white p-8 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-vermilion-deep">{error}</p>
        </div>
      ) : !loaded ? (
        <div className="mt-7 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-paper-3" />
          ))}
        </div>
      ) : (
        <>
          {locked ? (
            <section className="ink-in d1 mt-7 rounded-2xl border border-vermilion/25 bg-white p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Lock aria-hidden className="size-4 text-vermilion-deep" />
                这份报告还有 {lockedCount} 个名字已生成、待解锁
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                不需要重新生成：解锁后同一份报告直接取回剩余名字，可反复打开、可复制带走。
                解锁按一次起名扣 {namingPrice} 点，畅享卡有效期内免费。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="rounded-xl bg-vermilion px-5 py-2 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  {unlocking ? "解锁中…" : `解锁全部 ${lockedCount} 个 · ${namingPrice} 点`}
                </button>
                {unlockErr ? <span className="text-xs text-vermilion-deep">{unlockErr}</span> : null}
              </div>
              {needRecharge ? (
                <div className="mt-4 border-t border-vermilion/15 pt-4">
                  <ScanBuyPanel trackWhere="records_unlock" />
                </div>
              ) : null}
            </section>
          ) : unlockNotice ? (
            <p className="mt-6 rounded-xl bg-vermilion-wash px-4 py-2.5 text-xs font-medium text-vermilion-deep">
              {unlockNotice}
            </p>
          ) : null}

          {diag ? (
            <section className="ink-in d1 mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">出生五行分析</h2>
                {diag.wuxingMatch === false ? (
                  <span className="text-[11px] text-ink-faint">本次按典故优先，未按喜用筛字</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-paper-3 px-3 py-1.5">
                  日主 · {ELEMENT_ZH[diag.dayMasterElement || ""] || "-"}
                </span>
                <span className="rounded-full bg-paper-3 px-3 py-1.5">
                  {STRENGTH_ZH[diag.strength || ""] || "-"}
                </span>
                <span className="rounded-full bg-paper-3 px-3 py-1.5">
                  喜用 · {(ELEMENT_ZH[diag.primaryElement || ""] || "-") + "主"}
                  {diag.secondaryElement ? " · " + (ELEMENT_ZH[diag.secondaryElement] || "") + "辅" : ""}
                </span>
                {diag.climateElement ? (
                  <span className="rounded-full bg-paper-3 px-3 py-1.5">
                    调候 · {ELEMENT_ZH[diag.climateElement] || "-"}
                  </span>
                ) : null}
                {diag.pillars?.length ? (
                  <span className="rounded-full bg-paper-3 px-3 py-1.5">四柱 · {diag.pillars.join(" ")}</span>
                ) : null}
              </div>
              {diag.reason ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">{diag.reason}</p> : null}
              {diag.zodiacGuide ? (
                <div className="mt-3 rounded-xl bg-paper-3 p-3">
                  <p className="text-xs font-medium text-ink">
                    {diag.zodiacGuide.ganzhi}
                    {diag.zodiacGuide.animal}年用字宜忌
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    {diag.zodiacGuide.preferredRadicals.length ? (
                      <span className="rounded bg-white px-2 py-0.5 text-emerald-800">
                        宜 {diag.zodiacGuide.preferredRadicals.join("、")}
                      </span>
                    ) : null}
                    {diag.zodiacGuide.forbiddenRadicals.length ? (
                      <span className="rounded bg-white px-2 py-0.5 text-amber-800">
                        忌 {diag.zodiacGuide.forbiddenRadicals.join("、")}
                      </span>
                    ) : null}
                  </div>
                  {diag.zodiacGuide.note ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{diag.zodiacGuide.note}</p>
                  ) : null}
                </div>
              ) : null}
              {diag.criticalBoundary?.note ? (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800">
                  <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {diag.criticalBoundary.note}
                </p>
              ) : null}
              {diag.avoidSummary ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{diag.avoidSummary}</p>
              ) : null}
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">
              名字方案
              <span className="ml-2 text-xs font-normal text-ink-faint">
                {cards.length} 个{locked ? ` · 另有 ${lockedCount} 个待解锁` : ""}
              </span>
            </h2>
            <button
              onClick={handleCopy}
              disabled={!cards.length}
              className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-vermilion-wash hover:text-vermilion-deep disabled:opacity-50"
            >
              <Copy aria-hidden className="size-3.5" />
              {copied === "ok" ? "已复制" : copied === "fail" ? "复制失败" : "复制全部方案"}
            </button>
          </div>
          {copied === "fail" ? (
            <p className="mt-1.5 text-[11px] text-vermilion-deep">
              浏览器不允许自动复制，可长按选中页面内容手动复制（纯文本约 {reportTextLength} 字）。
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <CardBlock key={c.name} c={c} />
            ))}
          </div>

          {locked ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center transition-colors hover:bg-vermilion-wash">
              <p className="text-sm font-medium">还有 {lockedCount} 个名字已生成</p>
              <p className="text-xs text-ink-soft">解锁后回到这份报告即可看全，不必重新生成再付一次。</p>
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="mt-1 rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
              >
                {unlocking ? "解锁中…" : `解锁全部 ${lockedCount} 个 · ${namingPrice} 点`}
              </button>
              {unlockErr ? <p className="text-xs text-vermilion-deep">{unlockErr}</p> : null}
            </div>
          ) : null}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-faint">
            评分为字义、音律、典籍、五行搭配等维度的综合参考，非命理断言；重名为公开榜单估算，非户籍重名实数。
            <br />
            <a href="/naming" className="text-vermilion-deep underline-offset-2 hover:underline">
              再起一批新名字
            </a>
          </p>
        </>
      )}
    </AppShell>
  );
}

/** 单张名字卡：结论层（名字/推荐/五行/三才/五格/雷达）+ 依据层（典故/逐字/音律/生肖/字义）。 */
function CardBlock({ c }: { c: CardData }) {
  const wuge = wugeOf(c);
  const pingze = pingzeOf(c.tones);
  const blocked = (c.dialectChecks ?? []).filter((d) => d.status === "blocked" || d.status === "skipped");
  const passedDialects = (c.dialectChecks ?? []).filter((d) => d.status === "passed").length;

  return (
    <section className="relative rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
      {c.recommended ? (
        <span className="absolute top-0 right-5 flex flex-col items-center rounded-b-lg bg-vermilion px-2 py-1.5 font-seal text-xs leading-tight text-paper">
          <span>推</span>
          <span>荐</span>
        </span>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-seal text-3xl text-ink">{c.name}</p>
        {c.pinyin ? (
          <p className="text-xs text-ink-soft">
            {c.pinyin}
            {pingze ? <span className="ml-1.5 text-ink-faint">{pingze}</span> : null}
          </p>
        ) : null}
        {c.twinGender ? (
          <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] text-ink-soft">
            {GENDER_ZH[c.twinGender] || c.twinGender}
          </span>
        ) : null}
      </div>

      {c.recommended && (c.recommendScore != null || c.recommendReason) ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span className="size-1.5 rounded-full bg-vermilion" />
          {c.recommendScore != null ? (
            <span className="font-semibold text-vermilion-deep">推荐指数 {c.recommendScore}</span>
          ) : null}
          {c.recommendReason ? <span className="text-ink-faint">· {c.recommendReason}</span> : null}
        </p>
      ) : null}

      {c.charElements?.length || c.sanCai ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {c.charElements?.length ? (
            <span className="flex items-center gap-1 text-ink-soft">
              用字五行
              {c.charElements.map((e, i) => (
                <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">
                  {ELEMENT_ZH[e] || e}
                </span>
              ))}
            </span>
          ) : null}
          {c.sanCai ? (
            <span className="flex items-center gap-1 text-ink-soft">
              三才
              {c.sanCai.split("").map((ch, i) => (
                <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">
                  {ch}
                </span>
              ))}
            </span>
          ) : null}
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

      {c.dimensionScores && Object.keys(c.dimensionScores).length ? (
        <div className="mt-3 flex items-center gap-4 rounded-xl bg-paper-3 p-3 text-ink-soft">
          <div className="shrink-0 text-vermilion-deep">
            <DimRadar
              axes={DIM_LABELS.map(([k, label]) => ({ label, score: c.dimensionScores?.[k] ?? 60 }))}
              size={124}
              className="mx-auto"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {DIM_LABELS.map(([k, label]) => {
              const v = Math.min(100, Math.max(0, c.dimensionScores?.[k] ?? 60));
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-ink-soft">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/70">
                    <div className="h-full rounded bg-vermilion-deep" style={{ width: `${v}%` }} />
                  </div>
                  <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-ink-soft">
                    {v}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {c.classicCitation ? (
        <div className="mt-3 rounded-xl bg-paper-3 p-3">
          {c.classicSource ? (
            <p className="text-xs font-medium text-vermilion-deep">
              「{c.classicSource}」
              {c.classicMeaning ? (
                <span className="ml-1 font-normal text-ink-faint">「{c.classicMeaning}」</span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.classicCitation}</p>
        </div>
      ) : null}

      {c.charCitations?.length ? (
        <div className="mt-2 space-y-1.5">
          {c.charCitations.map((cc, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-vermilion-wash font-seal text-xs text-vermilion-deep">
                {cc.char || "·"}
              </span>
              <span className="min-w-0 text-ink-soft">
                {cc.composed ? <span className="text-vermilion-deep">原创·藏名联</span> : cc.source}
                {cc.citation ? <span className="text-ink-faint">「{cc.citation}」</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {c.surnameSameSource && c.surnameCitation ? (
        <p className="mt-2 rounded-xl bg-vermilion-wash px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
          <span className="text-vermilion-deep">姓与名同出一句</span>「{c.surnameCitation}」
        </p>
      ) : null}

      {c.surnameNote ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          <span className="text-ink-soft">姓+名 ·</span> {c.surnameNote}
        </p>
      ) : null}

      {c.fusionNote ? <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{c.fusionNote}</p> : null}
      {c.wugeWarning ? <p className="mt-2 text-[11px] leading-relaxed text-amber-700">· {c.wugeWarning}</p> : null}

      {c.phoneticNotes?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.phoneticNotes.map((n) => (
            <span key={n} className="rounded bg-vermilion-wash px-1.5 py-0.5 text-[10px] text-vermilion-deep">
              {n}
            </span>
          ))}
        </div>
      ) : null}

      {c.zodiacHits?.note ? (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{c.zodiacHits.note}</p>
      ) : null}

      {blocked.length ? (
        <div className="mt-2 text-[11px] leading-relaxed text-vermilion-deep">
          <p>方言谐音检测存在风险提示</p>
          <ul className="mt-0.5 list-none space-y-0.5 text-ink-soft">
            {blocked.map((d) => (
              <li key={d.dialect}>
                {d.dialect}：{d.status === "blocked" ? d.note || "存在风险谐音" : "数据建设中，未覆盖"}
              </li>
            ))}
          </ul>
        </div>
      ) : passedDialects > 0 ? (
        <p className="mt-2 text-[11px] text-amber-700">已通过普通话 + {passedDialects} 方言谐音检测</p>
      ) : null}

      {c.wuxingAnalysis ? (
        <p className="mt-3 border-t border-vermilion/10 pt-3 text-xs leading-relaxed text-ink-soft">
          <span className="mr-1 font-medium text-ink">字义详解</span>
          {c.wuxingAnalysis}
        </p>
      ) : null}

      {c.polyphoneNotes?.length ? (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{c.polyphoneNotes.join("；")}</p>
      ) : null}
      {c.clicheChars?.length ? (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          近年高频用字：{c.clicheChars.join("、")}
        </p>
      ) : null}
      {c.rareChars?.length ? (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          生僻倾向用字：{c.rareChars.join("、")}
        </p>
      ) : null}
      {c.commonNameIndex ? (
        <p
          className="mt-1 text-[11px] leading-relaxed text-ink-faint"
          title="基于公开常见名榜单估算，非户籍重名实数"
        >
          重名档位 {c.commonNameIndex}（估算，非户籍重名实数）
        </p>
      ) : null}

      {c.homophoneSafe === false ? (
        <p className="mt-3 flex items-start gap-1 text-[11px] leading-snug text-vermilion-deep">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {c.safetyNote || "谐音需留意"}
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-ink-faint">✓ 谐音安全</p>
      )}
    </section>
  );
}
