import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { LinkChips, ghostCls, sectionTitle } from "@/components/seo/longtail-blocks";
import { fetchClassicBookTree, type ClassicBookTree } from "@/lib/classic-books";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import { CLASSIC_CATEGORIES } from "@/lib/seo/longtail";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 典籍取名入口页：/classic。按类目列出全部取名典籍来源（诗经/楚辞/唐诗/…），
 * 是 18 个 /classic/{code} 类目页的唯一站内入口（sitemap 同时收录）。
 * 放量由 longtail.classic.stage 控制（0=整矩阵 noindex，含本页）。
 */
export const Route = createFileRoute("/classic/")({
  component: ClassicHubPage,
  loader: async () => {
    const [tree, stages] = await Promise.all([fetchClassicBookTree(), getLongtailStages()]);
    return { tree, stages };
  },
  head: ({ loaderData }) => {
    const stages = loaderData?.stages;
    const canonical = "https://name.duimai.net/classic";
    const title = "诗词典籍取名：从诗经到蒙学的名字来源 · 对脉名鉴";
    const desc =
      "按典籍查取名来源：诗经、楚辞、唐诗、宋词、论语、周易等经典的书目、句量与名字参考，从原文选字，含义有出处。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        ...(!stages || stages.classic !== 1
          ? [{ name: "robots", content: "noindex, follow" }]
          : []),
        { name: "keywords", content: "诗经取名,楚辞取名,唐诗取名,宋词取名,论语取名,典籍取名" },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

function categorySentences(tree: ClassicBookTree | null, code: string): number | null {
  for (const g of tree?.groups ?? []) {
    for (const c of g.categories) {
      if (c.code === code) {
        return c.books.reduce((sum, b) => sum + (b.sentenceCount || 0), 0);
      }
    }
  }
  return null;
}

function ClassicHubPage() {
  const { tree } = Route.useLoaderData() as { tree: ClassicBookTree | null; stages: unknown };
  const canonical = "https://name.duimai.net/classic";

  return (
    <AppShell>
      <BreadcrumbJsonLd name="诗词典籍取名" path="/classic" />
      <PageHeader
        eyebrow="典籍取名"
        title="诗词典籍取名"
        desc="从典籍原文里选字：每个类目给出书目、句量与按原文出处的名字参考。取名用典不是堆砌生僻字，而是让名字的含义可查、可讲。"
      />

      <PageBrief
        summary={`本站语料覆盖 ${tree?.totalBooks ?? CLASSIC_CATEGORIES.length} 部典籍、约 ${(tree?.totalSentences ?? 0).toLocaleString()} 句原文；每个类目页给出该类典籍的取名用字来源与真实名字参考。`}
        points={[
          "女诗经、男楚辞是传统口径：诗经用字清雅，楚辞意象开阔。",
          "唐诗宋词适合取音律响亮的名字，周易论语适合端方大气的名字。",
          "本页所有名字均标注原文出处，评分只作字库内部参考。",
        ]}
        links={[
          { label: "典籍馆（书目详情）", to: "/dianji" },
          { label: "名字灵感库", to: "/names" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={canonical}
      />

      <section className="mt-11">
        <h2 className={sectionTitle}>按典籍类目查取名</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CLASSIC_CATEGORIES.map((cat) => {
            const sentences = categorySentences(tree, cat.code);
            return (
              <Link
                key={cat.code}
                to="/classic/$code"
                params={{ code: cat.code }}
                className="rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
              >
                <p className="text-base font-semibold text-ink">{cat.label}取名</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{cat.note}</p>
                <p className="mt-2 text-[11px] text-ink-faint">
                  {typeof sentences === "number"
                    ? `${sentences.toLocaleString()} 句原文可选字`
                    : "语料句量以典籍馆为准"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>继续浏览</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/dianji" className={ghostCls}>
            典籍馆 →
          </Link>
          <Link to="/names" className={ghostCls}>
            名字灵感库 →
          </Link>
          <Link to="/naming" search={namingCtaSearch("classic_hub")} className={ghostCls}>
            开始取名 →
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">
          典籍取名属姓名文化参考，不作吉凶判断；名字的音律、书写与生辰搭配以起名页现算为准。
        </p>
      </section>
    </AppShell>
  );
}
