import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls } from "@/components/app-shell";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { post } from "@/lib/api";
import { getToken } from "@/lib/auth";

export const Route = createFileRoute("/naming")({
  component: Naming,
  head: () => ({
    meta: [
      { title: "宝宝起名 · 对脉名鉴" },
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
}

interface Diagnosis {
  dayMasterElement?: string;
  strength?: string;
  primaryElement?: string;
  secondaryElement?: string;
  reason?: string;
  aiGenerated?: boolean;
  cards?: NameCardData[];
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
const classicSources = ["诗经", "楚辞", "唐诗", "宋词", "论语", "周易"];

function Naming() {
  // 表单
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("F");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("10:00");
  const [lat, setLat] = useState(39.9);
  const [lng, setLng] = useState(116.4);
  const [nameLength, setNameLength] = useState<"DOUBLE" | "SINGLE">("DOUBLE");
  const [generationChar, setGenerationChar] = useState("");
  const [tabooText, setTabooText] = useState("");
  const [stylesSel, setStylesSel] = useState<string[]>([]);
  const [sourcesSel, setSourcesSel] = useState<string[]>([]);
  const [formErr, setFormErr] = useState("");

  // 生成状态
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [aiDelta, setAiDelta] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<NameCardData[]>([]);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const excludeRef = useRef<string[]>([]);
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
    if (exclude) excludeRef.current = [...excludeRef.current, ...cards.map((c) => c.name)];
    setCards([]);
    setDiagnosis(null);
    setError("");
    setAiDelta("");
    setStageIdx(-1);
    setVoteLink("");
    setPicking(false);
    setPicked([]);
    setLoading(true);
    streamRef.current = streamPost({
      path: "/api/v1/naming/generate/stream",
      data: body(exclude ? excludeRef.current : []),
      idleTimeoutMs: 480_000,
      onEvent: (ev) => {
        const idx = STAGE_INDEX[String(ev.stage)];
        if (idx !== undefined) setStageIdx(idx);
        if (ev.stage === "xiyong" && ev.data) {
          setDiagnosis(ev.data as Diagnosis);
        } else if (ev.stage === "result" && ev.data) {
          const d = ev.data as Diagnosis;
          setCards(d.cards || []);
          setDiagnosis({
            dayMasterElement: d.dayMasterElement,
            strength: d.strength,
            primaryElement: d.primaryElement,
            secondaryElement: d.secondaryElement,
            reason: d.reason,
            aiGenerated: d.aiGenerated !== false,
          });
          setLoading(false);
        } else if (ev.stage === "error") {
          setError(String(ev.message || ev.error || "生成失败，请重试"));
          setLoading(false);
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

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLng(Math.round(pos.coords.longitude * 10000) / 10000);
      },
      () => setFormErr("定位失败，可手动填写经纬度"),
      { timeout: 8000 },
    );
  };

  const hasResult = cards.length > 0;
  const chips = "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors";

  return (
    <AppShell>
      <PageHeader eyebrow="功能一" title="宝宝起名" desc="填写姓氏与生辰偏好，为孩子拟一组有来历、有数理的名字。" />

      {/* 表单 */}
      {!hasResult && !loading ? (
        <section className="ink-in d1 mt-7 space-y-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
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
          <Field label="出生地（用于真太阳时校正）">
            <div className="flex items-center gap-3">
              <input
                className={inputCls}
                inputMode="decimal"
                value={`${lat}, ${lng}`}
                onChange={(e) => {
                  const [a, b] = e.target.value.split(/[,，]/).map((s) => parseFloat(s.trim()));
                  if (!Number.isNaN(a)) setLat(a);
                  if (b !== undefined && !Number.isNaN(b)) setLng(b);
                }}
              />
              <button
                onClick={locate}
                className="h-10 w-20 shrink-0 rounded-xl bg-paper-3 text-xs font-medium text-ink ring-1 ring-ink/10"
              >
                定位
              </button>
            </div>
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
          <Field label="风格偏好（选填）">
            <div className="flex flex-wrap gap-2">
              {styleTags.map((s) => (
                <button
                  key={s}
                  onClick={() => setStylesSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
                  className={`${chips} ${stylesSel.includes(s) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="典籍偏好（选填）">
            <div className="flex flex-wrap gap-2">
              {classicSources.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourcesSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
                  className={`${chips} ${sourcesSel.includes(s) ? "bg-vermilion/15 text-vermilion-deep ring-vermilion/30" : "bg-paper-3 text-ink-soft ring-ink/10"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          {formErr ? <p className="text-xs text-vermilion-deep">{formErr}</p> : null}
          <button
            onClick={() => start(false)}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
          >
            开始生成
          </button>
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
          {aiDelta ? <p className="mt-4 truncate text-xs text-ink-faint">{aiDelta}</p> : null}
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
          <h2 className="text-base font-semibold">出生五行分析</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-paper-3 px-3 py-1.5">日主 · {ELEMENT_ZH[diagnosis.dayMasterElement || ""] || "-"}</span>
            <span className="rounded-full bg-paper-3 px-3 py-1.5">{STRENGTH_ZH[diagnosis.strength || ""] || "-"}</span>
            <span className="rounded-full bg-paper-3 px-3 py-1.5">
              喜用 · {(ELEMENT_ZH[diagnosis.primaryElement || ""] || "-") + "主"}
              {diagnosis.secondaryElement ? " · " + (ELEMENT_ZH[diagnosis.secondaryElement] || "") + "辅" : ""}
            </span>
          </div>
          {diagnosis.reason ? (
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{diagnosis.reason}</p>
          ) : null}
        </section>
      ) : null}

      {/* 名字卡 */}
      {hasResult ? (
        <>
          <div className="mt-8 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">名字方案</h2>
            <span className="text-xs text-ink-faint">{cards.length} 个 · 按推荐指数排序</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((c, i) => (
              <NameCardView
                key={c.name + i}
                c={c}
                picking={picking}
                picked={picked.includes(c.name)}
                onPick={() => togglePick(c.name)}
                wuge={wugeCells(c)}
              />
            ))}
          </div>

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
                <button onClick={() => start(true)} className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
                  换一批
                </button>
                <button onClick={() => setPicking(true)} className="flex-1 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper">
                  发起亲友投票
                </button>
              </>
            )}
          </div>

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
    </AppShell>
  );
}

function NameCardView({
  c,
  picking,
  picked,
  onPick,
  wuge,
}: {
  c: NameCardData;
  picking: boolean;
  picked: boolean;
  onPick: () => void;
  wuge: { label: string; value?: number }[];
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
      className="relative rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5"
      onClick={picking ? onPick : undefined}
    >
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

      <p className="mt-2 text-xs tracking-wide text-ink-soft">{c.pinyin}</p>

      {c.recommended ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span className="size-1.5 rounded-full bg-vermilion" />
          {typeof c.recommendScore === "number" ? (
            <span className="font-semibold text-vermilion-deep">推荐指数 {c.recommendScore}</span>
          ) : null}
          {c.recommendReason ? <span className="text-ink-faint">· {c.recommendReason}</span> : null}
        </p>
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
          {c.classicSource ? <p className="text-xs font-medium text-vermilion-deep">「{c.classicSource}」</p> : null}
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.classicCitation}</p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className={`text-[11px] ${c.homophoneSafe === false ? "text-vermilion-deep" : "text-ink-faint"}`}>
          {c.homophoneSafe === false ? "⚠ " + (c.safetyNote || "谐音需留意") : "✓ 谐音安全"}
        </span>
        {c.wuxingAnalysis ? (
          <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-[11px] text-ink-soft underline underline-offset-2">
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
