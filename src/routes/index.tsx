import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { get } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "对脉名鉴 · 起名与姓名文化参考" },
      {
        name: "description",
        content:
          "宝宝起名、姓名解析、性格契合测评与婚姻契合分析。按生辰喜用与五格数理，从典籍中为宝宝取一个有出处、有数理、有温度的名字。",
      },
      { property: "og:title", content: "对脉名鉴 · 好名字,有出处、有数理、有温度" },
      {
        property: "og:description",
        content: "一次生成 10 个有推荐指数与典籍出处的名字方案，支持亲友投票一起定。",
      },
    ],
  }),
});

/* ───────── 数据 ───────── */

interface SocialProof {
  todayCount?: number;
  namingFamilies?: number;
  avgMinutes?: number;
  feed?: { type: string; text: string; minutesAgo: number }[];
}

const features = [
  {
    to: "/naming",
    seal: "童",
    title: "宝宝起名",
    desc: "按生辰喜用与典籍出处，一次生成 10 个带推荐指数的名字方案，附五格数理与谐音检测，可发起亲友投票。",
    cost: "消耗 5 点",
    delay: "d1",
  },
  {
    to: "/analysis",
    seal: "析",
    title: "姓名解析",
    desc: "逐字拆解字义、音韵与诗句出处，读出两个名字各自的气质与共振之处。",
    cost: "消耗 3 点",
    delay: "d1",
  },
  {
    to: "/personality",
    seal: "性",
    title: "性格契合测评",
    desc: "以传统性格倾向看两个人相处的分寸，给出有温度的相处建议。",
    cost: "消耗 4 点",
    delay: "d2",
  },
  {
    to: "/marriage",
    seal: "缘",
    title: "婚姻契合分析",
    desc: "七维评分与相处建议，把两个人的契合讲清楚、说明白。",
    cost: "消耗 6 点",
    delay: "d2",
  },
] as const;

const steps = [
  {
    seal: "时",
    title: "真太阳时校正",
    desc: "按出生地经纬度校正时辰，排盘口径与传统命书一致。",
  },
  {
    seal: "用",
    title: "喜用五行判定",
    desc: "依生辰判定补益方向，名字用字优先贴合喜用。",
  },
  {
    seal: "典",
    title: "典籍取意",
    desc: "诗经、楚辞、唐宋诗词——每个名字都附原文出处。",
  },
  {
    seal: "数",
    title: "五格数理",
    desc: "康熙笔画起五格，81 数理逐一核验，格数带「画」明示。",
  },
  {
    seal: "音",
    title: "谐音安全扫描",
    desc: "自动排查不良谐音与绕口组合，名字念得出口。",
  },
  {
    seal: "议",
    title: "亲友投票共决",
    desc: "一条链接发给家人，投票一起定，起名不再各执一词。",
  },
];

const faqs = [
  {
    q: "名字是怎么生成的？",
    a: "按出生信息完成真太阳时校正与喜用五行判定后，从候选字库筛选并参考《诗经》《楚辞》、唐宋诗词等典籍推演组合，再经五格数理与谐音安全核验，按推荐指数排序呈现。内容由算法基于传统文化整理，仅供文化参考。",
  },
  {
    q: "网页端和小程序数据互通吗？",
    a: "完全互通。用同一手机号或微信登录，解析记录、购买点数与解锁内容在网页端和小程序（对脉名鉴）间同步；网页端可用点数直接生成报告，充值在小程序内完成。",
  },
  {
    q: "会不会重名或出现生僻字？",
    a: "候选字库经过筛选，支持指定用字与避用字（如长辈名讳），并可勾选风格与典籍偏好；组合时会校验音律与谐音，减少拗口与歧义。",
  },
  {
    q: "内容可信度如何？",
    a: "对脉名鉴是姓名文化参考工具：字义、出处与数理均基于传统文化与公开典籍整理，仅供文化参考与娱乐，不构成任何决策依据。",
  },
];

/** 首页静态示例（展示用，非真实用户数据） */
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

/* ───────── 页面 ───────── */

function Index() {
  const { loggedIn } = useAuth();
  const [social, setSocial] = useState<SocialProof | null>(null);

  useEffect(() => {
    // 匿名统计（失败静默隐藏，不展示假数字）
    get<SocialProof>("/api/v1/stats/social-proof", {}, { auth: false, timeoutMs: 6000 })
      .then(setSocial)
      .catch(() => {});
  }, []);

  const fmt = (n?: number) => (n == null ? "" : n >= 10000 ? (n / 10000).toFixed(1) + " 万" : String(n));

  return (
    <AppShell>
      {/* Hero */}
      <section className="ink-in mt-9 md:mt-12">
        <p className="text-xs tracking-[0.35em] text-vermilion-deep uppercase">新中式 · 起名文化</p>
        <h1 className="mt-4 max-w-[22ch] text-4xl leading-tight font-semibold text-balance md:text-5xl">
          好名字，有出处、有数理、有温度
        </h1>
        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-ink-soft text-pretty md:text-base">
          从《诗经》《楚辞》到唐宋诗词，按生辰喜用与五格数理，为宝宝拟一组经得起时间考验的名字——一次生成
          10 个方案，附推荐指数与原文出处，还能发起亲友投票一起定。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/naming"
            className="rounded-2xl bg-vermilion px-7 py-3 text-base font-semibold text-paper ring-1 ring-vermilion-deep/40 transition-transform duration-300 hover:-translate-y-0.5"
          >
            开始为TA起名
          </Link>
          <a
            href="#sample"
            className="rounded-2xl bg-paper-2 px-7 py-3 text-base font-medium text-ink ring-1 ring-ink/10 transition-transform duration-300 hover:-translate-y-0.5"
          >
            先看示例
          </a>
        </div>

        {social ? (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-faint">
            {social.todayCount != null ? <span>今日已生成 {fmt(social.todayCount)} 组方案</span> : null}
            {social.namingFamilies ? <span>累计服务 {fmt(social.namingFamilies)} 个家庭</span> : null}
            {social.avgMinutes ? <span>平均 {Math.round(social.avgMinutes)} 分钟出一批</span> : null}
          </div>
        ) : null}

        {social?.feed?.length ? (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {social.feed.slice(0, 6).map((f, i) => (
              <span
                key={i}
                className="shrink-0 rounded-full bg-paper-2 px-3 py-1.5 text-[11px] text-ink-soft ring-1 ring-ink/5"
              >
                {f.text}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* 功能矩阵 */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">四个工具，把「名」的事讲清楚</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {features.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className={`ink-in ${f.delay} flex flex-col rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-1`}
            >
              <div className="grid size-9 place-items-center rounded-lg bg-ink/90 text-paper">
                <span className="font-seal text-base leading-none">{f.seal}</span>
              </div>
              <p className="mt-3 text-base font-semibold text-balance">{f.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-soft">{f.desc}</p>
              <p className="mt-3 text-[11px] font-medium text-vermilion-deep">{f.cost}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 我的解析入口 */}
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

      {/* 六道工序 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">六道工序，只为经得起推敲的名字</h2>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
          每一批方案都按同一套流程生成，步骤透明，口径传统。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className={`ink-in d${(i % 3) + 1} flex gap-3 rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink/85 font-seal text-base text-paper">
                {s.seal}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 示例区 */}
      <section id="sample" className="mt-12 scroll-mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">示例荐名</h2>
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper">姓氏 沈</span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="relative rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
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

          <div className="rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-ink-soft">婚姻契合示例</p>
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
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">常被问到的</h2>
        <div className="mt-4 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {f.q}
                <span className="text-ink-faint transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="ink-in d3 mt-12">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-ink p-8 text-center text-paper">
          <span className="grid size-14 place-items-center rounded-xl bg-vermilion font-seal text-2xl">鉴</span>
          <h2 className="max-w-[26ch] text-xl leading-snug font-semibold text-balance">
            名字是送给孩子的第一件礼物，值得慢慢挑
          </h2>
          <Link
            to="/naming"
            className="w-full max-w-xs rounded-2xl bg-vermilion py-3.5 text-center text-base font-semibold text-paper transition-transform duration-300 hover:-translate-y-0.5"
          >
            开始为TA起名
          </Link>
          <p className="text-[11px] text-paper/60">网页与小程序同账号互通 · 点数通用</p>
        </div>
      </section>
    </AppShell>
  );
}
