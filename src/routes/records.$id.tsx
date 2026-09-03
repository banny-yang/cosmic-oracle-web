import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { get } from "@/lib/api";
import { getToken, getAuthUser } from "@/lib/auth";

export const Route = createFileRoute("/records/$id")({
  component: RecordDetail,
  head: () => ({
    meta: [
      { title: "方案详情 · 对脉名鉴" },
      { name: "description", content: "历史起名方案回放：出生五行分析与名字卡。" },
    ],
  }),
});

interface NameCardData {
  name: string;
  pinyin: string;
  charElements?: string[];
  classicCitation?: string;
  classicSource?: string;
  wuxingAnalysis?: string;
  homophoneSafe?: boolean;
  safetyNote?: string;
  tianGe?: number;
  renGe?: number;
  diGe?: number;
  waiGe?: number;
  zongGe?: number;
  sanCai?: string;
  recommendScore?: number;
  recommended?: boolean;
  recommendReason?: string;
}

interface LogDetail {
  id: string;
  request?: { surname?: string; gender?: string; birthTime?: string };
  result?: NameCardData[] | (Record<string, unknown> & { cards?: NameCardData[] });
  created_at?: string;
}

const ELEMENT_ZH: Record<string, string> = { WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水" };
const STRENGTH_ZH: Record<string, string> = { STRONG: "身强", WEAK: "身弱", BALANCED: "中和" };

function RecordDetail() {
  const { id } = Route.useParams();
  const [cards, setCards] = useState<NameCardData[]>([]);
  const [diag, setDiag] = useState<Record<string, string> | null>(null);
  const [surname, setSurname] = useState("");
  const [time, setTime] = useState("");
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
        const list = Array.isArray(r) ? r : r?.cards || [];
        setCards(list);
        if (r && !Array.isArray(r)) {
          setDiag(r as Record<string, string>);
        }
        setSurname(d?.request?.surname || "");
        setTime(d?.created_at ? String(d.created_at).replace("T", " ").slice(0, 16) : "");
        setLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "记录加载失败");
        setLoaded(true);
      });
  }, [id]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="历史方案"
        title={`${surname || "起名"}方案回放`}
        desc={time ? "生成于 " + time : undefined}
      />

      {error ? (
        <div className="mt-7 rounded-2xl bg-paper-2 p-8 text-center ring-1 ring-ink/5">
          <p className="text-sm text-vermilion-deep">{error}</p>
        </div>
      ) : !loaded ? (
        <div className="mt-7 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-paper-2 ring-1 ring-ink/5" />
          ))}
        </div>
      ) : (
        <>
          {diag ? (
            <section className="ink-in d1 mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <h2 className="text-base font-semibold">出生五行分析</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-paper-3 px-3 py-1.5">日主 · {ELEMENT_ZH[diag.dayMasterElement] || "-"}</span>
                <span className="rounded-full bg-paper-3 px-3 py-1.5">{STRENGTH_ZH[diag.strength] || "-"}</span>
                <span className="rounded-full bg-paper-3 px-3 py-1.5">
                  喜用 · {(ELEMENT_ZH[diag.primaryElement] || "-") + "主"}
                  {diag.secondaryElement ? " · " + (ELEMENT_ZH[diag.secondaryElement] || "") + "辅" : ""}
                </span>
              </div>
              {diag.reason ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">{diag.reason}</p> : null}
            </section>
          ) : null}

          <div className="mt-8 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">名字方案</h2>
            <span className="text-xs text-ink-faint">{cards.length} 个</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <section key={c.name} className="relative rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
                {c.recommended ? (
                  <span className="absolute top-0 right-5 flex flex-col items-center rounded-b-lg bg-vermilion px-2 py-1.5 font-seal text-xs leading-tight text-paper">
                    <span>推</span>
                    <span>荐</span>
                  </span>
                ) : null}
                <p className="font-seal text-3xl text-ink">{c.name}</p>
                <p className="mt-1.5 text-xs text-ink-soft">{c.pinyin}</p>
                {c.recommended && (c.recommendScore != null || c.recommendReason) ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="size-1.5 rounded-full bg-vermilion" />
                    {c.recommendScore != null ? (
                      <span className="font-semibold text-vermilion-deep">推荐指数 {c.recommendScore}</span>
                    ) : null}
                    {c.recommendReason ? <span className="text-ink-faint">· {c.recommendReason}</span> : null}
                  </p>
                ) : null}
                {c.classicCitation ? (
                  <div className="mt-3 rounded-xl bg-paper-3/60 p-3">
                    {c.classicSource ? <p className="text-xs font-medium text-vermilion-deep">「{c.classicSource}」</p> : null}
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.classicCitation}</p>
                  </div>
                ) : null}
                <p className={`mt-3 text-[11px] ${c.homophoneSafe === false ? "text-vermilion-deep" : "text-ink-faint"}`}>
                  {c.homophoneSafe === false ? "⚠ " + (c.safetyNote || "谐音需留意") : "✓ 谐音安全"}
                </p>
              </section>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
