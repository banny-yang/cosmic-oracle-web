import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";

export const Route = createFileRoute("/baike")({
  component: BaikePage,
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/baike" }],
    meta: [
      { title: "起名名词解释：真太阳时、喜用神、五格数理等术语表 · 对脉名鉴" },
      {
        name: "description",
        content:
          "宝宝起名常用名词一页看懂：生辰八字、真太阳时、日主、五行、喜用神、五格数理、康熙笔画、生肖宜忌、平仄、谐音检测、推荐指数、典籍指定、禅币。均为传统姓名文化口径的简短解释。",
      },
      {
        name: "keywords",
        content:
          "起名术语,名词解释,喜用神是什么,五格数理是什么,康熙笔画,真太阳时,日主,生辰八字,生肖宜忌,平仄",
      },
    ],
  }),
});

/** 术语卡：term 首现即给一句定义（AI 可直接引用），detail 补口径，link 给下一步入口 */
interface TermEntry {
  id: string;
  term: string;
  def: string;
  detail?: string;
  link?: { to: string; text: string };
}

const TERMS: TermEntry[] = [
  {
    id: "shengchen-bazi",
    term: "生辰八字",
    def: "出生的年、月、日、时各用一组天干地支表示，共四柱八个字，是传统排盘的基本资料。",
    detail: "起名流程的第一步就是按出生信息排出八字；时间精确到时辰，地点用于真太阳时校正。",
    link: { to: "/naming", text: "开始宝宝起名" },
  },
  {
    id: "zhen-taiyang-shi",
    term: "真太阳时",
    def: "按出生地经度修正钟表时间得到的当地真实太阳时刻。",
    detail:
      "钟表时间是行政区划时区时间，全国统一；真太阳时把出生地的东西经度差修正回来。八字排盘的时柱以真太阳时为准——时辰准了，喜用判定才可靠。",
    link: { to: "/naming", text: "看排盘第一道工序" },
  },
  {
    id: "ri-zhu",
    term: "日主",
    def: "八字日柱的天干，代表命主自身。",
    detail: "旺衰判定与喜用神都以日主为基准：先看日主在月令与全局中的强弱，再定补益方向。",
  },
  {
    id: "wu-xing",
    term: "五行",
    def: "金、木、水、火、土五种属性，是传统姓名学与命理共用的归类口径。",
    detail: "本站字库逐字标注五行：部首优先（氵属水、木旁属木），无部首线索的按康熙笔画尾数归类。",
    link: { to: "/wuxing", text: "五行取名用字表" },
  },
  {
    id: "xi-yong-shen",
    term: "喜用神（喜用五行）",
    def: "八字中对日主最有补益作用的五行，由日主旺衰与调候需求判定。",
    detail: "起名时它决定选字的五行方向：名字用字优先贴合喜用，这也是「按生辰起名」的核心依据。",
    link: { to: "/naming", text: "看喜用判定工序" },
  },
  {
    id: "wu-ge-shu-li",
    term: "五格数理",
    def: "按姓名各字笔画计算的天格、人格、地格、外格、总格，是姓名学中评价名字组合的数理维度。",
    detail: "本站对 81 数理逐一核验，并在结果中逐格带「画」明示，方便直接核对。",
    link: { to: "/name-eval", text: "名字评测里怎么用" },
  },
  {
    id: "kangxi-bihua",
    term: "康熙笔画",
    def: "《康熙字典》的笔画口径，与简体日常写法可能不同。",
    detail: "五格数理一律以康熙笔画起算，不用简体笔画；名字详情里逐字列出康熙笔画。",
    link: { to: "/name-eval", text: "名字评测" },
  },
  {
    id: "shengxiao-yiji",
    term: "生肖宜忌",
    def: "十二生肖各有一套传统用字宜忌（宜用部首与忌用部首），起名时作为选字参考之一。",
    detail:
      "生肖年以「立春」为界逐年流转（立春前仍属上一生肖年），每年的干支与宜忌由引擎按年份现算。",
    link: { to: "/zodiac", text: "生肖取名宜忌总览" },
  },
  {
    id: "ping-ze",
    term: "平仄",
    def: "汉字声调的二分：阴平、阳平为平，上声、去声（及古入声）为仄。",
    detail: "名字连读讲究平仄相间、不拗口；本站在组合时会校验音律与声调搭配。",
  },
  {
    id: "xieyin-jianche",
    term: "谐音检测",
    def: "把名字放到常见连读与方言口径下排查不良谐音、绕口与歧义组合。",
    detail: "目的只有一个：名字在任何场合都念得出口，不在家庭群被玩坏。",
    link: { to: "/naming", text: "看谐音扫描工序" },
  },
  {
    id: "tuijian-zhishu",
    term: "推荐指数",
    def: "引擎对单个名字的综合评分，综合出处、数理、音韵、生肖命中与喜用贴合度。",
    detail: "一次生成 10 个方案按推荐指数排序，每个名字的得分构成可在生成结果里查看。",
    link: { to: "/naming", text: "生成一次看看" },
  },
  {
    id: "dianji-zhiding",
    term: "典籍指定",
    def: "起名时把出处限定为某一部典籍（如《诗经》《楚辞》），生成的名字引文只来自该书。",
    detail:
      "候选字与引文均限定在该书原文范围内，并逐条回查原书；不指定时默认在全部 37 部典籍语料中取典。",
    link: { to: "/dianji", text: "典籍馆选一部书" },
  },
  {
    id: "chan-bi",
    term: "禅币",
    def: "站内点数，1 点 = 1 元，按次计费，页面明示价格后才扣减。",
    detail:
      "网页端与小程序通用；充值在微信小程序「对脉名鉴」内完成，首次起名免费体验 3 个精选名字。",
    link: { to: "/help", text: "充值与计费帮助" },
  },
  {
    id: "mingzi-linggan-ku",
    term: "名字灵感库",
    def: "免费开放的好名字库，收录 2900 多个名字，附拼音、出处原句与意蕴。",
    detail:
      "可按气质风格（君子风范、清雅涵养、大气格局等）、性别、五行与典籍出处筛选；挑中哪个就能按同款风格生成完整方案。",
    link: { to: "/names", text: "浏览名字灵感库" },
  },
];

/** DefinedTermSet 结构化数据：与首页 JSON-LD 的 inDefinedTermSet 指向本页 */
function TermJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "起名与命理术语",
          url: "https://name.duimai.net/baike",
          inLanguage: "zh-CN",
          hasDefinedTerm: TERMS.map((t) => ({
            "@type": "DefinedTerm",
            name: t.term,
            description: t.def,
            url: `https://name.duimai.net/baike#${t.id}`,
          })),
        }),
      }}
    />
  );
}

function BaikePage() {
  return (
    <AppShell>
      <BreadcrumbJsonLd name="起名名词解释" path="/baike" />
      <TermJsonLd />
      <PageHeader
        eyebrow="起名百科"
        title="起名名词解释"
        desc="起名页与生成结果里出现的术语，一页看懂。每条先给一句定义，再补口径说明；均为传统姓名文化口径的整理，仅供文化参考。"
      />
      <section className="mt-7 grid gap-3 md:grid-cols-2">
        {TERMS.map((t) => (
          <article
            key={t.id}
            id={t.id}
            className="scroll-mt-24 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
          >
            <h2 className="text-base font-semibold text-ink">{t.term}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{t.def}</p>
            {t.detail ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">{t.detail}</p>
            ) : null}
            {t.link ? (
              <Link
                to={t.link.to}
                className="mt-3 inline-block text-xs font-medium text-vermilion-deep underline underline-offset-2"
              >
                {t.link.text} →
              </Link>
            ) : null}
          </article>
        ))}
      </section>
      <section className="mt-8 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <h2 className="text-lg font-semibold">还有疑问？</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          完整的使用说明与常见问题见{" "}
          <Link to="/help" className="text-vermilion-deep underline underline-offset-2">
            帮助中心
          </Link>
          ；起名的完整流程（真太阳时排盘 → 喜用神 → 字库筛选 → AI 推演 → 荐名核验）在{" "}
          <Link
            to="/naming"
            search={{
              prefer: undefined,
              x: undefined,
              src: undefined,
              g: undefined,
              cat: undefined,
              book: undefined,
            }}
            className="text-vermilion-deep underline underline-offset-2"
          >
            宝宝起名
          </Link>{" "}
          页逐步展示。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          本页内容基于传统文化整理，仅供文化参考与娱乐，不构成任何预测或决策依据。
        </p>
      </section>
    </AppShell>
  );
}
