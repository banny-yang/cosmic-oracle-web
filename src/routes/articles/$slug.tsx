import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  articleCategoryLabel,
  articlePath,
  fetchArticles,
  lookupArticle,
  type ArticleDetail,
  type ArticleSummary,
} from "@/lib/articles";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 文章详情页：正文 HTML 由服务端渲染（白名单标签）并随 SSR 直出——搜索引擎与
 * AI 引擎不执行 JS 也能读到全文。未发布/下线 → 404；接口故障 → 兜底页 + noindex。
 */
export const Route = createFileRoute("/articles/$slug")({
  component: ArticleDetailPage,
  loader: async ({ params }) => {
    const lookup = await lookupArticle(params.slug);
    if (lookup.invalid) throw notFound();
    let related: ArticleSummary[] = [];
    if (lookup.article) {
      const list = await fetchArticles({ category: lookup.article.category, page: 0, size: 4 });
      related = (list?.items ?? []).filter((a) => a.slug !== params.slug).slice(0, 3);
    }
    return { article: lookup.article, related };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article ?? null;
    const title = a ? a.seoTitle || `${a.title} · 对脉名鉴` : "文章 · 对脉名鉴";
    const desc =
      a && (a.seoDescription || a.summary)
        ? (a.seoDescription || a.summary).slice(0, 300)
        : "取名知识与思路：生肖宜忌、字辈传承、诗词典籍出处与用字讲究。";
    const canonical = a
      ? `https://name.duimai.net${articlePath(a.slug)}`
      : "https://name.duimai.net/articles";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: a ? `${a.title},深度洞察,宝宝取名` : "深度洞察" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
        ...(a
          ? [
              { property: "article:published_time", content: a.publishedAt ?? "" },
              { property: "article:modified_time", content: a.updatedAt ?? "" },
            ]
          : []),
        // 未就绪兜底内容不进索引
        ...(a ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
});

const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

function ArticleDetailPage() {
  const { article, related } = Route.useLoaderData() as {
    article: ArticleDetail | null;
    related: ArticleSummary[];
  };

  if (!article) {
    return (
      <AppShell>
        <PageHeader eyebrow="取名知识 · 文章" title="文章" />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center">
          <p className="text-sm text-ink-soft">这篇文章暂时加载不出来，稍后刷新试试。</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/articles" search={{ cat: undefined, page: undefined }} className={ghostCls}>
              返回文章列表 →
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BreadcrumbJsonLd name={article.title} path={articlePath(article.slug)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: (article.seoDescription || article.summary).slice(0, 300),
            author: { "@type": "Organization", name: article.authorName },
            publisher: { "@type": "Organization", name: "对脉名鉴" },
            datePublished: article.publishedAt ?? undefined,
            dateModified: article.updatedAt ?? undefined,
            mainEntityOfPage: `https://name.duimai.net${articlePath(article.slug)}`,
            image: "https://name.duimai.net/og-card.jpg",
          }).replace(/</g, "\\u003c"),
        }}
      />

      <PageHeader
        eyebrow={`取名知识 · ${articleCategoryLabel(article.category)}`}
        title={article.title}
        desc={article.summary}
      />
      <p className="mt-3 text-xs text-ink-faint">
        {article.authorName} · 发布于 {(article.publishedAt ?? "").slice(0, 10)}
        {(article.updatedAt ?? "").slice(0, 10) !== (article.publishedAt ?? "").slice(0, 10)
          ? ` · 更新于 ${(article.updatedAt ?? "").slice(0, 10)}`
          : ""}
      </p>

      {/* 正文：服务端白名单渲染的 HTML（标题/段落/列表/引用/链接），SSR 直出 */}
      <article
        className="article-prose mt-7 rounded-2xl bg-white p-7 md:p-9"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />

      <section className="mt-8 rounded-2xl bg-vermilion-wash p-6">
        <p className="text-sm leading-relaxed text-ink-soft text-pretty">
          读完了？把文章里的宜忌与出处要求带进起名引擎——
          <Link
            to="/naming"
            search={namingCtaSearch()}
            className="mx-1 font-medium text-vermilion-deep underline underline-offset-2"
          >
            到起名页生成一批名字
          </Link>
          ，或在
          <Link
            to="/names"
            search={{ keyword: undefined, zodiac: undefined }}
            className="mx-1 font-medium text-vermilion-deep underline underline-offset-2"
          >
            名字灵感库
          </Link>
          里按生肖与出处筛选。
        </p>
      </section>

      {related.length > 0 ? (
        <section className="mt-11">
          <h2 className="text-lg font-semibold">相关文章</h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  to="/articles/$slug"
                  params={{ slug: r.slug }}
                  className="flex h-full flex-col rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
                >
                  <p className="text-[11px] font-medium text-vermilion-deep">
                    {articleCategoryLabel(r.category)}
                  </p>
                  <h3 className="mt-1.5 text-sm font-semibold leading-snug">{r.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {r.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-9">
        <Link to="/articles" search={{ cat: undefined, page: undefined }} className={ghostCls}>
          ← 返回文章列表
        </Link>
      </section>
    </AppShell>
  );
}
