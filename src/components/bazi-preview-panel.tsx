import { useState } from "react";
import { post } from "@/lib/api";
import { Field, inputCls } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { ChevronDown, Heart } from "lucide-react";

interface PreviewItem {
  key: string;
  label: string;
  score: number;
  weight: number;
  grade: string;
  positives: string[];
  concerns: string[];
  summary: string;
}

interface PreviewData {
  total: number;
  level: string;
  summary: string;
  items: PreviewItem[];
}

const LEVEL_COLOR: Record<string, string> = {
  极佳: "text-emerald-600",
  良好: "text-emerald-600",
  中上: "text-sky-600",
  一般: "text-amber-600",
  偏低: "text-rose-500",
};

export function scoreColor(score: number): string {
  return score >= 80 ? "bg-emerald-500" : score >= 70 ? "bg-sky-500" : score >= 60 ? "bg-amber-500" : "bg-rose-400";
}

/**
 * 八字合婚免费十项速览：本人+对方出生信息 → 引擎即时评分（综合指数 + 十项，可展开正负因素）。
 * 与付费报告互不影响：速览为纯规则引擎输出，付费走 AI 深度解读。
 */
export function BaziPreviewPanel({
  partnerBirth: partner,
}: {
  partnerBirth: { date: string; time: string; lat: number; lng: number };
}) {
  const [myDate, setMyDate] = useState("");
  const [myTime, setMyTime] = useState("12:00");
  const [myLat, setMyLat] = useState(39.9);
  const [myLng, setMyLng] = useState(116.4);
  const [data, setData] = useState<PreviewData | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const run = () => {
    setErr("");
    if (!myDate) return setErr("请选择本人出生日期");
    if (!partner.date) return setErr("请先填写对方出生日期");
    setLoading(true);
    setData(null);
    post<PreviewData>(
      "/api/v1/reports/marriage-fit/preview",
      {
        personA: {
          name: "本人",
          birthTime: `${myDate}T${myTime}:00`,
          latitude: myLat,
          longitude: myLng,
        },
        personB: {
          name: "对方",
          birthTime: `${partner.date}T${partner.time}:00`,
          latitude: partner.lat,
          longitude: partner.lng,
        },
      },
      { auth: false, timeoutMs: 15000 },
    )
      .then((r) => setData(r))
      .catch((e: Error) => setErr(e.message || "速览失败，请稍后再试"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
      <p className="text-sm font-semibold">免费十项速览</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        填写本人出生信息，即时得到十项合婚评分；付费报告在此之上提供 AI 深度解读。
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="本人出生日期">
          <input className={inputCls} type="date" value={myDate} onChange={(e) => setMyDate(e.target.value)} />
        </Field>
        <Field label="出生时间">
          <input className={inputCls} type="time" value={myTime} onChange={(e) => setMyTime(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="本人出生地">
            <BirthplaceInput
              lat={myLat}
              lng={myLng}
              onPick={(v) => {
                setMyLat(v.lat);
                setMyLng(v.lng);
              }}
            />
          </Field>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-vermilion-deep">{err}</p> : null}
      <button
        onClick={run}
        disabled={loading}
        className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {loading ? "正在推算…" : "免费速览十项合婚"}
      </button>

      {data ? (
        <div className="mt-5">
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
                  <span className="w-20 shrink-0 text-sm font-medium">{it.label}</span>
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
          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
            评分为传统合婚规则的量化模型，仅供文化参考；完整解读请购买下方付费报告。
          </p>
        </div>
      ) : null}
    </div>
  );
}
