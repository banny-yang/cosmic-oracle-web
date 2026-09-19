import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { MiniMarkdown, RechargeModal } from "@/components/report-flow";
import { ThinkAnswerBox } from "@/components/think-stream";
import { FeatureClosed } from "@/components/feature-closed";
import { get, post } from "@/lib/api";
import { getAuthUser, useAuth } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { streamPost } from "@/lib/sse";
import { useThinkStream } from "@/lib/use-think-stream";
import { hexagramZh } from "@/lib/hexagram-names";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { track } from "@/lib/track";

export const Route = createFileRoute("/liuyao")({
  component: Liuyao,
  head: () => ({
    links: [{ rel: "canonical", href: "http://name.duimai.net/liuyao" }],
    meta: [
      { title: "六爻占卜 · 对脉名鉴" },
      { name: "keywords", content: "六爻,六爻占卜,起卦,卦象解读,摇卦" },
      { property: "og:url", content: "http://name.duimai.net/liuyao" },
      {
        name: "description",
        content: "心中默念所问之事，三枚铜钱六次成卦——本卦变卦、AI 流式解读，一问一卦。",
      },
    ],
  }),
});

/** 掷币结果（后端 coinMatrix，1=正面）→ 爻型：3正老阳○ 2正少阴 1正少阳 0正老阴×（与 App 端同口径） */
type LineType = "oldYang" | "youngYin" | "youngYang" | "oldYin";
function lineTypeOf(row: number[]): LineType {
  const heads = row.filter((v) => v === 1).length;
  return heads >= 3 ? "oldYang" : heads === 2 ? "youngYin" : heads === 1 ? "youngYang" : "oldYin";
}

interface TossResp {
  logId?: string | null;
  remainingBalance?: number;
  hexagramOriginId?: number;
  hexagramOriginName?: string;
  hexagramChangeId?: number;
  hexagramChangeName?: string;
  coinMatrix?: number[][];
  changedCoinMatrix?: number[][];
}

interface HistoryItem {
  logId: string;
  question: string;
  hexagramOriginId?: number;
  hexagramOriginName?: string;
  hexagramChangeId?: number | null;
  hexagramChangeName?: string | null;
  aiReadingPreview?: string;
  aiReading?: string;
  createdAt?: string;
}

/** 单爻（App 端 HexagramDisplay 同款）：朱砂实条/断条 + 光晕 + 变爻 ○/×（赭金）；未掷=空槽 */
function YaoLine({ type, visible }: { type: LineType; visible: boolean }) {
  const yang = type === "oldYang" || type === "youngYang";
  const moving = type === "oldYang" || type === "oldYin";
  if (!visible) {
    return <span className="block h-3.5 w-full rounded-[2px] border border-ink/25" />;
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-1 items-center gap-3">
        {yang ? (
          <span className="line-grow block h-3 flex-1 rounded-[2px] bg-vermilion shadow-[0_0_8px_rgba(158,43,37,0.4)]" />
        ) : (
          <>
            <span className="line-grow block h-3 flex-1 rounded-[2px] bg-vermilion shadow-[0_0_8px_rgba(158,43,37,0.4)]" />
            <span className="line-grow block h-3 flex-1 rounded-[2px] bg-vermilion shadow-[0_0_8px_rgba(158,43,37,0.4)]" />
          </>
        )}
      </div>
      <span className="w-4 shrink-0 text-center text-sm font-bold leading-none text-[#A97B1F]">
        {moving ? (type === "oldYang" ? "○" : "×") : ""}
      </span>
    </div>
  );
}

/** 卦象（自下而上逐爻点亮）：初爻在最后一行，drawn 控制已亮爻数 */
function HexagramLines({ lines, drawn }: { lines: LineType[]; drawn?: number }) {
  const visibleCount = drawn ?? lines.length;
  return (
    // 卦图比例锁：爻线 flex-1 会随容器拉伸，宽屏（掷币页整栏/揭示页双列卡）下细长变形。
    // 限最大宽度并居中（App 端固定 168px 线宽同口径），窄屏自然铺满不变形。
    <div className="mx-auto w-full max-w-[220px] space-y-2.5">
      {[...lines]
        .slice(0, 6)
        .reverse()
        .map((t, i) => {
          const lineIndex = lines.slice(0, 6).length - 1 - i;
          return <YaoLine key={i} type={t} visible={lineIndex < visibleCount} />;
        })}
    </div>
  );
}

/** 铜钱币面（App 端 _CoinFace 同款）：阳=金币渐变+圈点符，阴=灰币+圈竖符 */
function CoinFace({ yang }: { yang: boolean }) {
  return (
    <span
      className={[
        "grid size-full place-items-center rounded-full",
        yang
          ? "border-2 border-[#A97B1F] bg-[linear-gradient(135deg,#EBD8AC_0%,#C9A85C_100%)] shadow-[0_0_18px_rgba(169,123,31,0.45)]"
          : "border-2 border-[#8E8578]/60 bg-[linear-gradient(135deg,#DCD5C8_0%,#B9B1A2_100%)] shadow-[0_0_10px_rgba(142,133,120,0.15)]",
      ].join(" ")}
    >
      <span
        className={[
          "grid size-6 place-items-center rounded-full border-2",
          yang ? "border-[#8A5A1E]" : "border-[#6B6257]",
        ].join(" ")}
      >
        {yang ? (
          <span className="size-[7px] rounded-full bg-[#8A5A1E]" />
        ) : (
          <span className="h-[13px] w-[2px] bg-[#6B6257]" />
        )}
      </span>
    </span>
  );
}

/**
 * 掷币竞技场（App 端 CoinTossArena 同款）：双层圆环 + 2s 涟漪 + 三枚铜钱三角站位。
 * 抛掷时三枚币沿各自弧线（--sx 散开）飞行自旋，阳面终点 1440°、阴面 1620°，落定即结果面；
 * 地面阴影随高度缩放淡出。币面直接取后端 coinMatrix 对应行。
 */
function CoinArena({
  row,
  rolling,
  generation,
  onTap,
}: {
  row: number[];
  rolling: boolean;
  generation: number;
  onTap: () => void;
}) {
  // 三枚币三角站位（App 端 _layouts）：上中 / 左下 / 右下，散开量 0 / -30 / 30
  const slots = [
    { left: "50%", top: "54%", sx: "0px", delay: "0s" },
    { left: "34%", top: "78%", sx: "-30px", delay: "0.08s" },
    { left: "66%", top: "78%", sx: "30px", delay: "0.16s" },
  ];
  return (
    <button
      type="button"
      onClick={onTap}
      className="relative mx-auto block h-[280px] w-[280px] max-w-full cursor-pointer"
      aria-label="掷币起卦"
    >
      {/* 静态外环 + 循环涟漪 */}
      <span className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-vermilion/15" />
      <span className="arena-ripple absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-vermilion/40" />
      {slots.map((s, i) => {
        const face = row[i] ?? 1;
        return (
          <span
            key={i}
            className="absolute"
            style={{ left: s.left, top: s.top, ["--sx" as string]: s.sx }}
          >
            {/* 地面阴影（金色微光，随币升高缩小淡出；key=generation 随每次抛掷重启） */}
            <span
              key={`shadow-${generation}-${i}`}
              className="coin-shadow absolute left-1/2 top-[52px] block h-3 w-12 -translate-x-1/2 rounded-full bg-[rgba(169,123,31,0.35)] blur-[3px]"
              style={{ animationDelay: s.delay }}
            />
            {/* 币体：飞行层（coin-fly）+ 双面（coin-face） */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span
                key={`${generation}-${i}`}
                className={[
                  "relative block size-16",
                  rolling
                    ? ["coin-fly", face === 1 ? "coin-fly-yang" : "coin-fly-yin"].join(" ")
                    : "block",
                ].join(" ")}
                style={
                  rolling
                    ? { animationDelay: s.delay }
                    : { transform: face === 1 ? undefined : "rotateY(180deg)" }
                }
              >
                <CoinFace yang />
                <span className="coin-face absolute inset-0 [transform:rotateY(180deg)]">
                  <CoinFace yang={false} />
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </button>
  );
}

/** 卦象卡（揭示/解读阶段）：标题 + 卦名 + 完整卦象 */
function HexagramBlock({
  id,
  name,
  matrix,
  title,
}: {
  id?: number | undefined;
  name?: string | undefined;
  matrix?: number[][] | undefined;
  title: string;
}) {
  if (!matrix || matrix.length === 0) return null;
  const lines = matrix.map((r) => lineTypeOf(Array.isArray(r) ? r : []));
  // 后端 name 为英文，按文王卦序取中文展示（表外回退原名）
  const displayName = hexagramZh(id, name);
  return (
    <div className="rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5">
      <p className="text-xs font-semibold tracking-widest text-vermilion-deep">{title}</p>
      {displayName ? (
        <p className="mt-1 text-center text-lg font-bold text-ink">{displayName}</p>
      ) : null}
      <div className="mt-3">
        <HexagramLines lines={lines} />
      </div>
    </div>
  );
}

type Phase = "form" | "toss" | "reveal" | "reading" | "done";

function Liuyao() {
  const price = useFeaturePrice("DIVINATION", 1);
  const featureEnabled = useFeatureEnabled("DIVINATION");
  const { loggedIn } = useAuth();
  const [phase, setPhase] = useState<Phase>("form");
  const [question, setQuestion] = useState("");
  const [err, setErr] = useState("");
  const [toss, setToss] = useState<TossResp | null>(null);
  const [tossed, setTossed] = useState(0); // 已掷爻数（0-6）
  const [rolling, setRolling] = useState(false); // 铜钱抛掷动画中
  const [gen, setGen] = useState(0); // 飞行动代替数（重挂动画用）
  // think/正文解析（共享 hook）：后端逐 token 清洗 <think> 会漏跨 token 残片，客户端全量重算
  const stream = useThinkStream();
  const [showPaywall, setShowPaywall] = useState(false);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [openReading, setOpenReading] = useState("");
  const streamRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => () => streamRef.current?.abort(), []);

  const requireLogin = () => {
    if (!getTokenPresent()) {
      window.location.href = "/login?redirect=" + encodeURIComponent("/liuyao");
      return false;
    }
    return true;
  };
  const getTokenPresent = () => !!getAuthUser()?.userId;

  /** seed：随机熵（Web 无传感器，取系统随机 + 时间戳——起卦确定性由后端保证） */
  const makeSeed = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "-" + Date.now();
  };

  const startToss = async (guest: boolean) => {
    setErr("");
    const q = question.trim();
    if (!q) return setErr("请先写下想问的事");
    if (!guest && !requireLogin()) return;
    track(guest ? "liuyao_guest_start" : "liuyao_toss_start", {});
    try {
      const resp = guest
        ? await post<TossResp>(
            "/api/v1/oracle/guest-toss",
            { question: q, seed: makeSeed() },
            { auth: false },
          )
        : await post<TossResp>("/api/v1/oracle/toss", {
            userId: getAuthUser()?.userId,
            question: q,
            seed: makeSeed(),
          });
      setToss(resp);
      setTossed(0);
      setRolling(false);
      stream.reset();
      setPhase("toss");
      if (!guest) refreshBalance().catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "起卦失败，请稍后再试";
      setErr(msg);
      if (/余额|402|不足/.test(msg)) setShowPaywall(true);
    }
  };

  const tossNext = () => {
    if (!toss || tossed >= 6 || rolling) return;
    stopHold();
    setGen((g) => g + 1); // 重置 CSS 飞行动画（key 变更 + class 重挂）
    setRolling(true);
    // 三枚币飞行 1.3s + 末枚延迟 0.16s，落定后记爻（App 端 shake 0.9s + flight 1.6s 的合并口径）
    setTimeout(() => {
      setRolling(false);
      setTossed((n) => {
        const next = n + 1;
        if (next >= 6) setTimeout(() => setPhase("reveal"), 700);
        return next;
      });
    }, 1500);
  };

  // 长按蓄力起卦（App 端 hold 按钮同款）：按住进度从底部涨满即掷一爻，松手取消
  const holdRaf = useRef<number | null>(null);
  const [holdPct, setHoldPct] = useState(0);
  const startHold = () => {
    if (rolling || tossed >= 6 || holdRaf.current != null) return;
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1100);
      setHoldPct(p);
      if (p >= 1) {
        stopHold();
        tossNext();
        return;
      }
      holdRaf.current = requestAnimationFrame(tick);
    };
    holdRaf.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    if (holdRaf.current != null) cancelAnimationFrame(holdRaf.current);
    holdRaf.current = null;
    setHoldPct(0);
  };
  useEffect(() => () => stopHold(), []);

  /** AI 流式解读（登录用户）；游客用公开卦辞 RAG */
  const startReading = () => {
    if (!toss) return;
    setPhase("reading");
    if (toss.logId) {
      let got = false;
      streamRef.current = streamPost({
        path: `/api/v1/oracle/stream-reading?log_id=${encodeURIComponent(toss.logId)}&scenario=general&lang=zh`,
        idleTimeoutMs: 300_000,
        onEvent: (obj) => {
          stream.push(obj["thinking"], obj["answer"]);
          got = got || !!obj["answer"] || !!obj["thinking"];
          if (typeof obj["error"] === "string" && obj["error"]) setErr(obj["error"]);
        },
        onDone: () => setPhase("done"),
        onError: (e) => {
          setErr(e.message);
          if (got) setPhase("done");
        },
      });
    } else {
      get<{ interpretation?: string }>(
        `/api/v1/oracle/hexagram/${toss.hexagramOriginId ?? 1}/reading`,
        { lang: "zh" },
        { auth: false },
      )
        .then((r) => {
          stream.setText(r?.interpretation ?? "（卦辞解读暂不可用）");
          setPhase("done");
        })
        .catch(() => {
          stream.setText("（卦辞解读暂不可用）");
          setPhase("done");
        });
    }
  };

  const loadHistory = () => {
    const uid = getAuthUser()?.userId;
    if (!uid) return;
    get<HistoryItem[]>("/api/v1/oracle/my-oracles", { user_id: uid })
      .then(setHistory)
      .catch(() => setHistory([]));
  };

  const openHistory = (item: HistoryItem) => {
    if (openLog === item.logId) return setOpenLog(null);
    if (item.aiReading) {
      setOpenLog(item.logId);
      setOpenReading(item.aiReading);
      return;
    }
    setOpenLog(item.logId);
    setOpenReading(item.aiReadingPreview ?? "");
    get<HistoryItem>(`/api/v1/oracle/${item.logId}/detail`)
      .then((d) => setOpenReading(d?.aiReading ?? ""))
      .catch(() => {});
  };

  const reset = () => {
    streamRef.current?.abort();
    stopHold();
    setPhase("form");
    setToss(null);
    setTossed(0);
    setRolling(false);
    stream.reset();
    setErr("");
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="六爻占卜" path="/liuyao" />
      {featureEnabled === false ? (
        <FeatureClosed title="六爻占卜" />
      ) : (
        <>
          <PageHeader
            eyebrow={`消耗 ${price} 点${loggedIn ? "" : " · 游客免费一卦"}`}
            title="六爻占卜"
            desc="心中默念所问之事，三枚铜钱六次成卦。本卦观当下，变卦看走向。"
          />

          {phase === "form" ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <Field label="所问之事" required>
                <textarea
                  className={inputCls + " min-h-28 resize-none"}
                  maxLength={200}
                  placeholder="如：这次的合作能成吗？适合什么时候签约？"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </Field>
              <p className="mt-2 text-[11px] text-ink-faint">一卦一事，问得越具体，解得越明白。</p>
              {err ? <p className="mt-2 text-xs text-vermilion-deep">{err}</p> : null}
              <button
                onClick={() => startToss(false)}
                className="mt-4 w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
              >
                起卦（{price} 点）
              </button>
              <button
                onClick={() => startToss(true)}
                className="mt-2 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper"
              >
                免费起一卦（不落记录）
              </button>
            </section>
          ) : phase === "toss" ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              {/* 已掷 N 爻 + 提示（App 端 castProgress / tapHint 同款版式） */}
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                已掷 {tossed} 爻
              </p>
              <p className="mt-1.5 text-center text-base italic text-ink">
                轻点铜钱，或长按下方起卦
              </p>

              {/* 掷币竞技场：涟漪环 + 三枚铜钱抛掷（币面=本爻 coinMatrix） */}
              <div className="mt-4">
                <CoinArena
                  row={
                    rolling
                      ? (toss?.coinMatrix?.[tossed] ?? [1, 1, 1])
                      : tossed > 0
                        ? (toss?.coinMatrix?.[tossed - 1] ?? [1, 1, 1])
                        : [1, 1, 1]
                  }
                  rolling={rolling}
                  generation={gen}
                  onTap={tossNext}
                />
              </div>
              <p className="text-center text-[13px] tracking-[0.25em] text-ink-faint">
                {tossed} / 6
              </p>

              {/* 卦象逐爻点亮（未掷为空槽） */}
              <div className="mt-6">
                <HexagramLines
                  lines={(toss?.coinMatrix ?? []).map((r) => lineTypeOf(r))}
                  drawn={tossed}
                />
              </div>

              {/* 长按蓄力按钮：进度自底部涨满即掷一爻，松手取消（App 端 hold 按钮同款） */}
              {tossed < 6 ? (
                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={startHold}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") tossNext();
                  }}
                  className={[
                    "relative mt-6 h-20 w-full cursor-pointer select-none overflow-hidden rounded-[20px] border-[1.5px] transition-colors",
                    holdPct > 0 ? "border-[#A97B1F]/70 bg-paper-3" : "border-ink/20 bg-paper-3/60",
                  ].join(" ")}
                >
                  {holdPct > 0 ? (
                    <span
                      className="absolute bottom-0 left-0 w-full bg-[#A97B1F]/25"
                      style={{ height: `${holdPct * 100}%` }}
                    />
                  ) : null}
                  {rolling ? (
                    <span className="absolute inset-x-0 bottom-0 h-1.5 animate-pulse bg-[#A97B1F]/70" />
                  ) : null}
                  <span className="absolute inset-0 grid place-items-center">
                    {holdPct > 0 ? (
                      <span className="text-lg font-bold tabular-nums text-[#8A5A1E]">
                        {Math.round(holdPct * 100)}%
                      </span>
                    ) : (
                      <span className="text-base text-ink">
                        {rolling ? "铜钱翻飞中…" : "长按起卦"}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <p className="mt-6 text-center text-sm text-vermilion-deep">六爻既成，卦象显现…</p>
              )}
            </section>
          ) : phase === "reveal" ? (
            <section className="mt-7 space-y-4">
              <div className={toss?.hexagramChangeId ? "grid gap-4 md:grid-cols-2" : ""}>
                <HexagramBlock
                  title="本卦"
                  id={toss?.hexagramOriginId}
                  name={toss?.hexagramOriginName}
                  matrix={toss?.coinMatrix}
                />
                {toss?.hexagramChangeId ? (
                  <HexagramBlock
                    title="变卦"
                    id={toss?.hexagramChangeId}
                    name={toss?.hexagramChangeName}
                    matrix={toss?.changedCoinMatrix}
                  />
                ) : null}
              </div>
              <button
                onClick={startReading}
                className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
              >
                开始解读
              </button>
            </section>
          ) : (
            <section className="mt-7 space-y-4">
              <div className={toss?.hexagramChangeId ? "grid gap-4 md:grid-cols-2" : ""}>
                <HexagramBlock
                  title="本卦"
                  id={toss?.hexagramOriginId}
                  name={toss?.hexagramOriginName}
                  matrix={toss?.coinMatrix}
                />
                {toss?.hexagramChangeId ? (
                  <HexagramBlock
                    title="变卦"
                    id={toss?.hexagramChangeId}
                    name={toss?.hexagramChangeName}
                    matrix={toss?.changedCoinMatrix}
                  />
                ) : null}
              </div>
              {phase === "reading" && !stream.visible && !stream.thinkLive ? (
                <div className="flex items-center gap-3 rounded-xl bg-paper-2 p-4 ring-1 ring-ink/5">
                  <span className="size-2 animate-pulse rounded-full bg-vermilion" />
                  <p className="text-sm font-medium">正在推演卦意…</p>
                </div>
              ) : null}
              <ThinkAnswerBox
                think={stream.think}
                thinkLive={stream.thinkLive}
                visible={stream.visible}
                placeholder="凝神推演中…"
              />
              {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
              {phase === "done" ? (
                <button
                  onClick={reset}
                  className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper"
                >
                  再问一卦
                </button>
              ) : null}
            </section>
          )}

          {loggedIn ? (
            <section className="mt-10">
              <button
                onClick={() => (history === null ? loadHistory() : setHistory(null))}
                className="text-sm font-semibold text-ink"
              >
                {history === null ? "▸ 我的卦象记录" : "▾ 我的卦象记录"}
              </button>
              {history !== null ? (
                history.length === 0 ? (
                  <p className="mt-3 rounded-2xl bg-paper-2 p-5 text-center text-xs text-ink-faint ring-1 ring-ink/5">
                    还没有卦象记录，起第一卦吧。
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {history.map((h) => (
                      <div key={h.logId} className="rounded-2xl bg-paper-2 ring-1 ring-ink/5">
                        <button
                          onClick={() => openHistory(h)}
                          className="flex w-full items-center justify-between gap-3 p-4 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-ink">{h.question}</p>
                            <p className="mt-0.5 text-[11px] text-ink-faint">
                              {hexagramZh(h.hexagramOriginId, h.hexagramOriginName)}
                              {h.hexagramChangeId
                                ? ` → ${hexagramZh(h.hexagramChangeId, h.hexagramChangeName)}`
                                : ""}
                              {h.createdAt
                                ? ` · ${new Date(h.createdAt).toLocaleString("zh-CN")}`
                                : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-ink-faint">
                            {openLog === h.logId ? "收起" : "展开"}
                          </span>
                        </button>
                        {openLog === h.logId ? (
                          <div className="border-t border-ink/5 p-4">
                            <MiniMarkdown text={openReading || "（暂无解读）"} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </section>
          ) : null}
        </>
      )}
      {showPaywall ? <RechargeModal message={err} onClose={() => setShowPaywall(false)} /> : null}
    </AppShell>
  );
}
