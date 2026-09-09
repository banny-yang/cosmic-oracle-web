import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.oracle.duimai.net/help" }],
    meta: [
      { title: "帮助中心 · 对脉名鉴" },
      { name: "description", content: "宝宝起名、账号点数、充值与常见问题的使用指南。" },
    ],
  }),
});

const FAQ: [string, string][] = [
  ["怎么给宝宝起名？", "打开「宝宝起名」，填写姓氏、出生日期时间与出生地（用于真太阳时排盘），可选风格与典籍偏好后开始推演，一次生成 10 个带出处与推荐指数的名字方案。"],
  ["名字是怎么选出来的？", "按出生时间排出五行喜用（如日主木偏弱则水为主、木为辅），从优选字库筛选（含生肖部首宜忌、音律平仄、方言谐音检测），再由 AI 结合典籍为每个名字配出处与判词。"],
  ["点数怎么收费？", "宝宝起名每次 6 点；24 小时内换一批不重复扣点。未充值新用户首次免费体验（展示 3 个精选名字）。"],
  ["怎么充值点数？", "网页端暂不支持支付。微信扫「我的」页或解锁提示处的小程序码，进入「对脉名鉴」小程序，登录同一账号（手机号或微信）即可充值；点数网页端与小程序通用。"],
  ["生成要多久？", "通常 1~3 分钟（含真太阳时排盘、字库筛选与 AI 典籍推演），过程中会逐步展示四柱与喜用结论。"],
  ["能把名字分享给家人吗？", "每个名字可生成古风海报（下载或分享），也可勾选 3~5 个名字发起亲友投票，家人打开链接即可参与。"],
  ["典籍出处可信吗？", "每个引用都经过校验：引文正文必须包含名字用字、出处精确到篇目；校验通过的名字会带「已校验」徽标。"],
  ["名字用字不满意怎么办？", "支持长辈避讳（同字同音自动规避）、避用字、指定字辈；「换一批」会自动排除已看过的名字。"],
  ["怎么联系客服？", "客服微信：duimaikefu（工作日 9:00-18:00）；也可通过小程序「联系客服」反馈。"],
  ["账号与隐私？", "支持手机验证码与微信扫码登录；注销账号后个人信息删除或匿名化。详见隐私政策。"],
];

function HelpPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="支持" title="帮助中心" desc="使用指南与常见问题。" />
      <section className="ink-in d1 mt-7 space-y-3">
        {FAQ.map(([q, a], i) => (
          <details key={i} className="group rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5">
            <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
              <span className="mr-2 text-vermilion-deep">Q</span>{q}
            </summary>
            <p className="mt-2 pl-6 text-xs leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
      </section>
    </AppShell>
  );
}
