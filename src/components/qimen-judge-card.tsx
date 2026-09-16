/**
 * 奇门断局结论卡：综合评断（分数 + 断语）、置信度、吉格/凶格命中、主客分析；
 * 应期卡（候选时间窗 + 概率指数）。数据形状与后端 buildJudgeJson /
 * QimenChatController SSE judge/yingqi 事件一致（记录详情复用 judgeDataJson）。
 */

export interface GridHit {
  pattern_name?: string;
  nature?: string;
  score_impact?: number;
  palace_index?: number;
}

export interface QimenJudgeData {
  verdict?: { score?: number; text?: string };
  confidence?: { score?: number; basis?: string };
  ji_ge_hits?: GridHit[];
  xiong_ge_hits?: GridHit[];
  host_guest?: { conclusion?: string; explanation?: string };
  yong_shen_palace?: { palace_index?: number };
  /** 旧断局链路详情才有（chat 链路缺省不标，与 App 端一致） */
  subject_palace?: { palace_index?: number };
  object_palace?: { palace_index?: number };
  global_assessment?: {
    void_palaces?: number[];
    day_void_palaces?: number[];
    ma_star_palace?: number;
  };
}

export interface YingQiCandidate {
  branch_name?: string;
  action_type?: string;
  start_time?: string;
  end_time?: string;
  probability_score?: number;
}

export interface QimenYingQi {
  rule_name?: string;
  time_scale?: string;
  candidate_times?: YingQiCandidate[];
}

export function isQimenJudgeData(v: unknown): v is QimenJudgeData {
  return !!v && typeof v === "object" && typeof (v as QimenJudgeData).verdict === "object";
}

function HitChips({ hits, tone }: { hits?: GridHit[] | undefined; tone: "ji" | "xiong" }) {
  if (!hits || hits.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {hits.map((h, i) => (
        <span
          key={i}
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            tone === "ji" ? "bg-vermilion/10 text-vermilion-deep" : "bg-ink/8 text-ink-soft",
          ].join(" ")}
        >
          {h.pattern_name ?? "格局"}
          {typeof h.score_impact === "number"
            ? ` ${h.score_impact > 0 ? "+" : ""}${h.score_impact}`
            : ""}
        </span>
      ))}
    </div>
  );
}

export function QimenJudgeCard({ judge }: { judge: QimenJudgeData }) {
  const score = judge.verdict?.score;
  const pct = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;
  return (
    <section className="rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
      <div className="flex items-center gap-4">
        {pct != null ? (
          <div className="grid size-16 shrink-0 place-items-center rounded-full ring-2 ring-vermilion/60">
            <span className="text-lg font-bold tabular-nums text-vermilion-deep">{pct}</span>
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-vermilion-deep">断局结论</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            {judge.verdict?.text || "（引擎未给出评断）"}
          </p>
          {judge.confidence?.score != null ? (
            <p className="mt-1 text-[11px] text-ink-faint">
              置信度 {judge.confidence.score}%
              {judge.confidence.basis ? ` · ${judge.confidence.basis}` : ""}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <HitChips hits={judge.ji_ge_hits} tone="ji" />
        <HitChips hits={judge.xiong_ge_hits} tone="xiong" />
      </div>
      {judge.host_guest?.conclusion ? (
        <div className="mt-4 rounded-xl bg-paper-3 p-3">
          <p className="text-xs font-semibold text-ink">主客分析 · {judge.host_guest.conclusion}</p>
          {judge.host_guest.explanation ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {judge.host_guest.explanation}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function QimenYingQiCard({ yingqi }: { yingqi: QimenYingQi }) {
  const list = (yingqi.candidate_times ?? []).slice(0, 4);
  if (list.length === 0) return null;
  return (
    <section className="rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
      <p className="text-xs font-semibold tracking-widest text-vermilion-deep">
        应期推断{yingqi.rule_name ? ` · ${yingqi.rule_name}` : ""}
      </p>
      <div className="mt-3 space-y-2.5">
        {list.map((c, i) => {
          const prob =
            typeof c.probability_score === "number" ? Math.round(c.probability_score * 100) : null;
          return (
            <div key={i} className="rounded-xl bg-paper-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">
                  {i === 0 ? "★ 黄金窗口" : `窗口 ${i + 1}`}
                  {c.branch_name ? ` · ${c.branch_name}` : ""}
                </p>
                {prob != null ? (
                  <span className="text-[11px] tabular-nums text-vermilion-deep">{prob}%</span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                {[c.start_time, c.end_time].filter(Boolean).join(" ~ ") || ""}
                {c.action_type ? ` · ${c.action_type}` : ""}
              </p>
              {prob != null ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-vermilion"
                    style={{ width: `${Math.min(100, prob)}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
