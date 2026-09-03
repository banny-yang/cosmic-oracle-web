/**
 * 首页「模拟取名过程」演示：五幕自动循环（点击跳幕 / 悬停暂停 / 尊重 reduced-motion）。
 * 数据为静态演示（与真实生成结果同口径的示例），不调后端。
 */
import { useEffect, useMemo, useState } from "react";

const SCENES = [
  { key: "form", title: "录入出生信息", sub: "姓氏与生辰，按出生地校正真太阳时" },
  { key: "xiyong", title: "喜用判定", sub: "排定日主与强弱，得出补益方向" },
  { key: "pool", title: "字库筛选", sub: "候选字按喜用五行过滤" },
  { key: "classic", title: "典籍推演", sub: "从诗经楚辞与唐宋诗词中取意" },
  { key: "result", title: "方案成型", sub: "数理核验、谐音扫描后按推荐指数排序" },
] as const;

const SCENE_MS = 2600;
const RESULT_MS = 3400;

/** 字库演示：命中喜用（金/水）的字保留高亮，其余淡出 */
const POOL: { ch: string; hit: boolean }[] = [
  { ch: "铮", hit: true }, { ch: "伟", hit: false }, { ch: "霖", hit: true }, { ch: "婷", hit: false },
  { ch: "沐", hit: true }, { ch: "澄", hit: true }, { ch: "锐", hit: false }, { ch: "渊", hit: true },
  { ch: "钊", hit: true }, { ch: "芸", hit: false }, { ch: "铭", hit: true }, { ch: "霖", hit: true },
];

const CLASSIC_TEXT = "沐雨栉风，润泽焕新；取「沐」之润、「秋」之澄，金水相生，补益喜用。";
const CLASSIC_SOURCE = "《楚辞·九歌》 · 「沐雨栉风」化用";

export function NamingDemo() {
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [typed, setTyped] = useState(0);

  // 幕推进：无条件自动播放；reduce 环境仅省去幕内微动画（打字机/入场），轮换照常
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), scene === 4 ? RESULT_MS : SCENE_MS);
    return () => clearTimeout(t);
  }, [scene, paused]);

  // 第四幕打字机（reduce 环境直接整段呈现）
  useEffect(() => {
    if (scene !== 3) {
      setTyped(0);
      return;
    }
    if (reduceMotion) {
      setTyped(CLASSIC_TEXT.length);
      return;
    }
    const t = setInterval(() => {
      setTyped((n) => {
        if (n >= CLASSIC_TEXT.length) {
          clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, 65);
    return () => clearInterval(t);
  }, [scene, reduceMotion]);

  const jump = (i: number) => setScene(i);

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">一次生成的全过程</h2>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
        从出生信息到十个方案，中间发生了什么？下面是一次生成的真实流程（演示数据）。
      </p>

      <div
        className="mt-4 md:grid md:grid-cols-12 md:gap-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* 阶段导航 */}
        <div className="md:col-span-5">
          {/* 移动端：横向五点 */}
          <div className="flex items-center gap-1.5 md:hidden">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                onClick={() => jump(i)}
                aria-label={s.title}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i === scene ? "bg-vermilion" : "bg-ink/10"}`}
              />
            ))}
          </div>
          <p className="mt-2.5 text-sm font-semibold md:hidden">
            {scene + 1}. {SCENES[scene].title}
          </p>

          {/* 桌面端：阶段列表 */}
          <ol className="mt-1 hidden space-y-1 md:block">
            {SCENES.map((s, i) => (
              <li key={s.key}>
                <button
                  onClick={() => jump(i)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                    i === scene ? "bg-vermilion/10 ring-1 ring-vermilion/20" : "hover:bg-paper-2"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      i < scene
                        ? "bg-ink text-paper"
                        : i === scene
                          ? "bg-vermilion text-paper"
                          : "bg-paper-3 text-ink-faint"
                    }`}
                  >
                    {i < scene ? "✓" : i + 1}
                  </span>
                  <span>
                    <span className={`block text-sm font-medium ${i === scene ? "text-ink" : "text-ink-soft"}`}>
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">{s.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <p className="mt-3 hidden text-[11px] text-ink-faint md:block">
            {paused ? "已暂停（鼠标移开继续）" : "自动播放中 · 点击任一步可跳转"}
          </p>
        </div>

        {/* 演示面板 */}
        <div className="mt-4 min-h-[300px] rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5 md:col-span-7 md:mt-1 md:min-h-[320px]">
          {scene === 0 ? <SceneForm /> : null}
          {scene === 1 ? <SceneXiyong /> : null}
          {scene === 2 ? <ScenePool /> : null}
          {scene === 3 ? <SceneClassic typed={typed} /> : null}
          {scene === 4 ? <SceneResult /> : null}
        </div>
      </div>
    </section>
  );
}

/* ───────── 五幕 ───────── */

function SceneForm() {
  const rows = [
    { label: "姓氏", value: "王" },
    { label: "出生时间", value: "2024-03-10 02:00" },
    { label: "出生地", value: "北京 · 39.9°N, 116.4°E" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="demo-step flex items-center justify-between rounded-xl bg-paper-3/70 px-4 py-3"
          style={{ animationDelay: `${i * 260}ms` }}
        >
          <span className="text-xs text-ink-faint">{r.label}</span>
          <span className="text-sm font-medium text-ink">{r.value}</span>
        </div>
      ))}
      <div className="demo-step flex items-center gap-2 rounded-xl bg-vermilion/10 px-4 py-3" style={{ animationDelay: "820ms" }}>
        <span className="grid size-6 place-items-center rounded-full bg-vermilion font-seal text-xs text-paper">时</span>
        <p className="text-xs leading-relaxed text-ink-soft">
          真太阳时校正：<span className="font-semibold text-ink">02:00 → 01:46</span>（按经度 116.4°E 与时区差修正）
        </p>
      </div>
    </div>
  );
}

function SceneXiyong() {
  const badge = "rounded-full px-4 py-2 text-sm font-semibold";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-4">
      <div className="flex items-center gap-3">
        <span className={`${badge} bg-sky-800/85 text-sky-50`}>日主 · 水</span>
        <span className={`${badge} bg-paper-3 text-ink-soft`}>身弱</span>
      </div>
      <span className="demo-step text-ink-faint" style={{ animationDelay: "600ms" }}>↓ 宜生扶</span>
      <div className="flex items-center gap-3">
        <span className={`demo-step ${badge} bg-stone-600/90 text-stone-50`} style={{ animationDelay: "900ms" }}>
          喜用 · 金主
        </span>
        <span className={`demo-step ${badge} bg-sky-800/85 text-sky-50`} style={{ animationDelay: "1250ms" }}>
          水辅
        </span>
      </div>
      <p className="demo-step mt-1 max-w-[34ch] text-center text-xs leading-relaxed text-ink-soft" style={{ animationDelay: "1600ms" }}>
        「日元癸水偏弱，宜生扶，取金为主、水为辅」——名字用字优先贴合喜用。
      </p>
    </div>
  );
}

function ScenePool() {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="grid grid-cols-6 gap-2">
        {POOL.map((c, i) => (
          <span
            key={i}
            className={`demo-tile grid aspect-square place-items-center rounded-xl font-seal text-2xl ${
              c.hit ? "bg-vermilion/12 text-ink ring-1 ring-vermilion/35" : "bg-paper-3/60 text-ink-faint opacity-45"
            }`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {c.ch}
          </span>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        候选字库按<span className="font-semibold text-ink">喜用五行（金/水）</span>过滤：命中的字保留，其余淡出；再经音律组合与避用字校验。
      </p>
    </div>
  );
}

function SceneClassic({ typed }: { typed: number }) {
  const done = typed >= CLASSIC_TEXT.length;
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <p className="rounded-xl bg-paper-3/60 p-4 text-sm leading-loose text-ink">
        {CLASSIC_TEXT.slice(0, typed)}
        {!done ? <span className="animate-pulse text-vermilion">▍</span> : null}
      </p>
      <div className={`demo-step flex items-center gap-3 transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"}`}>
        <span className="grid size-7 place-items-center rounded-lg bg-vermilion font-seal text-sm text-paper">典</span>
        <p className="text-xs text-ink-soft">
          出处已附：<span className="font-medium text-ink">{CLASSIC_SOURCE}</span>
        </p>
      </div>
    </div>
  );
}

function SceneResult() {
  const wuge = [
    { label: "天格", value: 5 },
    { label: "人格", value: 12 },
    { label: "地格", value: 18 },
    { label: "外格", value: 11 },
    { label: "总格", value: 22 },
  ];
  return (
    <div className="relative rounded-2xl bg-paper-3/40 p-5">
      <span className="absolute top-0 right-5 flex flex-col items-center rounded-b-lg bg-vermilion px-2 py-1.5 font-seal text-xs leading-tight text-paper">
        <span>推</span>
        <span>荐</span>
      </span>
      <div className="demo-card flex items-end gap-2">
        {["王", "沐", "秋"].map((ch, i) => (
          <span key={i} className="font-seal text-4xl leading-none text-ink">
            {ch}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">wù qiū</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="size-1.5 rounded-full bg-vermilion" />
        <span className="font-semibold text-vermilion-deep">推荐指数 84</span>
        <span className="text-ink-faint">· 补益喜用 · 有典有据</span>
      </p>
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
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span>三才</span>
          {["土", "木", "金"].map((ch, i) => (
            <span key={i} className="rounded bg-paper-3 px-1.5 py-0.5">{ch}</span>
          ))}
        </div>
        <span className="text-[11px] text-ink-faint">✓ 谐音安全</span>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">以上为演示数据；真实生成一次产出 10 个方案并附完整理由。</p>
    </div>
  );
}
