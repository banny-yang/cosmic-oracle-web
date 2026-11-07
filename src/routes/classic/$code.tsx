import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import {
  LinkChips,
  LongtailNameCards,
  ghostCls,
  sectionTitle,
} from "@/components/seo/longtail-blocks";
import { ZodiacFaqList } from "@/components/zodiac-blocks";
import {
  GENERIC_BRIEF_POINTS,
  GENERIC_BRIEF_SUMMARY,
  GENERIC_INTRO,
  GENERIC_NOTICE,
  GENERIC_TIPS,
} from "@/content/qiming/generic";
import { fetchClassicBookTree, type ClassicBookNode } from "@/lib/classic-books";
import { fetchGalleryNames, type GalleryName } from "@/lib/seo/data";
import { CLASSIC_CATEGORIES, classicByCode } from "@/lib/seo/longtail";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import type { LongtailStages } from "@/lib/seo/rollout";
import { track } from "@/lib/track";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 典籍类目取名页：/classic/{code}（18 个类目，code 与后端 classic-books 同口径）。
 *
 * 名字按类目下的书目从灵感库取（source=书名，后端 LIKE 匹配），多书类目并行取后
 * 按评分合并去重——每个类目页的名字与出处都不同，不是同一批名字换标题。
 * 放量由 longtail.classic.stage 控制（0=整矩阵 noindex）。
 */
export const Route = createFileRoute("/classic/$code")({
  component: ClassicCategoryPage,
  loader: async ({ params }) => {
    const cat = classicByCode(params.code);
    if (!cat) throw notFound();
    const tree = await fetchClassicBookTree();
    let books: ClassicBookNode[] = [];
    for (const g of tree?.groups ?? []) {
      for (const c of g.categories) {
        if (c.code === cat.code) {
          books = c.books.filter((b) => b.selectable || b.promoted);
        }
      }
    }
    // 取名字：书目直取（多书并行，各取前 6 再合并）；书目树不可用时按类目通称兜底
    // （对诗经/楚辞/唐诗等单书类目有效；多书类目退化为空列表，区块隐藏）
    const sources = books.length > 0 ? books.map((b) => b.book).slice(0, 6) : [cat.label];
    const [stages, boyLists, girlLists] = await Promise.all([
      getLongtailStages(),
      Promise.all(sources.map((s) => fetchGalleryNames({ gender: "M", source: s, size: 6 }))),
      Promise.all(sources.map((s) => fetchGalleryNames({ gender: "F", source: s, size: 6 }))),
    ]);
    return { cat, books, boys: mergeNames(boyLists), girls: mergeNames(girlLists), stages };
  },
  head: ({ loaderData }) => {
    const cat = loaderData?.cat;
    const stages = loaderData?.stages as LongtailStages | undefined;
    const canonical = `https://name.duimai.net/classic/${cat?.code ?? ""}`;
    const title = cat ? `${cat.label}取名：出处与名字参考 · 对脉名鉴` : "典籍取名 · 对脉名鉴";
    const desc = cat
      ? `${cat.label}取名怎么选字？${cat.note}。本页给出${cat.label}原文出处的男宝女宝名字参考，附原句与意蕴。`
      : "按典籍类目查取名来源。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        // 类目未收录或矩阵关闭或书目树不可用（内容退化）→ 不进索引
        ...(!cat || !stages || stages.classic !== 1 || !loaderData?.books
          ? [{ name: "robots", content: "noindex, follow" }]
          : []),
        {
          name: "keywords",
          content: cat
            ? `${cat.label}取名,${cat.label}起名,${cat.label}名字,典籍取名,诗词取名`
            : "典籍取名,诗词取名",
        },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

/** 多书合并：按字去重（保留高分），评分降序、无评分沉底，各取前 8。 */
function mergeNames(lists: GalleryName[][]): GalleryName[] {
  const byWord = new Map<string, GalleryName>();
  for (const list of lists) {
    for (const n of list) {
      const existing = byWord.get(n.word);
      if (!existing || (n.score ?? -1) > (existing.score ?? -1)) byWord.set(n.word, n);
    }
  }
  return [...byWord.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 8);
}

const cardCls = "rounded-2xl bg-white p-6";

function ClassicCategoryPage() {
  const { cat, books, boys, girls } = Route.useLoaderData() as {
    cat: { code: string; label: string; note: string };
    books: ClassicBookNode[];
    boys: GalleryName[];
    girls: GalleryName[];
    stages: LongtailStages;
  };
  const canonical = `https://name.duimai.net/classic/${cat.code}`;
  const names = [...boys, ...girls];
  const totalSentences = books.reduce((sum, b) => sum + (b.sentenceCount || 0), 0);
  const siblings = CLASSIC_CATEGORIES.filter((c) => c.code !== cat.code).slice(0, 10);

  const faq = [
    {
      q: `${cat.label}取名有什么讲究？`,
      a: `${cat.label}取名的核心是「字出有据」：从原文里挑含义清楚、读音顺口的字，再与姓氏连读确认没有不想要的谐音。${
        books.length
          ? `本页从《${books.map((b) => b.book).join("》《")}》等典籍选取名字，每条都附原句。`
          : ""
      }`,
    },
    {
      q: `哪些人适合用${cat.label}取名？`,
      a: `${cat.note}。如果希望名字有明确的出处可以讲给孩子听，${cat.label}是合适的来源；最终仍建议以读音、字义、书写与姓氏连读综合取舍。`,
    },
    ...(GENERIC_TIPS.length > 0
      ? [
          {
            q: "典籍取名的名字会不会太生僻？",
            a: "不会刻意追求生僻：本页候选名字以常用规范汉字为主，出处只提供含义依据；确认登记口径时以《通用规范汉字表》为准。",
          },
        ]
      : []),
  ];

  return (
    <AppShell>
      <BreadcrumbJsonLd name={`${cat.label}取名`} path={`/classic/${cat.code}`} />
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${cat.label}取名名字推荐`,
              numberOfItems: names.length,
              itemListElement: names.map((n, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: n.word,
                description: [n.pinyin, n.source].filter(Boolean).join(" · "),
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />

      <PageHeader
        eyebrow="典籍取名"
        title={`${cat.label}取名`}
        desc={`${cat.note}。${GENERIC_INTRO}`}
      />

      <PageBrief
        summary={
          books.length
            ? `${cat.label}取名从《${books.map((b) => b.book).join("》《")}》中选字，共 ${totalSentences.toLocaleString()} 句原文可查；本页给出 ${names.length} 个带出处的名字参考。`
            : `${cat.label}取名的语料句量以典籍馆为准；本页的取名方法与选字要点不受影响。`
        }
        points={GENERIC_BRIEF_POINTS}
        links={[
          { label: "典籍馆（书目详情）", to: "/dianji" },
          { label: "名字灵感库", to: "/names" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={canonical}
      />

      {books.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>{cat.label}的书目与句量</h2>
          <div className={`mt-3 ${cardCls}`}>
            <ul className="space-y-2.5">
              {books.map((b) => (
                <li key={b.book} className="text-sm leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">《{b.book}》</span>
                  <span className="ml-1 text-xs text-ink-faint">
                    {(b.sentenceCount || 0).toLocaleString()} 句 · {b.entryCount || 0} 个取名字例
                  </span>
                  {b.intro ? <span className="mt-1 block text-pretty">{b.intro}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="mt-11">
        <h2 className={sectionTitle}>取名要点</h2>
        <div className={`mt-3 ${cardCls}`}>
          <ul className="space-y-2.5">
            {GENERIC_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-vermilion" />
                <span className="text-pretty">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {names.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>{cat.label}里的名字参考</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            均标注原文出处与意蕴；评分只作字库内部参考，与姓氏的完整搭配以起名页现算为准。
          </p>
          {boys.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink">男宝名字参考</h3>
              <LongtailNameCards names={boys} />
            </>
          ) : null}
          {girls.length > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-semibold text-ink">女宝名字参考</h3>
              <LongtailNameCards names={girls} />
            </>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/naming"
          search={namingCtaSearch("classic_page")}
          onClick={() => track("classic_page_cta", { code: cat.code })}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          按{cat.label}选字取名 →
        </Link>
        <Link to="/dianji" className={ghostCls}>
          典籍馆 →
        </Link>
      </div>

      <section className="mt-11">
        <h2 className={sectionTitle}>其它典籍类目</h2>
        <LinkChips
          links={siblings.map((c) => ({
            label: `${c.label}取名`,
            to: `/classic/${c.code}`,
          }))}
        />
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <ZodiacFaqList items={faq} />
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">{GENERIC_NOTICE}</p>
      </section>
    </AppShell>
  );
}
