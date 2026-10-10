import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  ZodiacCharChips,
  ZodiacNameGrid,
  ZodiacNamingCta,
  ZodiacNotice,
  ZodiacRadicalChips,
  ZodiacTips,
  ZodiacYearHeadline,
  ZodiacYearNav,
} from "@/components/zodiac-blocks";
import {
  animalPath,
  animalYearPath,
  fetchZodiacGuide,
  inZodiacYearWindow,
  lookupZodiacGuide,
  zodiacYearWindow,
  type ZodiacGuideView,
  type ZodiacInfo,
} from "@/lib/zodiac-guide";

/**
 * 生肖年份页：/zodiac/{slug}/{year}。年份唯一确定生肖年（干支/立春起止由服务端现算），
 * slug 只作 URL 归属。收录窗口（过去十年+当前年+次年）外的年份 301 到生肖常青页——
 * 窗口外地址永远不会有内容，301 比长期 404 对收录友好（旧链接权重归并到常青页）。
 */
export const Route = createFileRoute("/zodiac/$animal/$year")({
  component: ZodiacYearPage,
  loader: async ({ params }) => {
    const year = /^\d{4}$/.test(params.year) ? Number(params.year) : null;
    if (year === null) throw notFound();
    // 窗口外年份：301 到生肖常青页（内容常年有效，随当年流转）
    if (!inZodiacYearWindow(year)) {
      throw redirect({ href: animalPath(params.animal), statusCode: 301 });
    }
    // 前后年只取元信息（limit=1）：用于跨生肖的年份导航；窗口外不取（会被重定向，不外链）
    const win = zodiacYearWindow();
    const [main, prev, next] = await Promise.all([
      lookupZodiacGuide({ year, limit: 18 }),
      year - 1 >= win.start
        ? fetchZodiacGuide({ year: year - 1, limit: 1 })
        : Promise.resolve(null),
      year + 1 <= win.end
        ? fetchZodiacGuide({ year: year + 1, limit: 1 })
        : Promise.resolve(null),
    ]);
    // 服务端判定年份超范围（400）→ 404：这种地址永远不会有内容，兜底空页不该被收录
    if (main.invalid) throw notFound();
    // 窗口内但 slug 与该年生肖不符（如 /zodiac/she/2026，2026 为马年）：301 到正确地址
    //（比渲染+canonical 纠偏更彻底，消灭重复内容变体）
    if (main.view && main.view.info.slug !== params.animal) {
      throw redirect({
        href: animalYearPath(main.view.info.slug, year),
        statusCode: 301,
      });
    }
    return {
      view: main.view,
      prev: prev?.info ?? null,
      next: next?.info ?? null,
      slug: params.animal,
      raw: params.year,
    };
  },
  head: ({ loaderData }) => {
    const info = loaderData?.view?.info ?? null;
    const slug = loaderData?.slug ?? "";
    const raw = loaderData?.raw ?? "";
    const canonical = info
      ? `https://name.duimai.net${animalYearPath(info.slug, info.year)}`
      : `https://name.duimai.net/zodiac/${slug}/${raw}`;
    const title = info
      ? `${info.year} ${info.ganzhi}${info.animal}年宝宝取名用字宜忌 · 对脉名鉴`
      : "生肖年份页 · 对脉名鉴";
    const desc = info
      ? `${info.year} 年的生肖年为${info.ganzhi}${info.animal}年（${info.termStart} 立春起、${info.termEnd} 止）：传统取名习俗认为宜用 ${info.preferredRadicals.join("／")} 等部首，忌用 ${info.forbiddenRadicals.join("／")} 等部首。附可用名字与出处，供参考。`
      : "按年份查询生肖年的干支、立春起止与用字宜忌。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        // 年份无效/超范围或接口未就绪 → 兜底内容不进索引
        ...(info ? [] : [{ name: "robots", content: "noindex" }]),
        {
          name: "keywords",
          content: info
            ? `${info.year}年宝宝取名,${info.ganzhi}年,属${info.animal}取名,生肖年,立春`
            : "生肖年,生肖取名",
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

function ZodiacYearPage() {
  const { view, prev, next, raw } = Route.useLoaderData() as {
    view: ZodiacGuideView | null;
    prev: ZodiacInfo | null;
    next: ZodiacInfo | null;
    raw: string;
  };

  if (!view) {
    return (
      <AppShell>
        <PageHeader eyebrow="生肖取名 · 年份页" title="生肖年份页" />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            没查到「{raw}」这个年份的生肖资料：请确认年份为 4
            位数字且在可查询范围内，也可能是数据暂时未加载出来。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/zodiac" className={ghostCls}>
              看十二生肖与当年 →
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
  // 收录窗口内的同生肖轮次（窗口外年份页会 301 到常青页，不外链）；不足 2 项时隐藏区块
  const windowRounds = years.filter((r) => inZodiacYearWindow(r.year));
  const windowNext = nextRound && inZodiacYearWindow(nextRound) ? nextRound : null;
  const showRoundsNav = windowRounds.length + (windowNext ? 1 : 0) >= 2;

  return (
    <AppShell>
      <BreadcrumbJsonLd
        name={`${info.year} ${info.ganzhi}${info.animal}年`}
        path={animalYearPath(info.slug, info.year)}
      />
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${info.year} ${info.ganzhi}${info.animal}年宝宝名字推荐`,
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

      <PageHeader
        eyebrow={`生肖取名 · ${info.branchCn}${info.animal}`}
        title={`${info.year} ${info.ganzhi}${info.animal}年宝宝取名`}
        desc={`${info.year} 年的生肖年自 ${info.termStart} 立春起算、到 ${info.termEnd} 止，这一年的宝宝生肖属${info.animal}。${copy.intro || info.note}`}
      />

      <div className="mt-7 rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            {current ? "当前生肖年" : "该年生肖"} · 宜用与忌用部首
          </p>
          <Link
            to="/zodiac/$animal"
            params={{ animal: info.slug }}
            className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
          >
            属{info.animal}取名常青页 →
          </Link>
        </div>
        <div className="mt-3">
          <ZodiacYearHeadline info={info} current={current} />
          <ZodiacRadicalChips info={info} />
          <ZodiacTips tips={copy.tips} />
          <ZodiacCharChips chars={preferredChars} />
        </div>
      </div>

      <ZodiacNamingCta
        label={`按${info.year} ${info.ganzhi}${info.animal}年的宜用部首起名 →`}
        from={`year_${info.slug}_${info.year}`}
      />

      {/* 相邻年份：跨生肖逐年流转，地址取该年自己的生肖（canonical 一致） */}
      <section className="mt-11">
        <h2 className={sectionTitle}>前后年份</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {prev ? (
            <Link
              to="/zodiac/$animal/$year"
              params={{ animal: prev.slug, year: String(prev.year) }}
              className={ghostCls}
            >
              ← 上一年 {prev.year} {prev.ganzhi}
              {prev.animal}年
            </Link>
          ) : null}
          {next ? (
            <Link
              to="/zodiac/$animal/$year"
              params={{ animal: next.slug, year: String(next.year) }}
              className={ghostCls}
            >
              下一年 {next.year} {next.ganzhi}
              {next.animal}年 →
            </Link>
          ) : null}
          <Link to="/zodiac" className={ghostCls}>
            十二生肖总览 →
          </Link>
        </div>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>
          {info.year} {info.ganzhi}
          {info.animal}年宝宝名字推荐
        </h2>
        <p className="mt-1.5 text-xs text-ink-faint">
          用字均命中 {info.preferredRadicals.join("／")}{" "}
          等宜用部首、且未用忌用部首；按命中数与人工评分排序。
        </p>
        <ZodiacNameGrid
          names={names}
          empty="这个名字列表暂时为空：可先到名字灵感库按生肖筛，或直接起名。"
        />
      </section>

      {showRoundsNav ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>同一生肖的其它年份（每 12 年一轮）</h2>
          <ZodiacYearNav rounds={windowRounds} slug={info.slug} nextRound={windowNext} />
          <ZodiacNotice />
        </section>
      ) : (
        <section className="mt-11">
          <ZodiacNotice />
        </section>
      )}
    </AppShell>
  );
}
