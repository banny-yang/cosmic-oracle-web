import { useState } from "react";
import { ChevronDown, Heart, Loader2 } from "lucide-react";

export interface BaziPreviewItem {
  key: string;
  label: string;
  score: number;
  weight: number;
  grade: string;
  positives: string[];
  concerns: string[];
  summary: string;
}

export interface BaziPreviewData {
  total: number;
  level: string;
  summary: string;
  items: BaziPreviewItem[];
  persons?: { name: string; pillars: string[]; dayMaster?: string | null }[];
}

const LEVEL_COLOR: Record<string, string> = {
  极佳: "text-emerald-600",
  良好: "text-emerald-600",
  中上: "text-sky-600",
  一般: "text-amber-600",
  偏低: "text-rose-500",
};

export function scoreColor(score: number): string {
  return score >= 80 ? "bg-emerald-700" : score >= 70 ? "bg-blue-800" : score >= 60 ? "bg-amber-700" : "bg-rose-700";
}

/**
 * 八字合婚十项结果面板：综合指数 + 十项进度条（可展开正负因素），
 * 底部「AI 深度解读」入口由父级接付费报告流。
 */
export function BaziPreviewPanel({
  data,
  price,
  onBuy,
  buying,
  embedded,
}: {
  data: BaziPreviewData;
  price?: number;
  onBuy?: () => void;
  buying?: boolean;
  /** 报告页嵌入模式：隐藏购买按钮与免责（英雄卡已有） */
  embedded?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div className="mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
      <div className="flex items-center gap-4 rounded-xl bg-paper p-4 ring-1 ring-ink/5">
        <div className="grid size-16 shrink-0 place-items-center rounded-full ring-2 ring-vermilion/60">
          <div className="text-center leading-none">
            <p className="text-xl font-bold tabular-nums text-ink">{data.total}</p>
            <p className="mt-0.5 text-[9px] text-ink-faint">综合指数</p>
          </div>
        </div>
        <div>
          <p className={`text-base font-semibold ${LEVEL_COLOR[data.level] ?? ""}`}>
            <Heart className="mr-1 inline size-4" /> {data.level}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{data.summary}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {data.items.map((it, idx) => (
          <div key={it.key} className="rounded-xl bg-paper ring-1 ring-ink/5">
            <button
              onClick={() => setOpenKey(openKey === it.key ? null : it.key)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
            >
              <span className="w-5 shrink-0 text-xs text-ink-faint tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="w-24 shrink-0 text-sm font-medium">
                {it.label}
                <span className="ml-1 text-[9px] font-normal text-ink-faint">{it.weight}%</span>
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className={`h-full rounded-full ${scoreColor(it.score)}`} style={{ width: `${it.score}%` }} />
              </div>
              <span className="w-8 text-right text-sm font-semibold tabular-nums">{it.score}</span>
              <ChevronDown
                className={`size-3.5 shrink-0 text-ink-faint transition-transform ${openKey === it.key ? "rotate-180" : ""}`}
              />
            </button>
            {openKey === it.key ? (
              <div className="border-t border-ink/5 px-3.5 py-3 text-xs leading-relaxed">
                <p className="text-[10px] text-ink-faint">
                  权重 {it.weight}% · 证据等级 {it.grade} · {it.summary}
                </p>
                <p className="mt-2 font-medium text-emerald-700">正向因素</p>
                <ul className="mt-1 space-y-1 text-ink-soft">
                  {it.positives.map((x, i) => (
                    <li key={i}>✓ {x}</li>
                  ))}
                </ul>
                <p className="mt-2 font-medium text-amber-700">需要关注</p>
                <ul className="mt-1 space-y-1 text-ink-soft">
                  {it.concerns.map((x, i) => (
                    <li key={i}>△ {x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!embedded ? (
        <>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
            评分为传统合婚规则的量化模型，仅供文化参考与娱乐。
          </p>
          <button
            onClick={onBuy}
            disabled={buying}
            className="mt-3 w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {buying ? <Loader2 className="mr-1 inline size-4 animate-spin" /> : null}
            生成 AI 深度解读 · 消耗 {price} 点
          </button>
        </>
      ) : null}
    </div>
  );
}
