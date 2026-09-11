import type { BaziPreviewData } from "@/components/bazi-preview-panel";

export interface BaziPerson {
  name: string;
  pillars: string[];
  dayMaster?: string | null;
}

/** 沉稳等级色板（低饱和，与宣纸暖调协调；环/徽章/数字同色呼应） */
const LEVEL_STYLE: Record<string, { badge: string; ring: string; number: string }> = {
  极佳: { badge: "bg-emerald-800/10 text-emerald-800 ring-emerald-800/30", ring: "#047857", number: "text-emerald-800" },
  良好: { badge: "bg-emerald-800/10 text-emerald-800 ring-emerald-800/30", ring: "#047857", number: "text-emerald-800" },
  中上: { badge: "bg-blue-800/10 text-blue-800 ring-blue-800/30", ring: "#1d4ed8", number: "text-blue-800" },
  一般: { badge: "bg-amber-800/10 text-amber-800 ring-amber-800/30", ring: "#b45309", number: "text-amber-800" },
  偏低: { badge: "bg-rose-800/10 text-rose-800 ring-rose-800/30", ring: "#be123c", number: "text-rose-800" },
};

/** 日主英文码 → 中文（Gui-Water → 癸水） */
const STEM_CN: Record<string, string> = {
  Jia: "甲", Yi: "乙", Bing: "丙", Ding: "丁", Wu: "戊",
  Ji: "己", Geng: "庚", Xin: "辛", Ren: "壬", Gui: "癸",
};
const ELEMENT_CN: Record<string, string> = {
  Wood: "木", Fire: "火", Earth: "土", Metal: "金", Water: "水",
};

function dayMasterZh(dm?: string | null): string {
  if (!dm) return "";
  const [stem, element] = dm.split("-");
  const s = STEM_CN[(stem || "").trim()];
  const e = ELEMENT_CN[(element || "").trim()];
  if (s && e) return `${s}${e}`;
  return dm;
}

function dayMasterDot(dm?: string | null): string {
  const zh = dayMasterZh(dm);
  const e = zh.slice(1, 2);
  return e === "木" ? "bg-emerald-600"
      : e === "火" ? "bg-rose-500"
      : e === "土" ? "bg-amber-600"
      : e === "金" ? "bg-yellow-700"
      : e === "水" ? "bg-blue-700"
      : "bg-ink/30";
}

function PillarColumn({ pillar }: { pillar: string }) {
  const [stem, branch] = [pillar.slice(0, 1), pillar.slice(1, 2)];
  return (
    <span className="flex w-10 flex-col items-center rounded-md bg-paper py-1 font-seal text-[14px] leading-snug text-ink ring-1 ring-vermilion/25">
      <span>{stem}</span>
      <span>{branch}</span>
    </span>
  );
}

function PersonCard({ person, side }: { person?: BaziPerson; side: "male" | "female" }) {
  const label = side === "male" ? "男方" : "女方";
  const dm = dayMasterZh(person?.dayMaster);
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-paper px-3 py-2.5 ring-1 ring-ink/5">
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 shrink-0 rounded-full ${dayMasterDot(person?.dayMaster)}`} />
        <p className="truncate text-sm font-semibold text-ink">{person?.name || label}</p>
        <span className="shrink-0 rounded-full bg-ink/5 px-1.5 text-[10px] text-ink-soft">{label}</span>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {(person?.pillars ?? ["——", "——", "——", "——"]).slice(0, 4).map((p, i) => (
          <PillarColumn key={i} pillar={p} />
        ))}
      </div>
      {dm ? (
        <p className="mt-2 text-center text-[10px] text-ink-soft">
          日主 <span className="font-seal text-ink">{dm.slice(0, 1)}</span>
          <span className="mx-0.5 text-ink-faint">·</span>属{dm.slice(1, 2)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 合婚结果英雄卡：双方四柱卡 + 「合」印章 + 综合指数大圆环 + 等级徽章 + 统计 chip。
 */
export function BaziResultHero({
  data,
  persons,
}: {
  data: BaziPreviewData;
  persons?: BaziPerson[];
}) {
  const style = LEVEL_STYLE[data.level] ?? LEVEL_STYLE["一般"];
  const R = 56;
  const C = 2 * Math.PI * R;
  const best = data.items.reduce((a, b) => (b.score > a.score ? b : a), data.items[0]);
  const worst = data.items.reduce((a, b) => (b.score < a.score ? b : a), data.items[0]);

  return (
    <section className="ink-in relative mt-7 overflow-hidden rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/10">
      <img
        src="/paper-grain.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply"
      />
      {/* 双方四柱 */}
      <div className="relative flex items-center gap-2">
        <PersonCard person={persons?.[0]} side="male" />
        <div className="grid shrink-0 place-items-center self-center px-0.5">
          <span className="grid size-9 place-items-center rounded-lg bg-vermilion font-seal text-lg text-paper shadow-sm ring-1 ring-vermilion-deep/30">
            合
          </span>
        </div>
        <PersonCard person={persons?.[1]} side="female" />
      </div>

      {/* 综合指数圆环（核心信息：环/数字/徽章同色呼应） */}
      <div className="relative mt-7 flex items-center justify-center gap-6">
        <div className="relative shrink-0">
          <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden>
            <circle cx="74" cy="74" r={R} fill="none" stroke="oklch(0.28 0.02 70 / 0.08)" strokeWidth="8" />
            <circle
              cx="74" cy="74" r={R} fill="none"
              stroke={style.ring} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(C * data.total) / 100} ${C}`}
              transform="rotate(-90 74 74)"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <p className={`text-5xl font-bold tabular-nums ${style.number}`}>{data.total}</p>
              <p className="mt-1.5 text-[10px] tracking-[0.2em] text-ink-faint">综合合婚指数</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 max-w-[15rem]">
          <span
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-base font-bold tracking-wider ring-1 ${style.badge}`}
          >
            {data.level}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{data.summary}</p>
        </div>
      </div>

      {/* 统计 chip：数据一行，免责单独降级 */}
      <div className="relative mt-6 flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="rounded-full bg-paper px-3 py-1 text-ink-soft ring-1 ring-ink/10">
          最强一项 · {best?.label} {best?.score}
        </span>
        <span className="rounded-full bg-paper px-3 py-1 text-ink-soft ring-1 ring-ink/10">
          最需关注 · {worst?.label} {worst?.score}
        </span>
      </div>
      <p className="relative mt-3 text-center text-[10px] text-ink-faint">
        评分为产品量化模型，仅供文化参考
      </p>
    </section>
  );
}
