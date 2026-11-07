/**
 * 城市×姓氏页（M3）：/qiming/{省}/{市}/{姓} 与直辖市 /qiming/{直辖市}/{姓}。
 *
 * 地名与姓氏都只进 H1/title/URL；正文 = 该姓独有的谐音提示 + 按姓氏避让过滤后的
 * 真实名字参考 + 通用选字方法，与地名页同一合规口径（不写本地概况、不写吉凶）。
 */
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { SurnameNoteBlock, type SurnameNoteView } from "@/components/surname-note";
import {
  LinkChips,
  LongtailNameCards,
  ghostCls,
  sectionTitle,
} from "@/components/seo/longtail-blocks";
import {
  GENERIC_BRIEF_POINTS,
  GENERIC_BRIEF_SUMMARY,
  GENERIC_FAQ,
  GENERIC_INTRO,
  GENERIC_NAMES_NOTE,
  GENERIC_NOTICE,
  GENERIC_TIPS,
} from "@/content/qiming/generic";
import { buildPlaceSurnameContent } from "@/lib/seo/place-surname";
import type { GalleryName } from "@/lib/seo/data";
import { SURNAME_PLACE_HOSTS, surnameRank, type SurnamePlaceHost } from "@/lib/seo/longtail";
import type { PlaceInfo } from "@/lib/qiming/places";
import { TOP_SURNAMES, ZODIAC_SLUGS, currentZodiacSlug } from "@/lib/surnames";
import { track } from "@/lib/track";
import { namingCtaSearch } from "@/lib/zodiac-guide";
import { ZodiacFaqList } from "@/components/zodiac-blocks";

const cardCls = "rounded-2xl bg-white p-6";

export interface PlaceSurnamePageProps {
  place: PlaceInfo;
  /** 当前省份 slug（PlaceInfo 不带省份字段，路由 loader 传入）。 */
  provinceSlug: string;
  surname: { han: string; pinyin: string };
  boys: GalleryName[];
  girls: GalleryName[];
  note: SurnameNoteView;
}

export function PlaceSurnamePage({
  place,
  provinceSlug,
  surname,
  boys,
  girls,
  note,
}: PlaceSurnamePageProps) {
  const content = buildPlaceSurnameContent(place, surname);
  const zodiacSlug = currentZodiacSlug();
  const zodiacAnimal = ZODIAC_SLUGS.find((z) => z.slug === zodiacSlug)?.animal ?? "";
  const names = [...boys, ...girls];
  const rank = surnameRank(surname.pinyin);

  // 同城其它姓氏：同一宿主、按 50 大姓顺序取本姓之外的前 9 个（都在放开档位内才能互链）
  const siblingSurnames = TOP_SURNAMES.filter((s) => s.pinyin !== surname.pinyin).slice(0, 9);
  // 同姓其它城市：换省错开，取 5 个（含省级入口与省会，避免与本省重复）
  const otherHosts = SURNAME_PLACE_HOSTS.filter(
    (h) => h.provinceSlug !== provinceSlug && h.level === "city",
  )
    .filter((h, i) => i % 5 === Number(place.adcode.slice(-1)) % 5)
    .slice(0, 5);

  const faq = [
    ...GENERIC_FAQ,
    {
      q: `${place.displayName}${surname.han}姓小孩取名要注意什么？`,
      a:
        note.found && note.homophoneNote
          ? note.homophoneNote
          : `先读音后字义：把「${surname.han}」姓与候选名字连读几遍，确认声调有起伏、无不雅谐音；再看字义与出处，最后确认用字在规范汉字表内。`,
    },
  ];

  return (
    <>
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${place.displayName}${surname.han}姓宝宝名字参考`,
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

      <PageHeader eyebrow="地名×姓氏取名" title={content.h1} desc={GENERIC_INTRO} />

      <PageBrief
        summary={GENERIC_BRIEF_SUMMARY}
        points={GENERIC_BRIEF_POINTS}
        links={[
          { label: `${place.displayName}小孩取名`, to: place.path },
          { label: `${surname.han}姓生肖取名`, to: `/names/${surname.pinyin}/${zodiacSlug}` },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={content.canonical}
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
              <h3 className="mt-5 text-sm font-semibold text-ink">
                {place.displayName}
                {surname.han}姓男宝名字参考
              </h3>
              <LongtailNameCards surname={surname.han} names={boys} />
            </>
          ) : null}
          {girls.length > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-semibold text-ink">
                {place.displayName}
                {surname.han}姓女宝名字参考
              </h3>
              <LongtailNameCards surname={surname.han} names={girls} />
            </>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/naming"
          search={namingCtaSearch("qiming")}
          onClick={() =>
            track("qiming_place_surname_cta", { path: place.path, surname: surname.pinyin })
          }
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          用「{surname.han}」姓开始取名 →
        </Link>
        <Link to={place.path} className={ghostCls}>
          {place.displayName}小孩取名 →
        </Link>
      </div>

      <section className="mt-11">
        <h2 className={sectionTitle}>{place.displayName}的其它姓氏取名</h2>
        <LinkChips
          links={siblingSurnames.map((s) => ({
            label: `${place.displayName}${s.han}姓取名`,
            to: `${place.path}/${s.pinyin}`,
          }))}
        />
      </section>

      {otherHosts.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>{surname.han}姓在其它城市的取名页</h2>
          <LinkChips
            links={otherHosts.map((h: SurnamePlaceHost) => ({
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
    </>
  );
}
