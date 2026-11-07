import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { SurnameNoteBlock, type SurnameNoteView } from "@/components/surname-note";
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
  GENERIC_FAQ,
  GENERIC_INTRO,
  GENERIC_NAMES_NOTE,
  GENERIC_NOTICE,
  GENERIC_TIPS,
} from "@/content/qiming/generic";
import { fetchGalleryPair, fetchSurnameNoteView, type GalleryName } from "@/lib/seo/data";
import { SURNAME_PLACE_HOSTS } from "@/lib/seo/longtail";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import type { LongtailStages } from "@/lib/seo/rollout";
import { PLACE_SITE_ORIGIN } from "@/lib/qiming/content";
import { track } from "@/lib/track";
import { namingCtaSearch } from "@/lib/zodiac-guide";
import {
  TOP_SURNAMES,
  ZODIAC_SLUGS,
  surnameByPinyin,
  surnameZodiacPath,
  type Surname,
} from "@/lib/surnames";

/**
 * 姓氏单页：/names/{姓氏拼音}（50 大姓）。
 *
 * 与姓氏×生肖页同一内容策略：姓氏只进 H1/title/URL，正文 = 该姓独有的谐音/连读提示
 * （t_surname_note）+ 按姓氏避让过滤后的真实名字参考 + 通用选字方法。
 * 放量由 longtail.surname.stage 控制（0=全矩阵 noindex）。
 */
export const Route = createFileRoute("/names/$surname")({
  component: SurnamePage,
  loader: async ({ params }) => {
    const surname = surnameByPinyin(params.surname);
    if (!surname) throw notFound();
    const [stages, samples, note] = await Promise.all([
      getLongtailStages(),
      fetchGalleryPair({ surname: surname.han }),
      fetchSurnameNoteView(surname.han),
    ]);
    return { surname, stages, ...samples, note };
  },
  head: ({ loaderData }) => {
    const surname = loaderData?.surname;
    const stages = loaderData?.stages;
    const canonical = `https://name.duimai.net/names/${surname?.pinyin ?? ""}`;
    const title = surname
      ? `${surname.han}姓小孩取名：选字要点与名字参考 · 对脉名鉴`
      : "姓氏取名 · 对脉名鉴";
    const desc = surname
      ? `${surname.han}姓小孩取名怎么选字？从「${surname.han}」姓的读音连读、字义与书写入手，附男宝女宝名字参考、谐音提示与常见问题。`
      : "按姓氏查取名：选字要点与男宝女宝名字推荐。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        // 矩阵关闭时整批 noindex；姓氏已在 loader 常量校验，未收录地址直接 404
        ...(!surname || !stages || stages.surname !== 1
          ? [{ name: "robots", content: "noindex, follow" }]
          : []),
        {
          name: "keywords",
          content: surname
            ? `${surname.han}姓取名,${surname.han}姓小孩取名,${surname.han}姓宝宝取名,${surname.han}姓名字,小孩取名`
            : "姓氏取名,小孩取名",
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

function SurnamePage() {
  const { surname, boys, girls, note } = Route.useLoaderData() as {
    surname: Surname;
    stages: LongtailStages;
    boys: GalleryName[];
    girls: GalleryName[];
    note: SurnameNoteView;
  };
  const canonical = `${PLACE_SITE_ORIGIN}/names/${surname.pinyin}`;
  const names = [...boys, ...girls];
  // 同姓城市×姓氏页：换省错开取 5 个省会/直辖市入口
  const otherHosts = SURNAME_PLACE_HOSTS.filter(
    (h, i) =>
      h.level === "city" &&
      i % 10 === TOP_SURNAMES.findIndex((s) => s.pinyin === surname.pinyin) % 10,
  ).slice(0, 5);

  const faq = [
    ...GENERIC_FAQ,
    {
      q: `${surname.han}姓小孩取名要注意什么？`,
      a:
        note.found && note.homophoneNote
          ? note.homophoneNote
          : `先读音后字义：把「${surname.han}」姓与候选名字连读几遍，确认声调有起伏、无不雅谐音；再看字义与出处，最后确认用字在规范汉字表内。`,
    },
  ];

  return (
    <AppShell>
      <BreadcrumbJsonLd name={`${surname.han}姓小孩取名`} path={`/names/${surname.pinyin}`} />
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${surname.han}姓宝宝名字推荐`,
              numberOfItems: names.length,
              itemListElement: names.map((n, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${surname.han}${n.word}`,
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

      <PageHeader eyebrow="姓氏取名" title={`${surname.han}姓小孩取名`} desc={GENERIC_INTRO} />

      <PageBrief
        summary={GENERIC_BRIEF_SUMMARY}
        points={GENERIC_BRIEF_POINTS}
        links={[
          { label: "名字灵感库", to: "/names" },
          { label: `${surname.han}姓生肖取名`, to: surnameZodiacPath(surname.pinyin, "ma") },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={canonical}
      />

      <SurnameNoteBlock han={surname.han} note={note} />

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
          <h2 className={sectionTitle}>名字参考</h2>
          <p className="mt-1.5 text-xs text-ink-faint">{GENERIC_NAMES_NOTE}</p>
          {boys.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink">{surname.han}姓男宝名字参考</h3>
              <LongtailNameCards surname={surname.han} names={boys} />
            </>
          ) : null}
          {girls.length > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-semibold text-ink">{surname.han}姓女宝名字参考</h3>
              <LongtailNameCards surname={surname.han} names={girls} />
            </>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/naming"
          search={namingCtaSearch("surname_page")}
          onClick={() => track("surname_page_cta", { surname: surname.pinyin })}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          用「{surname.han}」姓开始取名 →
        </Link>
        <Link
          to="/name-eval"
          search={{ x: undefined, m: undefined, src: "surname_page" }}
          className={ghostCls}
        >
          先评测现有名字 →
        </Link>
      </div>

      <section className="mt-11">
        <h2 className={sectionTitle}>{surname.han}姓的生肖取名</h2>
        <LinkChips
          links={ZODIAC_SLUGS.map((z) => ({
            label: `${surname.han}姓${z.animal}年取名`,
            to: surnameZodiacPath(surname.pinyin, z.slug),
          }))}
        />
      </section>

      {otherHosts.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>{surname.han}姓在各省会的取名页</h2>
          <LinkChips
            links={otherHosts.map((h) => ({
              label: `${h.display}${surname.han}姓取名`,
              to: `${h.path}/${surname.pinyin}`,
            }))}
          />
        </section>
      ) : null}

      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <ZodiacFaqList items={faq} />
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">{GENERIC_NOTICE}</p>
      </section>
    </AppShell>
  );
}
