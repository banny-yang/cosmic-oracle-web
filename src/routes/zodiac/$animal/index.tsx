import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  ZodiacCharChips,
  ZodiacFaqList,
  ZodiacNameGrid,
  ZodiacNamingCta,
  ZodiacNotice,
  ZodiacRadicalChips,
  ZodiacTips,
  ZodiacYearHeadline,
  ZodiacYearNav,
} from "@/components/zodiac-blocks";
import { animalPath, fetchZodiacGuide, type ZodiacGuideView } from "@/lib/zodiac-guide";

/** 生肖常青页：/zodiac/{slug}（slug 为服务端下发的拼音，如 ma）。 */
export const Route = createFileRoute("/zodiac/$animal/")({
  component: ZodiacAnimalPage,
  loader: async ({ params }) => ({
    view: await fetchZodiacGuide({ animal: params.animal, limit: 18 }),
    slug: params.animal,
  }),
  // 标题/描述/FAQ 取自 t_zodiac_guide（运营可在后台改文案，改完刷新即生效）
  head: ({ loaderData }) => {
    const view = loaderData?.view ?? null;
    const info = view?.info ?? null;
    const slug = loaderData?.slug ?? "";
    const canonical = `https://name.duimai.net${animalPath(info?.slug ?? slug)}`;
    const title =
      view?.copy.seoTitle ||
      (info ? `属${info.animal}宝宝取名用字宜忌 · 对脉名鉴` : "生肖取名 · 对脉名鉴");
    const desc =
      view?.copy.seoDesc ||
      (info
        ? `属${info.animal}宝宝取名怎么选字：传统取名习俗认为宜用 ${info.preferredRadicals.join("、")} 等部首，忌用 ${info.forbiddenRadicals.join("、")} 等部首。附宜用字举例与可用名字，供参考。`
        : "十二生肖宝宝的取名用字宜忌与名字推荐。");
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        // 生肖未识别或接口未就绪时页面为兜底内容，不进索引
        ...(view ? [] : [{ name: "robots", content: "noindex" }]),
        {
          name: "keywords",
          content: info
            ? `属${info.animal}取名,${info.animal}年宝宝取名,属${info.animal}宜用部首,生肖取名,宝宝取名用字`
            : "生肖取名,宝宝取名用字",
        },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

const sectionTitle = "text-lg font-semibold";
const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

function ZodiacAnimalPage() {
  const { view, slug } = Route.useLoaderData() as {
    view: ZodiacGuideView | null;
    slug: string;
  };

  if (!view) {
    return (
      <AppShell>
        <PageHeader eyebrow="生肖取名" title="生肖取名" />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            没找到「{slug}」这个生肖的取名资料：可能是链接有误，也可能数据暂时未加载出来。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/zodiac" className={ghostCls}>
              看全部十二生肖 →
            </Link>
            <Link to="/names" search={{ keyword: undefined }} className={ghostCls}>
              名字灵感库 →
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { info, copy, names, preferredChars, years, nextRound, current } = view;
  const latestRound = years[0] ?? null;
  const oldestRound = years.length > 1 ? (years[years.length - 1] ?? null) : null;

  return (
    <AppShell>
      <BreadcrumbJsonLd name={`属${info.animal}取名`} path={animalPath(info.slug)} />
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `属${info.animal}宝宝名字推荐`,
              numberOfItems: names.length,
              itemListElement: names.map((n, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: n.word,
                description: [n.pinyin, n.meaning].filter(Boolean).join(" · "),
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      {copy.faq.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: copy.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <PageHeader
        eyebrow={`生肖取名 · ${info.branchCn}${info.animal}`}
        title={copy.title || `属${info.animal}宝宝取名`}
        desc={copy.intro || info.note}
      />

      <div className="mt-7 rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            {current ? "当前生肖年" : "最近一轮生肖年"} · 宜用与忌用部首
          </p>
          <Link
            to="/zodiac"
            className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
          >
            ← 全部十二生肖
          </Link>
        </div>
        <div className="mt-3">
          <ZodiacYearHeadline info={info} current={current} />
          <ZodiacRadicalChips info={info} />
          <ZodiacTips tips={copy.tips} />
          <ZodiacCharChips chars={preferredChars} />
        </div>
      </div>

      <ZodiacNamingCta label={`按属${info.animal}的宜用部首起名 →`} from={`animal_${info.slug}`} />

      <section className="mt-11">
        <h2 className={sectionTitle}>属{info.animal}宝宝名字推荐</h2>
        <p className="mt-1.5 text-xs text-ink-faint">
          用字均命中 {info.preferredRadicals.join("／")}{" "}
          等宜用部首、且未用忌用部首；按命中数与人工评分排序，逐个标出处与意蕴。
          <Link
            to="/names"
            search={{ zodiac: info.slug }}
            className="ml-1.5 text-vermilion-deep transition-colors hover:text-vermilion"
          >
            去灵感库筛属{info.animal}的宜用字 →
          </Link>
        </p>
        <ZodiacNameGrid
          names={names}
          empty="这个名字列表暂时为空：可先到名字灵感库按生肖筛，或直接起名。"
        />
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>同一生肖的年份（每 12 年一轮）</h2>
        <p className="mt-1.5 text-xs text-ink-faint">
          生肖年以立春为界，每年立春自动流转；点年份看那一年的干支、立春起止与可用名字。
        </p>
        <ZodiacYearNav rounds={years} slug={info.slug} nextRound={nextRound} />
        {oldestRound && latestRound ? (
          <p className="mt-3 text-xs text-ink-faint">
            每 12 年一轮、干支各不相同：{oldestRound.year} 年为{oldestRound.ganzhi}
            {info.animal}年，{latestRound.year} 年为{latestRound.ganzhi}
            {info.animal}年。
          </p>
        ) : null}
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <ZodiacFaqList items={copy.faq} />
        <ZodiacNotice />
        <p className="mt-3 text-xs text-ink-faint">
          想按年份看（任意年份的干支与名字）：
          <Link
            to="/zodiac/$animal/$year"
            params={{ animal: info.slug, year: String(info.year) }}
            className="text-vermilion-deep transition-colors hover:text-vermilion"
          >
            进入 {info.year} 年页 →
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
