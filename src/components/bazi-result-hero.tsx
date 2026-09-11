import type { BaziPreviewData } from "@/components/bazi-preview-panel";

export interface BaziPerson {
  name: string;
  pillars: string[];
  dayMaster?: string | null;
}

const LEVEL_STYLE: Record<string, { text: string; badge: string; ring: string }> = {
  极佳: { text: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30", ring: "#059669" },
  良好: { text: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30", ring: "#059669" },
  中上: { text: "text-sky-600", badge: "bg-sky-500/10 text-sky-600 ring-sky-500/30", ring: "#0284c7" },
  一般: { text: "text-amber-600", badge: "bg-amber-500/10 text-amber-600 ring-amber-500/30", ring: "#d97706" },
  偏低: { text: "text-rose-500", badge: "bg-rose-500/10 text-rose-500 ring-rose-500/30", ring: "#e11d48" },
};

/** 日主五行色点（甲乙木/丙丁火/戊己土/庚辛金/壬癸水） */
function dayMasterDot(dm?: string | null): string {
  const c = (dm || "").slice(0, 1);
  return "甲乙".includes(c) ? "bg-emerald-500"
      : "丙丁".includes(c) ? "bg-rose-500"
      : "戊己".includes(c) ? "bg-amber-500"
      : "庚辛".includes(c) ? "bg-yellow-600"
      : "壬癸".includes(c) ? "bg-sky-500"
      : "bg-ink/30";
}

function PillarColumn({ pillar }: { pillar: string }) {
  const [stem, branch] = [pillar.slice(0, 1), pillar.slice(1, 2)];
  return (
    <span className="flex flex-col items-center rounded-md bg-paper px-1.5 py-1 font-seal text-[13px] leading-tight text-ink ring-1 ring-ink/10">
      <span>{stem}</span>
      <span>{branch}</span>
    </span>
  );
}

function PersonCard({ person, side }: { person?: BaziPerson; side: "male" | "female" }) {
  const label = side === "male" ? "男方" : "女方";
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-paper p-3 ring-1 ring-ink/5">
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dayMasterDot(person?.dayMaster)}`} />
        <p className="truncate text-sm font-semibold text-ink">{person?.name || label}</p>
        <span className="shrink-0 rounded-full bg-ink/5 px-1.5 text-[10px] text-ink-soft">{label}</span>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {(person?.pillars ?? ["—", "—", "—", "—"]).slice(0, 4).map((p, i) => (
          <PillarColumn key={i} pillar={p} />
        ))}
      </div>
      {person?.dayMaster ? (
        <p className="mt-1.5 text-center text-[10px] text-ink-faint">日主 {person.dayMaster}</p>
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
  const R = 52;
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
      <div className="relative flex items-stretch gap-2">
        <PersonCard person={persons?.[0]} side="male" />
        <div className="grid shrink-0 place-items-center px-0.5">
          <span className="grid size-9 place-items-center rounded-lg bg-vermilion font-seal text-lg text-paper shadow-sm ring-1 ring-vermilion-deep/30">
            合
          </span>
        </div>
        <PersonCard person={persons?.[1]} side="female" />
      </div>

      {/* 综合指数圆环 */}
      <div className="relative mt-5 flex items-center justify-center gap-5">
        <div className="relative">
          <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
            <circle cx="66" cy="66" r={R} fill="none" stroke="oklch(0.28 0.02 70 / 0.08)" strokeWidth="7" />
            <circle
              cx="66" cy="66" r={R} fill="none"
              stroke={style.ring} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${(C * data.total) / 100} ${C}`}
              transform="rotate(-90 66 66)"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <p className="text-4xl font-bold tabular-nums text-ink">{data.total}</p>
              <p className="mt-1 text-[10px] tracking-widest text-ink-faint">综合合婚指数</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 max-w-[16rem]">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ${style.badge}`}>
            {data.level}
          </span>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{data.summary}</p>
        </div>
      </div>

      {/* 统计 chip */}
      <div className="relative mt-4 flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="rounded-full bg-paper px-2.5 py-1 text-ink-soft ring-1 ring-ink/10">
          最强一项 · {best?.label} {best?.score}
        </span>
        <span className="rounded-full bg-paper px-2.5 py-1 text-ink-soft ring-1 ring-ink/10">
          最需关注 · {worst?.label} {worst?.score}
        </span>
        <span className="rounded-full bg-paper px-2.5 py-1 text-ink-faint ring-1 ring-ink/10">
          评分为产品量化模型，仅供文化参考
        </span>
      </div>
    </section>
  );
}
