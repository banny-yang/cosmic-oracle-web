import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { Heart, Zap, Quote } from "lucide-react";

/** 报告详情（GET /api/v1/reports/{id}）；摘要数据在 reportMetadataJson（流完成落库后可用） */
export interface ReportDetail {
  reportId: string;
  reportType: string;
  status: string;
  titleZh?: string | null;
  purchaseTime?: string | null;
  generatedAt?: string | null;
  riskLevel?: string | null;
  annualMantra?: string | null;
  reportMetadataJson?: string | null;
  partnerName?: string | null;
  partnerNames?: string[] | null;
  relationshipType?: string | null;
}

export function useReportDetail(reportId: string | null | undefined, ready: boolean) {
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  useEffect(() => {
    if (!reportId || !ready) return;
    let alive = true;
    get<ReportDetail>(`/api/v1/reports/${reportId}`, {}, { timeoutMs: 10000 })
      .then((d) => { if (alive && d?.status === "SUCCESS") setDetail(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [reportId, ready]);
  return detail;
}

function parseMeta(detail: ReportDetail | null): Record<string, unknown> | null {
  if (!detail?.reportMetadataJson) return null;
  try {
    const v = JSON.parse(detail.reportMetadataJson);
    return typeof v === "object" && v ? v : null;
  } catch { return null; }
}

const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseInt(v.replace("%", ""), 10); return Number.isFinite(n) ? n : null; }
  return null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function ringColor(score: number): string {
  return score >= 85 ? "#047857" : score >= 65 ? "#1d4ed8" : "#b45309";
}

/** 分数环（与合婚英雄卡同款式） */
function ScoreRing({ score, label }: { score: number; label: string }) {
  const R = 50, C = 2 * Math.PI * R;
  return (
    <div className="relative shrink-0">
      <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden>
        <circle cx="62" cy="62" r={R} fill="none" stroke="#2f271e" strokeOpacity="0.08" strokeWidth="7" />
        <circle cx="62" cy="62" r={R} fill="none" stroke={ringColor(score)} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(C * score) / 100} ${C}`} transform="rotate(-90 62 62)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <p className="text-4xl font-bold tabular-nums text-ink">{score}</p>
          <p className="mt-1 text-[9px] tracking-[0.18em] text-ink-faint">{label}</p>
        </div>
      </div>
    </div>
  );
}

function QuoteBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-xl bg-paper-2 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-vermilion-deep">
        <Quote className="size-3" />{title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`flex-1 rounded-xl px-3 py-2.5 text-center ${tone}`}>
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}

const LEVEL_ZH: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const RESONANCE_ZH: Record<string, string> = {
  harmonic_healing: "良性共振", neutral_balance: "中性平衡", malignant_excitation: "恶性亢奋",
};

/** 缘分伴侣匹配摘要卡（对齐 Flutter CompatibilitySummaryCard） */
export function CompatibilitySummaryCard({ detail }: { detail: ReportDetail | null }) {
  const meta = parseMeta(detail);
  if (!meta) return null;
  const score = num(meta.overall_harmony_rate) ?? num(detail?.riskLevel);
  if (score == null) return null;
  const attraction = str(meta.attraction_index) ?? "MEDIUM";
  const friction = str(meta.friction_index) ?? "MEDIUM";
  const tags = Array.isArray(meta.relational_tags) ? meta.relational_tags.map(String).filter(Boolean) : [];
  const mantra = str(meta.communication_key) ?? str(detail?.annualMantra);
  const attrTone = attraction === "HIGH" ? "bg-amber-50 text-amber-800"
    : attraction === "MEDIUM" ? "bg-stone-100 text-stone-700"
    : "bg-paper-3 text-ink-soft";
  const fricTone = friction === "HIGH" ? "bg-rose-50 text-rose-800"
    : friction === "MEDIUM" ? "bg-stone-100 text-stone-700"
    : "bg-emerald-50 text-emerald-800";
  return (
    <section className="ink-in mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
      <div className="flex items-center justify-center gap-5">
        <ScoreRing score={score} label="缘分契合度" />
        <div className="flex min-w-0 max-w-[15rem] flex-1 flex-col gap-2">
          <MetricTile label="吸引力" value={LEVEL_ZH[attraction] ?? attraction} tone={attrTone} />
          <MetricTile label="摩擦指数" value={LEVEL_ZH[friction] ?? friction} tone={fricTone} />
        </div>
      </div>
      {tags.length ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tags.slice(0, 8).map((t, i) => (
            <span key={i} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{t}</span>
          ))}
        </div>
      ) : null}
      {mantra ? <QuoteBox title="相处锦囊" text={mantra} /> : null}
    </section>
  );
}

/** 姓名共振摘要卡（对齐 Flutter NameSummaryCard） */
export function NameSummaryCard({ detail }: { detail: ReportDetail | null }) {
  const meta = parseMeta(detail);
  if (!meta) return null;
  const score = num(meta.average_pair_resonance_rate) ?? num(meta.pair_resonance_rate)
    ?? num(meta.bazi_deficiency_remedy_rate) ?? num(meta.resonance_compatibility_rate) ?? num(detail?.riskLevel);
  if (score == null) return null;
  const multi = Array.isArray(meta.partner_names) && meta.partner_names.length > 0;
  const names = multi
    ? meta.partner_names.map(String)
    : [str(meta.partner_name) ?? str(detail?.partnerName) ?? str(detail?.titleZh)].filter(Boolean) as string[];
  const best = str(meta.best_match_name);
  const chinese = str(meta.name_script) !== "western";
  const threeTalents = str(meta.three_talents);
  const destiny = num(meta.destiny_number), soul = num(meta.soul_urge_number), personality = num(meta.personality_number);
  const resonance = str(meta.resonance_type);
  const mantra = str(meta.energy_mantra) ?? str(detail?.annualMantra);
  return (
    <section className="ink-in mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
      <div className="flex items-center justify-center gap-5">
        <ScoreRing score={score} label={multi ? "平均姓名契合度" : names.length ? "双人姓名契合度" : "共振调候率"} />
        <div className="min-w-0 max-w-[15rem]">
          {names.map((n, i) => (
            <p key={i} className="mt-1 text-center text-xl font-semibold text-ink first:mt-0">{n}</p>
          ))}
          {multi && best ? (
            <p className="mt-2 text-center text-[13px] text-ink-soft">最佳匹配：{best}</p>
          ) : null}
        </div>
      </div>
      {chinese && threeTalents ? (
        <p className="mt-4 text-center text-sm text-ink-soft">
          <span className="text-ink-faint">三才配置</span>
          <span className="mx-2 font-seal text-base tracking-widest text-ink">{threeTalents}</span>
        </p>
      ) : destiny != null || soul != null || personality != null ? (
        <div className="mt-4 flex gap-2">
          {destiny != null ? <MetricTile label="表达数" value={String(destiny)} tone="bg-emerald-50 text-emerald-800" /> : null}
          {soul != null ? <MetricTile label="内心数" value={String(soul)} tone="bg-amber-50 text-amber-800" /> : null}
          {personality != null ? <MetricTile label="外在数" value={String(personality)} tone="bg-blue-50 text-blue-800" /> : null}
        </div>
      ) : null}
      {resonance ? (
        <p className="mt-3 text-center text-sm text-ink-soft">
          <span className="text-ink-faint">共振类型</span>
          <span className="ml-2 font-medium text-ink">{RESONANCE_ZH[resonance] ?? resonance.replace(/_/g, " ")}</span>
        </p>
      ) : null}
      {mantra ? <QuoteBox title="能量护身符心咒" text={mantra} /> : null}
    </section>
  );
}
