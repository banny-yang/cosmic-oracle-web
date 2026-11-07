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
} from "@/content/qiming/generic";
import {
  fetchCharsByElement,
  fetchGalleryPair,
  type CharRow,
  type GalleryName,
} from "@/lib/seo/data";
import { WUXING_ELEMENTS, wuxingBySlug } from "@/lib/seo/longtail";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import type { LongtailStages } from "@/lib/seo/rollout";
import { track } from "@/lib/track";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 五行元素页：/wuxing/{元素slug}（金木水火土 5 页）。
 *
 * 用字表来自字库公开接口（适名字按语料频次降序，带拼音/康熙笔画/部首），
 * 名字参考按主五行从灵感库取——每个元素页的用字与名字都不同。
 * 放量由 longtail.wuxing.stage 控制（0=整矩阵 noindex）。
 */
export const Route = createFileRoute("/wuxing/$element")({
  component: WuxingElementPage,
  loader: async ({ params }) => {
    const el = wuxingBySlug(params.element);
    if (!el) throw notFound();
    const [stages, chars, samples] = await Promise.all([
      getLongtailStages(),
      fetchCharsByElement(el.element, 48),
      fetchGalleryPair({ element: el.element }),
    ]);
    return { el, stages, chars, ...samples };
  },
  head: ({ loaderData }) => {
    const el = loaderData?.el;
    const stages = loaderData?.stages as LongtailStages | undefined;
    const canonical = `https://name.duimai.net/wuxing/${el?.slug ?? ""}`;
    const title = el
      ? `五行属${el.han}的字取名：常用字与名字参考 · 对脉名鉴`
      : "五行取名 · 对脉名鉴";
    const desc = el
      ? `五行属${el.han}的字有哪些？${el.intro}本页给出属${el.han}的常见取名字（附拼音、康熙笔画、部首）与名字参考。`
      : "按五行查取名字。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        ...(!el || !stages || stages.wuxing !== 1
          ? [{ name: "robots", content: "noindex, follow" }]
          : []),
        {
          name: "keywords",
          content: el
            ? `五行属${el.han}的字,五行属${el.han}的名字,${el.han}字旁取名,五行取名`
            : "五行取名,取名字",
        },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

const cardCls = "rounded-2xl bg-white p-6";

function WuxingElementPage() {
  const { el, chars, boys, girls } = Route.useLoaderData() as {
    el: { slug: string; han: string; element: string; intro: string };
    stages: LongtailStages;
    chars: CharRow[];
    boys: GalleryName[];
    girls: GalleryName[];
  };
  const canonical = `https://name.duimai.net/wuxing/${el.slug}`;
  const names = [...boys, ...girls];
  const siblings = WUXING_ELEMENTS.filter((e) => e.slug !== el.slug);

  const faq = [
    {
      q: `五行属${el.han}的字有哪些？`,
      a: `${el.intro}本页的字表按语料使用频次排列，附拼音、康熙笔画与部首，供取名选字时对照。`,
    },
    {
      q: "字的五行是按什么口径归类的？",
      a: "以部首优先（如三点水属水、木字旁属木），无部首线索的字按康熙笔画尾数归类；本站字库逐字标注口径，管理端可人工修正个别字。",
    },
    {
      q: `宝宝五行缺${el.han}就一定要用属${el.han}的字吗？`,
      a: "不一定。五行补益是传统姓名文化参考，不同流派对「缺」与「补」的说法并不一致；更基础的是读音、字义、书写与姓氏连读，五行偏好放在最后权衡即可。",
    },
  ];

  return (
    <AppShell>
      <BreadcrumbJsonLd name={`五行属${el.han}的字取名`} path={`/wuxing/${el.slug}`} />
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `五行属${el.han}的名字参考`,
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
        eyebrow="五行取名"
        title={`五行属${el.han}的字取名`}
        desc={`${el.intro}${GENERIC_INTRO}`}
      />

      <PageBrief
        summary={`五行属${el.han}的适名用字以部首与康熙笔画口径归类；本页给出 ${chars.length} 个常用字（附拼音、笔画、部首）与 ${names.length} 个名字参考。`}
        points={GENERIC_BRIEF_POINTS}
        links={[
          { label: "名字灵感库", to: "/names" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={canonical}
      />

      {chars.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>五行属{el.han}的常用字</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            按语料使用频次降序；笔画为康熙字典口径，与户籍简体笔画可能不同。
          </p>
          <div className={`mt-3 ${cardCls} overflow-x-auto`}>
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs text-ink-faint">
                  <th className="py-2 pr-4 font-medium">字</th>
                  <th className="py-2 pr-4 font-medium">拼音</th>
                  <th className="py-2 pr-4 font-medium">康熙笔画</th>
                  <th className="py-2 font-medium">部首</th>
                </tr>
              </thead>
              <tbody>
                {chars.map((c) => (
                  <tr key={c.char} className="border-t border-paper-3">
                    <td className="py-2 pr-4 font-seal text-2xl text-ink">{c.char}</td>
                    <td className="py-2 pr-4 text-ink-soft">{c.pinyin}</td>
                    <td className="py-2 pr-4 text-ink-soft">{c.strokes}</td>
                    <td className="py-2 text-ink-soft">{c.radical || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {names.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>属{el.han}的名字参考</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            首字主五行为{el.han}的名字，均标注出处与意蕴；评分只作字库内部参考。
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
          search={namingCtaSearch("wuxing_page")}
          onClick={() => track("wuxing_page_cta", { element: el.slug })}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          按五行偏好取名 →
        </Link>
        <Link to="/names" className={ghostCls}>
          名字灵感库 →
        </Link>
      </div>

      <section className="mt-11">
        <h2 className={sectionTitle}>其它五行属性</h2>
        <LinkChips
          links={siblings.map((e) => ({
            label: `五行属${e.han}的字`,
            to: `/wuxing/${e.slug}`,
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
