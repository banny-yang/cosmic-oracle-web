import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "对脉名鉴 · 起名与姓名文化参考" },
      {
        name: "description",
        content:
          "宝宝起名、姓名解析、性格契合测评与婚姻契合分析。从字义、音韵与诗句出处出发，为重要的人取一个经得起时间的名字。",
      },
      { property: "og:title", content: "对脉名鉴 · 起名与姓名文化参考" },
      {
        property: "og:description",
        content: "四个姓名文化小工具：宝宝起名、姓名解析、性格契合测评、婚姻契合分析。",
      },
    ],
  }),
});

const features = [
  { to: "/naming", seal: "童", title: "宝宝起名", desc: "按生辰与偏好，生成有出处的名字", cost: "消耗 5 点", delay: "d1" },
  { to: "/analysis", seal: "析", title: "姓名解析", desc: "逐字拆解字义与音韵的来路", cost: "消耗 3 点", delay: "d1" },
  { to: "/personality", seal: "性", title: "性格契合测评", desc: "以性格倾向看相处的分寸", cost: "消耗 4 点", delay: "d2" },
  { to: "/marriage", seal: "缘", title: "婚姻契合分析", desc: "七维评分，仅供趣味参考", cost: "消耗 6 点", delay: "d2" },
] as const;

/** 首页静态示例（展示用，非真实数据） */
const sample = {
  name: "沈清嘉",
  pinyin: "shěn qīng jiā",
  chars: [
    { ch: "清", meaning: "水清而明，喻品性澄澈" },
    { ch: "嘉", meaning: "美善吉祥，寓德行温厚" },
  ],
  source: "「重湖叠巘清嘉」—— 宋 · 柳永《望海潮》。",
};

const sampleDimensions = [
  { label: "沟通契合", score: 86 },
  { label: "价值共鸣", score: 78 },
  { label: "节奏互补", score: 82 },
  { label: "成长同行", score: 74 },
];

function Index() {
  const { loggedIn } = useAuth();

  return (
    <AppShell>
      <PageHeader
        eyebrow="新中式 · 起名文化"
        title="为名寻一段有来历的雅意"
        desc="从字义、音韵与诗句出处出发，为重要的人取一个经得起时间的名字。"
      />

      <section className="mt-7 grid grid-cols-2 gap-3">
        {features.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className={`ink-in ${f.delay} rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-1`}
          >
            <div className="grid size-9 place-items-center rounded-lg bg-ink/90 text-paper">
              <span className="font-seal text-base leading-none">{f.seal}</span>
            </div>
            <p className="mt-3 text-base font-semibold text-balance">{f.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{f.desc}</p>
            <p className="mt-2 text-[11px] font-medium text-vermilion-deep">{f.cost}</p>
          </Link>
        ))}
      </section>

      <div className="ink-in d2 mt-8">
        <Link
          to={loggedIn ? "/records" : "/login"}
          className="flex items-center justify-between rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-0.5"
        >
          <div>
            <h2 className="text-lg font-semibold">我的解析</h2>
            <p className="mt-1 text-xs text-ink-soft">
              {loggedIn ? "查看起名方案与解析报告的历史记录" : "登录后同步你的解析记录与购买内容"}
            </p>
          </div>
          <span className="text-xl text-ink-faint">›</span>
        </Link>
      </div>

      <div className="ink-in d3 mt-9">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">示例荐名</h2>
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper">姓氏 沈</span>
        </div>

        <div className="relative mt-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <div className="absolute top-4 right-4 grid size-11 place-items-center rounded-lg bg-vermilion text-paper shadow-sm">
            <span className="font-seal text-2xl leading-none">佳</span>
          </div>
          <p className="pr-14 font-seal text-4xl leading-none text-ink">{sample.name}</p>
          <p className="mt-2 text-sm tracking-wider text-ink-soft">{sample.pinyin}</p>

          <div className="mt-4 space-y-2 border-t border-ink/5 pt-4 text-sm">
            {sample.chars.map((c) => (
              <p key={c.ch} className="flex gap-2">
                <span className="w-8 shrink-0 text-ink-faint">{c.ch}</span>
                <span className="text-pretty">{c.meaning}</span>
              </p>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-ink/[0.04] p-3">
            <p className="text-xs leading-relaxed text-ink-soft text-pretty">{sample.source}</p>
          </div>

          <Link
            to="/naming"
            className="mt-5 block w-full rounded-xl bg-ink py-2.5 text-center text-sm font-medium text-paper ring-1 ring-ink/40 transition-transform duration-300 hover:-translate-y-0.5"
          >
            为我家宝宝生成
          </Link>
        </div>
      </div>

      <div className="ink-in d3 mt-9">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">婚姻契合示例</h2>
          <span className="text-xs text-ink-faint">仅供娱乐参考</span>
        </div>
        <div className="mt-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-ink-soft">契合指数</p>
              <p className="mt-1 text-4xl leading-none font-semibold tabular-nums text-ink">
                82<span className="ml-1 text-base text-ink-faint">/ 100</span>
              </p>
            </div>
            <p className="text-right text-xs leading-relaxed text-ink-soft">
              林知微
              <br />× 沈月如
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {sampleDimensions.map((d) => (
              <div key={d.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-ink-soft">{d.label}</span>
                  <span className="tabular-nums">{d.score}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <div className="bar-grow h-full rounded-full bg-vermilion" style={{ width: `${d.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
            共七维评分，此处展示四维；完整报告含相处建议。
          </p>
        </div>
      </div>

      <div className="ink-in d3 mt-8">
        <Link
          to="/naming"
          className="block w-full rounded-2xl bg-vermilion py-3.5 text-center text-base font-semibold text-paper ring-1 ring-vermilion-deep/40 transition-transform duration-300 hover:-translate-y-0.5"
        >
          开始为TA起名
        </Link>
      </div>
    </AppShell>
  );
}
