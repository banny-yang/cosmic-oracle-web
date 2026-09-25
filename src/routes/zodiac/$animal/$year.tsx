import { createFileRoute, Link } from "@tanstack/react-router";
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
  type ZodiacGuideView,
  type ZodiacInfo,
} from "@/lib/zodiac-guide";

/**
 * 生肖年份页：/zodiac/{slug}/{year}。年份唯一确定生肖年（干支/立春起止由服务端现算），
 * slug 只作 URL 归属：与年份生肖不一致时按年份展示，并把 canonical 指回正确地址。
 */
export const Route = createFileRoute("/zodiac/$animal/$year")({
  component: ZodiacYearPage,
  loader: async ({ params }) => {
    const year = /^\d{4}$/.test(params.year) ? Number(params.year) : null;
    if (year === null) {
      return { view: null, prev: null, next: null, slug: params.animal, raw: params.year };
    }
    // 前后年只取元信息（limit=1）：用于跨生肖的年份导航，越界年份由接口拒绝（返回 400 → null）
    const [view, prev, next] = await Promise.all([
      fetchZodiacGuide({ year, limit: 18 }),
      fetchZodiacGuide({ year: year - 1, limit: 1 }),
      fetchZodiacGuide({ year: year + 1, limit: 1 }),
    ]);
    return {
      view,
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
  const { view, prev, next, slug, raw } = Route.useLoaderData() as {
    view: ZodiacGuideView | null;
    prev: ZodiacInfo | null;
    next: ZodiacInfo | null;
    slug: string;
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
  // 地址里的生肖与年份生肖不一致（如从属马页跳到羊年）：按年份展示，并给出正确入口
  const mismatched = info.slug !== slug;

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

      {mismatched ? (
        <div className="mt-6 rounded-2xl bg-vermilion-wash p-4">
          <p className="text-xs leading-relaxed text-vermilion-deep text-pretty">
            这里是按年份打开的第 {info.year} 年生肖页：该年的生肖是{info.ganzhi}
            {info.animal}年（属{info.animal}），与地址里的属{slug}页不是同一年。属{info.animal}
            的常青页见
            <Link
              to="/zodiac/$animal"
              params={{ animal: info.slug }}
              className="mx-1 font-medium underline underline-offset-2"
            >
              属{info.animal}取名
            </Link>
            。
          </p>
        </div>
      ) : null}

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

      <section className="mt-11">
        <h2 className={sectionTitle}>同一生肖的其它年份（每 12 年一轮）</h2>
        <ZodiacYearNav rounds={years} slug={info.slug} nextRound={nextRound} />
        <ZodiacNotice />
      </section>
    </AppShell>
  );
}
