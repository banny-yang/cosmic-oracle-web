/**
 * 省/市/县地名页的共用版块。
 *
 * 地名只出现在 H1（PageHeader）与页面元数据里；正文全部是通用选字方法、真实名字参考、
 * 姓氏入口与通用问答。页面之间不互链、不显示面包屑——只有页脚 /qiming 总入口是站内出口。
 */
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { ZodiacFaqList, ZodiacNameGrid } from "@/components/zodiac-blocks";
import {
  GENERIC_BRIEF_POINTS,
  GENERIC_BRIEF_SUMMARY,
  GENERIC_FAQ,
  GENERIC_INTRO,
  GENERIC_NAMES_NOTE,
  GENERIC_NOTICE,
  GENERIC_SURNAMES_NOTE,
  GENERIC_TIPS,
} from "@/content/qiming/generic";
import { buildPlaceContent } from "@/lib/qiming/content";
import type { PlaceInfo } from "@/lib/qiming/places";
import { TOP_SURNAMES, ZODIAC_SLUGS, currentZodiacSlug } from "@/lib/surnames";
import { track } from "@/lib/track";
import { namingCtaSearch, type ZodiacName } from "@/lib/zodiac-guide";

const sectionTitle = "text-lg font-semibold";
const cardCls = "rounded-2xl bg-white p-6";

export interface PlacePageViewProps {
  place: PlaceInfo;
  male: ZodiacName[];
  female: ZodiacName[];
}

/** 按 adcode 轮换 12 个常见姓，避免每个地名页的姓氏入口完全一样。 */
function rotatedSurnames(adcode: string) {
  const start = Number(adcode.slice(-2)) % TOP_SURNAMES.length;
  return Array.from(
    { length: 12 },
    (_, i) => TOP_SURNAMES[(start + i) % TOP_SURNAMES.length],
  ).filter((s): s is (typeof TOP_SURNAMES)[number] => Boolean(s));
}

export function PlacePageView({ place, male, female }: PlacePageViewProps) {
  const content = buildPlaceContent(place);
  const zodiacSlug = currentZodiacSlug();
  const zodiacAnimal = ZODIAC_SLUGS.find((z) => z.slug === zodiacSlug)?.animal ?? "";
  const surnames = rotatedSurnames(place.adcode);
  const names = [...male, ...female];

  return (
    <>
      {names.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "宝宝名字参考",
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
            mainEntity: GENERIC_FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />

      <PageHeader eyebrow="小孩取名" title={content.h1} desc={GENERIC_INTRO} />

      <PageBrief
        summary={GENERIC_BRIEF_SUMMARY}
        points={GENERIC_BRIEF_POINTS}
        links={[
          { label: "名字灵感库", to: "/names" },
          { label: "生肖取名", to: "/zodiac" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={content.canonical}
      />

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
          {male.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink">男宝名字参考</h3>
              <ZodiacNameGrid names={male} empty="" />
            </>
          ) : null}
          {female.length > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-semibold text-ink">女宝名字参考</h3>
              <ZodiacNameGrid names={female} empty="" />
            </>
          ) : null}
        </section>
      ) : null}

      <section className="mt-11">
        <h2 className={sectionTitle}>按姓氏继续找</h2>
        <p className="mt-1.5 text-xs text-ink-faint">{GENERIC_SURNAMES_NOTE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {surnames.map((s) => (
            <Link
              key={s.pinyin}
              to="/names/$surname/$animal"
              params={{ surname: s.pinyin, animal: zodiacSlug }}
              className="rounded-full bg-paper-3 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-vermilion-wash hover:text-vermilion-deep"
            >
              {s.han}姓{zodiacAnimal}年取名
            </Link>
          ))}
          <Link
            to="/names"
            search={{ keyword: undefined }}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            名字灵感库 →
          </Link>
        </div>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <ZodiacFaqList items={GENERIC_FAQ} />
      </section>

      <section className="mt-11">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/naming"
            search={namingCtaSearch("qiming")}
            onClick={() => track("qiming_place_cta", { adcode: place.adcode, level: place.level })}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            开始取名 →
          </Link>
          <Link
            to="/name-eval"
            search={{ x: undefined, m: undefined, src: "qiming" }}
            className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
          >
            先评测现有名字 →
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">{GENERIC_NOTICE}</p>
      </section>
    </>
  );
}
