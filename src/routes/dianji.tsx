import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  fetchClassicBookTree,
  promotedCategories,
  type ClassicBookTree,
} from "@/lib/classic-books";

export const Route = createFileRoute("/dianji")({
  component: ClassicLibrary,
  // 首屏书目随 SSR HTML 直出（AI/搜索引擎不执行 JS 也能读到全部书名与名句）
  loader: async () => ({ tree: await fetchClassicBookTree() }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/dianji" }],
    meta: [
      { title: "典籍馆 · 起名用的国学典籍书目 · 对脉名鉴" },
      {
        name: "keywords",
        content:
          "诗经取名,楚辞取名,唐诗取名,宋词取名,三字经取名,千字文取名,论语取名,周易取名,典籍取名,国学典籍",
      },
      { property: "og:url", content: "https://name.duimai.net/dianji" },
      { property: "og:title", content: "典籍馆 · 起名用的国学典籍书目" },
      {
        name: "description",
        content:
          "对脉名鉴典籍馆：起名引擎收录的国学典籍书目，逐部列出简介、原文句数与代表名句（诗经、楚辞、唐诗宋词、蒙学等），可指定其中一部为宝宝取名。",
      },
      {
        property: "og:description",
        content: "诗经、楚辞、唐诗宋词、蒙学等国学典籍书目与代表名句，可按书取名、出处全书一致。",
      },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  }),
});

const cardCls = "rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash";

/** 起名页 search 参数（路由类型要求各键显式出现）：只带书名，按书目取典。 */
const namingSearchFor = (book?: string) => ({
  prefer: undefined,
  x: undefined,
  src: undefined,
  g: undefined,
  cat: undefined,
  book,
});

function ClassicLibrary() {
  const { tree } = Route.useLoaderData() as { tree: ClassicBookTree | null };
  const categories = promotedCategories(tree);
  const promoBooks = categories.reduce((n, c) => n + c.books.length, 0);
  // 只有录入全文语料的书能在起名页按书出典，仅精选条目入藏的书不提供指定入口
  const promoSelectable = categories.reduce(
    (n, c) => n + c.books.filter((b) => b.selectable).length,
    0,
  );
  // 底部 CTA 取前两部展出书目：书目由管理端配置，不写死书名
  const ctaBooks = categories.flatMap((c) => c.books).slice(0, 2);

  return (
    <AppShell>
      <BreadcrumbJsonLd name="典籍馆" path="/dianji" />
      {promoBooks > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "典籍馆 · 起名用的国学典籍书目",
              numberOfItems: promoBooks,
              itemListElement: categories
                .flatMap((c) => c.books)
                .slice(0, 60)
                .map((b, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: b.book,
                  description: [b.intro, b.highlight ? `名句：${b.highlight}` : null]
                    .filter(Boolean)
                    .join(" · "),
                })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <PageHeader
        eyebrow="典故语料 · 书目公开"
        title="典籍馆"
        desc="起名引擎用到的每一部典籍都在这里：书目取自系统收录的原文语料，逐部列出简介、原文句数与代表名句。看中哪一部，就指定它为宝宝取名——名字的出处只来自这一部书。"
      />

      {promoBooks > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
          <span>
            当前展出 <span className="font-semibold text-vermilion-deep">{promoBooks}</span> 部典籍
          </span>
          <span>
            其中 <span className="font-semibold text-vermilion-deep">{promoSelectable}</span>{" "}
            部可在起名页指定取名
          </span>
          <span>
            已录入原文 <span className="font-semibold text-vermilion-deep">
              {(tree?.totalSentences ?? 0).toLocaleString()}
            </span>{" "}
            句
          </span>
        </div>
      ) : null}

      {/* 用法三步：把「指定典籍」这个新能力讲清楚 */}
      <section className="mt-7 grid gap-3 md:grid-cols-3">
        {[
          { s: "一", t: "挑一部典籍", d: "在支持指定的书卡片点「用这部取名」，或到起名页按类目勾选。" },
          { s: "二", t: "生成名字", d: "引擎只在这部书的原文里找字取意，引文逐条回查原书。" },
          { s: "三", t: "核对出处", d: "每个名字都标出处原句与篇目，可在结果里逐条核对。" },
        ].map((it) => (
          <div key={it.s} className={cardCls}>
            <p className="font-seal text-2xl leading-none text-vermilion-deep">{it.s}</p>
            <p className="mt-2 text-sm font-semibold">{it.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft text-pretty">{it.d}</p>
          </div>
        ))}
      </section>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">典籍书目暂时未加载出来，稍后刷新，或直接去起名页试试。</p>
          <Link
            to="/naming"
            search={namingSearchFor()}
            className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            去宝宝起名 →
          </Link>
        </div>
      ) : (
        categories.map((c) => (
          <section key={c.code} className="mt-9">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <span className="text-[11px] text-ink-faint">{c.books.length} 部</span>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {c.books.map((b) => (
                <div key={b.book} className={cardCls}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-seal text-2xl leading-none text-ink">《{b.book}》</p>
                      {/* 类目名与书名相同时不重复；不同名时标出（起名页按类目找书要用这一类目名） */}
                      {c.name !== b.book ? (
                        <p className="mt-1.5 text-[11px] text-ink-faint">类目 · {c.name}</p>
                      ) : null}
                    </div>
                    {b.sentenceCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-paper-3 px-2.5 py-0.5 text-[10px] tabular-nums text-ink-soft">
                        原文 {b.sentenceCount.toLocaleString()} 句
                      </span>
                    ) : b.entryCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-paper-3 px-2.5 py-0.5 text-[10px] tabular-nums text-ink-soft">
                        精选条目 {b.entryCount} 条
                      </span>
                    ) : null}
                  </div>

                  {b.intro ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">
                      {b.intro}
                    </p>
                  ) : null}

                  {b.highlight ? (
                    <div className="mt-3 rounded-xl bg-paper-2 p-3">
                      <p className="text-sm leading-relaxed text-ink text-pretty">{b.highlight}</p>
                      {b.highlightSource ? (
                        <p className="mt-1 text-[11px] text-ink-faint">—— {b.highlightSource}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {b.selectable ? (
                    <Link
                      to="/naming"
                      search={namingSearchFor(b.book)}
                      className="mt-4 block w-full rounded-xl bg-ink py-2.5 text-center text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
                    >
                      用《{b.book}》取名 →
                    </Link>
                  ) : (
                    <p className="mt-4 rounded-xl bg-paper-3 py-2.5 text-center text-xs text-ink-faint">
                      名句已入藏精选条目，整部原文尚未录入，暂不支持指定取名
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <section className="mt-12 rounded-2xl bg-white p-6 transition-colors hover:bg-vermilion-wash">
        <h2 className="text-lg font-semibold">指定典籍取名，和默认取名有什么不同？</h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-soft text-pretty">
          默认取名会在全部语料里为宝宝找字；指定典籍后，候选字与引文都只从这一部书的原文里出，
          出处集中在同一部典籍，适合家学传承、词风偏好或想让名字「认祖归宗」的场景。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {ctaBooks.map((b, i) => (
            <Link
              key={b.book}
              to="/naming"
              search={namingSearchFor(b.book)}
              className={
                i === 0
                  ? "rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
                  : "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
              }
            >
              用《{b.book}》取名 →
            </Link>
          ))}
          <Link
            to="/names"
            search={{ keyword: undefined }}
            className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
          >
            先看名字灵感库 →
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
