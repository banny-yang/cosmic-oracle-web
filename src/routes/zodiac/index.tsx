import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  ZodiacAnimalGrid,
  ZodiacCharChips,
  ZodiacNameGrid,
  ZodiacNamingCta,
  ZodiacNotice,
  ZodiacRadicalChips,
  ZodiacTips,
  ZodiacYearHeadline,
} from "@/components/zodiac-blocks";
import {
  animalPath,
  animalYearPath,
  fetchZodiacOverview,
  type ZodiacGuideView,
  type ZodiacOverview,
} from "@/lib/zodiac-guide";

export const Route = createFileRoute("/zodiac/")({
  component: ZodiacHub,
  // 当年 / 次年 / 十二生肖宫格随 SSR HTML 直出（AI 与搜索引擎不执行 JS 也能读到）
  loader: async () => ({ overview: await fetchZodiacOverview() }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/zodiac" }],
    meta: [
      { title: "生肖取名 · 十二生肖逐年用字宜忌 · 对脉名鉴" },
      {
        name: "keywords",
        content:
          "生肖取名,马年宝宝取名,属马取名,属羊取名,生肖宜用部首,生肖忌用部首,立春,十二生肖,宝宝取名用字",
      },
      {
        name: "description",
        content:
          "生肖取名：十二生肖各有传统用字宜忌，且随年份流转（生肖年以立春为界）。按当年与次年现算干支、立春起止与宜用/忌用部首，并给出命中部首的名字与出处，供参考。",
      },
      { property: "og:url", content: "https://name.duimai.net/zodiac" },
      { property: "og:title", content: "生肖取名 · 十二生肖逐年用字宜忌" },
      {
        property: "og:description",
        content: "按年份现算生肖年干支与立春起止，逐生肖给出传统宜用/忌用部首与可用名字。",
      },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  }),
});

const sectionTitle = "text-lg font-semibold";
const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

function ZodiacHub() {
  const { overview } = Route.useLoaderData() as { overview: ZodiacOverview | null };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="生肖取名" path="/zodiac" />
      {overview ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "十二生肖取名",
              numberOfItems: overview.animals.length,
              itemListElement: overview.animals.map((a, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `属${a.animal}宝宝取名`,
                url: "https://name.duimai.net" + animalPath(a.slug),
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <PageHeader
        eyebrow="生肖取名 · 逐年流转"
        title="生肖取名"
        desc={
          overview
            ? `十二生肖各有一套传统用字宜忌，且随年份流转：生肖年以立春为界，${overview.current.info.ganzhi}${overview.current.info.animal}年为当前生肖年，${overview.next.info.ganzhi}${overview.next.info.animal}年已提前备好。这里的干支、立春起止与宜忌部首都由引擎按年份现算。`
            : "十二生肖各有一套传统用字宜忌，且随年份流转：生肖年以立春为界。这里的干支、立春起止与宜忌部首都由引擎按年份现算。"
        }
      />

      {overview === null ? (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            生肖资料暂时未加载出来，稍后刷新；也可以先看名字灵感库或直接起名。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/names" search={{ keyword: undefined }} className={ghostCls}>
              名字灵感库 →
            </Link>
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
              className={ghostCls}
            >
              去宝宝起名 →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-9">
            <h2 className={sectionTitle}>十二生肖 · 看各生肖的用字宜忌</h2>
            <p className="mt-1.5 text-xs text-ink-faint">
              点生肖进常青页（不随年份失效）；圆点标出该生肖最近一轮的起算年。
            </p>
            <ZodiacAnimalGrid animals={overview.animals} />
          </section>

          {/* 当年：完整板块（宜忌 + 宜用字 + 名字） */}
          <section className="mt-11">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className={sectionTitle}>
                {overview.currentYear} · {overview.current.info.ganzhi}
                {overview.current.info.animal}年（当前生肖年）
              </h2>
              <Link
                to="/zodiac/$animal"
                params={{ animal: overview.current.info.slug }}
                className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
              >
                属{overview.current.info.animal}取名常青页 →
              </Link>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-6">
              <ZodiacYearHeadline info={overview.current.info} current />
              <ZodiacRadicalChips info={overview.current.info} />
              <ZodiacTips tips={overview.current.copy.tips} />
              <ZodiacCharChips chars={overview.current.preferredChars} />
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/zodiac/$animal/$year"
                  params={{
                    animal: overview.current.info.slug,
                    year: String(overview.current.info.year),
                  }}
                  className={ghostCls}
                >
                  {overview.current.info.year} 年页 · 干支与名字 →
                </Link>
              </div>
            </div>
            <h3 className="mt-7 text-sm font-semibold">
              属{overview.current.info.animal}宝宝名字（{overview.current.names.length}）
            </h3>
            <p className="mt-1.5 text-xs text-ink-faint">
              用字均命中{overview.current.info.animal}
              年宜用部首且未用忌用部首，按命中数与人工评分排序。
            </p>
            <ZodiacNameGrid
              names={overview.current.names}
              empty="这个名字列表暂时为空，可先到名字灵感库按生肖筛。"
            />
            <ZodiacNamingCta
              label={`按${overview.current.info.animal}年宜用部首起名 →`}
              from={`hub_current_${overview.current.info.slug}`}
            />
          </section>

          {/* 次年：提前铺好的摘要块（立春一到自动成为当年） */}
          <section className="mt-11">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className={sectionTitle}>
                {overview.nextYear} · {overview.next.info.ganzhi}
                {overview.next.info.animal}年（次年 · 已提前备好）
              </h2>
              <Link
                to="/zodiac/$animal"
                params={{ animal: overview.next.info.slug }}
                className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
              >
                属{overview.next.info.animal}取名常青页 →
              </Link>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-6">
              <ZodiacYearHeadline info={overview.next.info} />
              <ZodiacRadicalChips info={overview.next.info} />
              <ZodiacTips tips={overview.next.copy.tips} />
              <ZodiacCharChips chars={overview.next.preferredChars} />
              <p className="mt-4 text-xs text-ink-faint">
                次年按立春交节时刻自动接替当年（
                {overview.next.info.termStartAt} 交节），无需人工改动页面。
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/zodiac/$animal/$year"
                  params={{
                    animal: overview.next.info.slug,
                    year: String(overview.next.info.year),
                  }}
                  className={ghostCls}
                >
                  看 {overview.next.info.year} {overview.next.info.ganzhi}
                  {overview.next.info.animal}年页 →
                </Link>
                <Link
                  to="/zodiac/$animal/$year"
                  params={{
                    animal: overview.next.info.slug,
                    year: String(overview.next.nextRound),
                  }}
                  className={ghostCls}
                >
                  下一轮 {overview.next.nextRound} 年 →
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-9">
            <h2 className={sectionTitle}>这份宜忌怎么用</h2>
            <ZodiacNotice />
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-soft text-pretty">
              生肖用字宜忌只是选字的一个维度：起名引擎会把它与生辰喜用、五格数理、字音字义一起打分（生肖契合占其中一项），
              命中喜用部首的名字会在结果页标出。想直接用起来，就从上面的名字或生肖页进起名。
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}
