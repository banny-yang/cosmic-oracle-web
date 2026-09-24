import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, BreadcrumbJsonLd, Field, PageHeader, inputCls } from "@/components/app-shell";
import { DimRadar } from "@/components/dim-radar";
import { buildNameEvalPoster } from "@/components/name-eval-poster";
import { ReportPosterButtons } from "@/components/report-poster";
import { FeatureClosed } from "@/components/feature-closed";
import { post } from "@/lib/api";
import { track } from "@/lib/track";
import { useFeatureEnabled } from "@/lib/use-feature-price";

/** 接口响应（与后端 NameEvalResponse 一致）。 */
type Dimension = {
  key: string;
  name: string;
  shortName: string;
  weight: number;
  score: number;
  summary: string;
  notes: string[];
};
type Citation = {
  word: string;
  book: string;
  chapter: string | null;
  sentence: string | null;
  meaning: string | null;
  level: string;
};
type Phonetics = {
  pinyins: string[];
  tones: number[];
  pattern: string;
  tier: string | null;
  notes: string[];
};
type DialectRow = { dialect: string; zh?: string | null; status: string; note: string };
type CharRow = {
  ch: string;
  pinyin: string | null;
  tone: number | null;
  strokes: number | null;
  radical: string | null;
  frequency: number | null;
  family: string | null;
  meaning: string | null;
  source: string | null;
  cliche: boolean;
};
type Share = { threshold: number; shareable: boolean; code: string };
type Upgrade = {
  needed: boolean;
  reason: string | null;
  cta: string | null;
  ctaPath: string | null;
};
type NameEvalResult = {
  surname: string;
  givenName: string;
  fullName: string;
  score: number;
  grade: string;
  gradeLabel: string;
  verdict: string;
  dimensions: Dimension[];
  citations: Citation[];
  phonetics: Phonetics;
  dialects: DialectRow[];
  chars: CharRow[];
  share: Share;
  upgrade: Upgrade;
  disclaimer: string;
};

/** 汉字输入即筛即限长：姓 1-2 字（复姓可含间隔号），名 1-3 字。 */
const cleanSurname = (v: string) => v.replace(/[^\u4e00-\u9fa5·]/g, "").slice(0, 2);
const cleanGiven = (v: string) => v.replace(/[^\u4e00-\u9fa5]/g, "").slice(0, 3);
const hanCount = (v: string) => (v.match(/[\u4e00-\u9fa5]/g) ?? []).length;

export const Route = createFileRoute("/name-eval")({
  component: NameEval,
  // 结果页可静态分享：评测是确定性规则引擎，同一名字每次结果一致，所以只用 URL 参数承载（?x=傅&m=既白）
  validateSearch: (search: Record<string, unknown>) => ({
    x: typeof search["x"] === "string" ? cleanSurname(search["x"]) : undefined,
    m: typeof search["m"] === "string" ? cleanGiven(search["m"]) : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/name-eval" }],
    meta: [
      { title: "名字评测 · 对脉名鉴" },
      {
        name: "keywords",
        content:
          "名字评测,姓名评测,名字评分,名字出处,平仄声调,汉字美学,诗经取名,楚辞取名,名字好不好",
      },
      {
        name: "description",
        content:
          "免费名字评测：从典籍文化度、音律平仄度、意象寓意度、避俗辨识度、字形书写美五个维度评分，附判词、典籍出处原句、声调与方言结论。无需登录。",
      },
      { property: "og:url", content: "https://name.duimai.net/name-eval" },
      { property: "og:title", content: "名字评测 · 对脉名鉴" },
      {
        property: "og:description",
        content: "语言学 + 声律学 + 典籍文本的汉字美学评测：看看你的名字的用字、声调与出处。",
      },
    ],
  }),
});

/** 总分环（纯 SVG，随 currentColor 取色）。 */
function ScoreRing({ score, size = 116 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.min(100, Math.max(0, score)) / 100;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`总分 ${score.toFixed(1)}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={7}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 4}
        fontWeight={600}
        fill="currentColor"
      >
        {score.toFixed(1)}
      </text>
      <text
        x={size / 2}
        y={size / 2 + size / 6.2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 14}
        fill="currentColor"
        fillOpacity={0.55}
      >
        总分
      </text>
    </svg>
  );
}

const DIALECT_STATUS: Record<string, { label: string; cls: string }> = {
  passed: { label: "通过", cls: "text-emerald-800" },
  blocked: { label: "建议规避", cls: "text-vermilion-deep" },
  skipped: { label: "数据未覆盖", cls: "text-ink-soft" },
};

function NameEval() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const featureEnabled = useFeatureEnabled("NAME_EVAL");

  const [surname, setSurname] = useState(search["x"] ?? "");
  const [givenName, setGivenName] = useState(search["m"] ?? "");
  const [result, setResult] = useState<NameEvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 「姓|名」最近一次已发起的评测：既防 URL 回填的重复请求，也让主动重测可以重算
  const askedRef = useRef("");

  const evaluate = useCallback(async (x: string, m: string) => {
    const key = `${x}|${m}`;
    if (askedRef.current === key) return;
    askedRef.current = key;
    setLoading(true);
    setError("");
    try {
      // 判词润色最坏 20 秒（Dify 超时后回落到本地模板）：客户端预算必须大于该上限，
      // 否则服务端仍在计算时就被中断，用户看到的是「网络连接失败」而不是回落判词
      const r = await post<NameEvalResult>(
        "/api/v1/name-eval/analyze",
        { surname: x, givenName: m },
        { auth: false, timeoutMs: 30000 },
      );
      setResult(r);
      track("name_eval_done", { grade: r.grade, score: Math.round(r.score) });
    } catch (e) {
      askedRef.current = "";
      setError((e as Error).message || "评测失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, []);

  // 分享链接 / 刷新：URL 带姓与名就直接复算（引擎确定性，同 URL 同结果）
  const sx = search["x"];
  const sm = search["m"];
  useEffect(() => {
    if (!sx || !sm) return;
    setSurname(sx);
    setGivenName(sm);
    void evaluate(sx, sm);
  }, [sx, sm, evaluate]);

  const submit = () => {
    const x = cleanSurname(surname);
    const m = cleanGiven(givenName);
    setSurname(x);
    setGivenName(m);
    if (hanCount(x) < 1 || hanCount(m) < 1) {
      setError("请输入姓氏与名字（请使用汉字）");
      return;
    }
    track("name_eval_submit", { len: x.length + m.length });
    askedRef.current = "";
    void evaluate(x, m);
    // 写入 URL：结果页可复制给他人、刷新一致
    void navigate({ to: "/name-eval", search: { x, m }, replace: true });
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="名字评测" path="/name-eval" />
      {featureEnabled === false ? (
        <FeatureClosed title="名字评测" />
      ) : (
        <>
          <PageHeader
            eyebrow="免费 · 无需登录"
            title="名字评测"
            desc="基于语言学、声律学与典籍文本的汉字美学评测：五维评分、判词、出处原句与声调方言结论。不测吉凶、不算八字、不评五格。"
          />

          <section className="ink-in d1 mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
            <div className="grid grid-cols-2 gap-3">
              <Field label="姓" required>
                <input
                  className={inputCls}
                  value={surname}
                  onChange={(e) => setSurname(cleanSurname(e.target.value))}
                  placeholder="如 傅 / 欧阳"
                  maxLength={2}
                  autoComplete="off"
                />
              </Field>
              <Field label="名" required>
                <input
                  className={inputCls}
                  value={givenName}
                  onChange={(e) => setGivenName(cleanGiven(e.target.value))}
                  placeholder="如 既白"
                  maxLength={3}
                  autoComplete="off"
                />
              </Field>
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "评测中…" : "免费评测"}
            </button>
            {error ? <p className="mt-2 text-xs text-vermilion-deep">{error}</p> : null}
            <p className="mt-2 text-center text-[11px] text-ink-soft">
              规则引擎即时出结果，可复制当前链接分享同一个名字的评测
            </p>
          </section>

          {result && !loading ? <ResultBlocks r={result} /> : null}
        </>
      )}
    </AppShell>
  );
}

function ResultBlocks({ r }: { r: NameEvalResult }) {
  const toneBits = [
    r.phonetics.pattern ? `平仄 ${r.phonetics.pattern}` : "",
    r.phonetics.tier ?? "",
  ].filter(Boolean);

  return (
    <>
      <section className="ink-in d1 mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <div className="flex items-center gap-5">
          <div className="shrink-0 text-vermilion-deep">
            <ScoreRing score={r.score} />
          </div>
          <div className="min-w-0">
            <p className="font-seal text-3xl leading-none text-ink">{r.fullName}</p>
            <p className="mt-2 inline-flex items-center rounded-full bg-vermilion px-2.5 py-1 text-[11px] font-semibold text-paper">
              {r.grade} 级 · {r.gradeLabel}
            </p>
            {toneBits.length ? (
              <p className="mt-2 text-xs text-ink-soft">{toneBits.join(" · ")}</p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-paper-3 p-3.5 text-sm leading-relaxed text-ink">
          {r.verdict}
        </p>

        {r.share.shareable ? (
          <div className="mt-4 rounded-xl bg-paper-3 p-3.5">
            <p className="text-xs font-semibold text-ink">汉字美学评测名片</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{r.share.code}</p>
            <ReportPosterButtons
              fileName={`名字评测_${r.fullName}`}
              trackKey="name_eval_poster"
              build={() =>
                buildNameEvalPoster({
                  fullName: r.fullName,
                  score: r.score,
                  grade: r.grade,
                  gradeLabel: r.gradeLabel,
                  verdict: r.verdict,
                  dimensions: r.dimensions.map((d) => ({
                    label: d.shortName,
                    score: d.score,
                    weight: d.weight,
                  })),
                  sentence: r.citations[0]?.sentence ?? null,
                  book: r.citations[0]?.book ?? null,
                  shareCode: r.share.code,
                })
              }
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-paper-3 p-3.5">
            <p className="text-xs font-semibold text-ink">{r.upgrade.reason}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{r.upgrade.cta}</p>
            <Link
              to="/naming"
              search={{
                x: r.surname,
                prefer: undefined,
                src: undefined,
                g: undefined,
                cat: undefined,
                book: undefined,
              }}
              className="mt-3 block w-full rounded-xl bg-vermilion py-3 text-center text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
            >
              一键升级 · 生成 10 个同源雅名
            </Link>
          </div>
        )}
      </section>

      <section className="ink-in d2 mt-5 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <h2 className="text-sm font-semibold text-ink">五维拆解</h2>
        <p className="mt-1 text-[11px] text-ink-soft">
          权重合计 100：典籍文化度 30 · 音律平仄度 25 · 意象寓意度 20 · 避俗辨识度 15 · 字形书写美
          10
        </p>
        <div className="mt-3 text-vermilion-deep">
          <DimRadar
            axes={r.dimensions.map((d) => ({ label: d.shortName, score: d.score }))}
            size={230}
            className="mx-auto"
          />
        </div>
        <ul className="mt-4 space-y-3">
          {r.dimensions.map((d) => (
            <li key={d.key} className="rounded-xl bg-paper-3 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                  {d.name}
                  <span className="ml-1.5 font-normal text-ink-soft">权重 {d.weight}%</span>
                </span>
                <span className="text-sm font-semibold text-ink">{d.score}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
                <div
                  className="h-full rounded-full bg-vermilion"
                  style={{ width: `${Math.min(100, Math.max(0, d.score))}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{d.summary}</p>
              {d.notes.length ? (
                <ul className="mt-1.5 space-y-0.5">
                  {d.notes.map((n) => (
                    <li key={n} className="text-[11px] leading-relaxed text-ink-soft">
                      · {n}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {r.citations.length ? (
        <section className="ink-in d2 mt-5 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
          <h2 className="text-sm font-semibold text-ink">典籍出处</h2>
          <ul className="mt-3 space-y-3">
            {r.citations.map((c) => (
              <li key={`${c.word}-${c.book}`} className="rounded-xl bg-paper-3 p-3">
                <p className="text-xs font-semibold text-ink">
                  {c.word}
                  <span className="ml-2 font-normal text-ink-soft">
                    {c.book}
                    {c.chapter ? ` · ${c.chapter}` : ""}
                  </span>
                </p>
                {c.sentence ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">「{c.sentence}」</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-ink-soft">语料未收录原句，仅记书目来源</p>
                )}
                {c.meaning ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{c.meaning}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ink-in d2 mt-5 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <h2 className="text-sm font-semibold text-ink">读音与声调</h2>
        <p className="mt-2 text-2xl leading-none tracking-wider text-vermilion-deep">
          {r.phonetics.pinyins.join(" ") || "—"}
        </p>
        {toneBits.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {toneBits.map((t) => (
              <span
                key={t}
                className="rounded-full bg-paper-3 px-2.5 py-1 text-[11px] font-medium text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {r.phonetics.notes.length ? (
          <ul className="mt-3 space-y-0.5">
            {r.phonetics.notes.map((n) => (
              <li key={n} className="text-[11px] leading-relaxed text-ink-soft">
                · {n}
              </li>
            ))}
          </ul>
        ) : null}
        {r.dialects.length ? (
          <>
            <h3 className="mt-4 text-xs font-semibold text-ink">方言读音风控</h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {r.dialects.map((d) => {
                const st = DIALECT_STATUS[d.status] ?? { label: d.status, cls: "text-ink-soft" };
                return (
                  <li key={d.dialect} className="rounded-xl bg-paper-3 p-2.5">
                    <p className="text-[11px] font-semibold text-ink">
                      {d.zh || d.dialect}
                      <span className={`ml-1.5 font-normal ${st.cls}`}>{st.label}</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{d.note}</p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>

      <section className="ink-in d2 mt-5 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <h2 className="text-sm font-semibold text-ink">逐字用字</h2>
        <ul className="mt-3 space-y-2.5">
          {r.chars.map((c) => (
            <li key={c.ch} className="flex items-start gap-3 rounded-xl bg-paper-3 p-3">
              <span className="font-seal text-2xl leading-none text-ink">{c.ch}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-relaxed text-ink-soft">
                  {c.pinyin || "读音未收录"} · {c.tone ? `${c.tone} 声` : "声调未识别"}
                  {c.strokes != null ? ` · ${c.strokes} 画` : " · 笔画未收录"}
                  {c.radical ? ` · 部首 ${c.radical}` : ""}
                  {c.family ? ` · 意象系 ${c.family}` : ""}
                  {c.frequency != null ? ` · 语料频次 ${c.frequency}` : ""}
                </p>
                {c.cliche ? (
                  <span className="mt-1 inline-flex rounded-full bg-vermilion-wash px-2 py-0.5 text-[10px] font-medium text-vermilion-deep">
                    近年高频用字
                  </span>
                ) : null}
                {c.meaning ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{c.meaning}</p>
                ) : null}
                {c.source ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">出处：{c.source}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft">{r.disclaimer}</p>
    </>
  );
}
