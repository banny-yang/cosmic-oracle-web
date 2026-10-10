import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  ARTICLE_CATEGORIES,
  articleCategoryLabel,
  articlePath,
  fetchArticles,
  type ArticleSummary,
} from "@/lib/articles";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 文章栏目首页：SSR 直出文章列表（分页 + 分类筛选）。列表项含摘要与发布时间，
 * 搜索引擎/AI 引擎不执行 JS 也能读到栏目结构；接口故障渲染兜底提示页 + noindex。
 */
export const Route = createFileRoute("/articles/")({
  component: ArticleListPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { page?: string | undefined; cat?: string | undefined } => ({
    page: typeof search["page"] === "string" ? search["page"].slice(0, 4) : undefined,
    cat: typeof search["cat"] === "string" ? search["cat"].slice(0, 20) : undefined,
  }),
  loaderDeps: ({ search }) => ({
    page: Math.max(0, Number.parseInt(search.page ?? "0", 10) || 0),
    cat: search.cat ?? "",
  }),
  loader: async ({ deps }) => {
    const result = await fetchArticles({ category: deps.cat, page: deps.page, size: 12 });
    return { result, page: deps.page, cat: deps.cat };
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page ?? 0;
    const cat = loaderData?.cat ?? "";
    const catLabel = cat ? articleCategoryLabel(cat) : "";
    const title = catLabel
      ? `${catLabel} · 深度洞察 · 对脉名鉴`
      : "深度洞察：生肖、字辈、诗词与用字知识 · 对脉名鉴";
    // 第 1 页 canonical 指栏目根；后续页自指（分页内容互不重复收录）
    const canonical = `https://name.duimai.net/articles${page > 0 ? `?page=${page}` : ""}`;
    const desc = catLabel
      ? `${catLabel}相关的深度洞察：从传统宜忌到现代审读，帮你把名字取得有出处、有呼应。`
      : "管理员精选的取名知识文章：生肖宜忌、字辈传承、诗词典籍出处、五行用字与双胞胎成对思路，每篇附可用的起名入口。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: "深度洞察,宝宝取名知识,生肖取名,字辈取名,诗词取名" },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
        ...(loaderData?.result ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
});

const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function ArticleListPage() {
  const { result, page, cat } = Route.useLoaderData() as {
    result: Awaited<ReturnType<typeof fetchArticles>>;
    page: number;
    cat: string;
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="深度洞察" path="/articles" />
      {result && result.items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "对脉名鉴 · 深度洞察",
              numberOfItems: result.items.length,
              itemListElement: result.items.map((a, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: a.title,
                url: `https://name.duimai.net${articlePath(a.slug)}`,
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <PageHeader
        eyebrow="取名知识 · 深度洞察"
        title="深度洞察"
        desc="生肖宜忌、字辈传承、诗词典籍出处、五行用字与双胞胎成对思路——把名字取得有出处、有呼应。"
      />

      {/* 分类筛选：链接而非按钮，站内结构可被抓取 */}
      <nav className="mt-7 flex flex-wrap gap-2" aria-label="文章分类">
        <Link
          to="/articles"
          search={{ page: undefined, cat: undefined }}
          className={!cat ? ghostCls + " bg-ink text-paper hover:bg-ink" : ghostCls}
        >
          全部
        </Link>
        {ARTICLE_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            to="/articles"
            search={{ cat: c.key, page: undefined }}
            className={cat === c.key ? ghostCls + " bg-ink text-paper hover:bg-ink" : ghostCls}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {!result ? (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center">
          <p className="text-sm text-ink-soft">文章列表暂时加载不出来，稍后刷新试试。</p>
        </div>
      ) : result.items.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center">
          <p className="text-sm text-ink-soft">
            这个分类下暂时还没有文章，可以先看看
            <Link to="/zodiac" className="mx-1 text-vermilion-deep underline underline-offset-2">
              生肖取名
            </Link>
            或直接
            <Link
              to="/naming"
              search={namingCtaSearch()}
              className="mx-1 text-vermilion-deep underline underline-offset-2"
            >
              开始起名
            </Link>
            。
          </p>
        </div>
      ) : (
        <ul className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((a: ArticleSummary) => (
            <li key={a.slug}>
              <Link
                to="/articles/$slug"
                params={{ slug: a.slug }}
                className="flex h-full flex-col rounded-2xl bg-white p-6 transition-colors hover:bg-vermilion-wash"
              >
                <p className="text-[11px] font-medium text-vermilion-deep">
                  {articleCategoryLabel(a.category)} · {formatDate(a.publishedAt)}
                </p>
                <h2 className="mt-2 text-base font-semibold leading-snug text-ink">{a.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                  {a.summary}
                </p>
                <p className="mt-auto pt-3 text-xs text-ink-faint">
                  {a.authorName} · 阅读全文 →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 分页：链接化，page 1 canonical 收敛 */}
      {result && result.total > result.size ? (
        <nav className="mt-9 flex items-center justify-between" aria-label="分页">
          {page > 0 ? (
            <Link
              to="/articles"
              search={{
                cat: cat || undefined,
                page: page - 1 > 0 ? String(page - 1) : undefined,
              }}
              className={ghostCls}
            >
              ← 上一页
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-faint">
            第 {page + 1} 页 · 共 {Math.max(1, Math.ceil(result.total / result.size))} 页 ·{" "}
            {result.total} 篇
          </p>
          {(page + 1) * result.size < result.total ? (
            <Link
              to="/articles"
              search={{ cat: cat || undefined, page: String(page + 1) }}
              className={ghostCls}
            >
              下一页 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <section className="mt-11 rounded-2xl bg-white p-6">
        <p className="text-sm leading-relaxed text-ink-soft text-pretty">
          文章讲思路，起名靠工具：读完不妨带着宜忌与出处要求，
          <Link
            to="/naming"
            search={namingCtaSearch()}
            className="mx-1 font-medium text-vermilion-deep underline underline-offset-2"
          >
            到起名页生成一批
          </Link>
          ——引擎会把生肖宜忌、五行搭配与典籍出处一起算进名字评分。
        </p>
      </section>
    </AppShell>
  );
}
