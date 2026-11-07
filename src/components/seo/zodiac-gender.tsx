/**
 * 生肖×性别页（M5）：/zodiac/{生肖}/boy|girl（24 页）。
 *
 * 与生肖常青页共用同一份生肖宜忌数据（zodiac-guide），差异在性别：名字候选按
 * 性别从灵感库取，FAQ 与文案围绕「属X男孩/女孩取名」的长尾问法组织。
 * 放量由 longtail.zodiac-gender.stage 控制（0=整矩阵 noindex）。
 */
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import {
  LinkChips,
  LongtailNameCards,
  ghostCls,
  sectionTitle,
} from "@/components/seo/longtail-blocks";
import {
  ZodiacCharChips,
  ZodiacFaqList,
  ZodiacNotice,
  ZodiacRadicalChips,
  ZodiacTips,
} from "@/components/zodiac-blocks";
import { GENERIC_NOTICE } from "@/content/qiming/generic";
import type { GalleryName } from "@/lib/seo/data";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import type { LongtailStages } from "@/lib/seo/rollout";
import { track } from "@/lib/track";
import {
  animalPath,
  animalYearPath,
  namingCtaSearch,
  type ZodiacGuideView,
} from "@/lib/zodiac-guide";
import { ZODIAC_SLUGS } from "@/lib/surnames";

export interface ZodiacGenderHeadInput {
  gender: "M" | "F";
  zodiac: { slug: string; animal: string };
  view: ZodiacGuideView | null;
  stages: LongtailStages | null | undefined;
}

export function zodiacGenderHead({ gender, zodiac, view, stages }: ZodiacGenderHeadInput) {
  const genderLabel = gender === "M" ? "男孩" : "女孩";
  const canonical = `https://name.duimai.net/zodiac/${zodiac.slug}/${gender === "M" ? "boy" : "girl"}`;
  const info = view?.info ?? null;
  const title = `属${zodiac.animal}${genderLabel}取名：宜用部首与名字推荐 · 对脉名鉴`;
  const desc = info
    ? `属${zodiac.animal}${genderLabel}取名怎么选字？按${zodiac.animal}年宜用 ${info.preferredRadicals.join("、")} 等部首整理，本页给出属${zodiac.animal}${genderLabel}的名字推荐（附拼音、典籍出处与意蕴）。`
    : `属${zodiac.animal}${genderLabel}取名：宜用部首与名字推荐。`;
  return {
    links: [{ rel: "canonical", href: canonical }],
    meta: [
      { title },
      { name: "description", content: desc },
      // 生肖未收录、矩阵关闭或接口未就绪 → 不进索引
      ...(!info || !stages || stages.zodiacGender !== 1
        ? [{ name: "robots", content: "noindex, follow" }]
        : []),
      {
        name: "keywords",
        content: `属${zodiac.animal}${genderLabel}取名,${zodiac.animal}年${genderLabel}宝宝名字,生肖取名,${genderLabel}取名`,
      },
      { property: "og:url", content: canonical },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  };
}

export function ZodiacGenderPage({
  gender,
  zodiac,
  view,
  names,
}: {
  gender: "M" | "F";
  zodiac: { slug: string; animal: string };
  view: ZodiacGuideView | null;
  names: GalleryName[];
}) {
  const genderLabel = gender === "M" ? "男孩" : "女孩";
  const genderPath = gender === "M" ? "boy" : "girl";
  const opposite =
    gender === "M" ? { label: "女孩", path: "girl" } : { label: "男孩", path: "boy" };

  if (!view) {
    return (
      <>
        <PageHeader eyebrow="生肖取名" title={`属${zodiac.animal}${genderLabel}取名`} />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            「属{zodiac.animal}
            {genderLabel}」的资料暂时没有加载出来，可能是数据服务未就绪，稍后刷新试试。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/zodiac/$animal" params={{ animal: zodiac.slug }} className={ghostCls}>
              属{zodiac.animal}取名常青页 →
            </Link>
            <Link to="/names" search={{ zodiac: zodiac.slug }} className={ghostCls}>
              灵感库筛属{zodiac.animal}的名字 →
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { info, copy, preferredChars } = view;
  const faq = [
    {
      q: `属${zodiac.animal}${genderLabel}取名宜用哪些部首？`,
      a: `按传统取名习俗，属${zodiac.animal}宜用 ${info.preferredRadicals.join("、")} 等部首，忌用 ${info.forbiddenRadicals.join("、")} 等部首。本页推荐的名字均命中宜用部首、未用忌用部首；宜忌是文化参考，最终以字音、字义与书写综合取舍。`,
    },
    {
      q: `属${zodiac.animal}${genderLabel}取名怎么选字？`,
      a: `先按${zodiac.animal}年宜用部首缩小范围，再读：把候选名字连读几遍，声调有起伏、不绕口；最后看字义是否清楚、书写是否顺手。${genderLabel}名字可偏${gender === "M" ? "开阔大气" : "清雅温婉"}，但不必受刻板印象限制。`,
    },
    {
      q: `属${zodiac.animal}${genderLabel}的名字有哪些推荐？`,
      a: names.length
        ? `如 ${names
            .slice(0, 3)
            .map((n) => n.word)
            .join(
              "、",
            )} 等：均出自典籍语料并命中${zodiac.animal}年宜用部首。完整方案（音律、数理与生辰五行）可在起名页现算，首次免费看 3 个精选名。`
        : `本页暂未收录属${zodiac.animal}${genderLabel}的名字，可到名字灵感库按生肖「${zodiac.animal}」与性别筛选，或直接在起名页生成。`,
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
              name: `属${zodiac.animal}${genderLabel}的名字推荐`,
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
        eyebrow={`生肖取名 · ${info.branchCn}${zodiac.animal}`}
        title={`属${zodiac.animal}${genderLabel}取名`}
        desc={`${info.ganzhi}${zodiac.animal}年出生的${genderLabel}宝宝属${zodiac.animal}。本页按${zodiac.animal}年宜用部首筛出${genderLabel}名字，附拼音、典籍出处原句与意蕴。${info.note}`}
      />

      <PageBrief
        summary={`属${zodiac.animal}${genderLabel}取名，按传统习俗宜用 ${info.preferredRadicals.join("、")} 等部首，忌用 ${info.forbiddenRadicals.join("、")} 等部首；本页给出 ${names.length} 个命中宜用部首的${genderLabel}名字（附出处）。`}
        points={[
          `${zodiac.animal}年以立春为界：${info.termStart} 立春起、${info.termEnd} 止，立春前出生仍属上一生肖。`,
          "本页名字均标注原文出处，评分只作字库内部参考。",
          "名字与姓氏的完整搭配（音律、数理与生辰五行）以起名页现算为准。",
        ]}
        links={[
          { label: `属${zodiac.animal}取名常青页`, to: animalPath(zodiac.slug) },
          {
            label: `属${zodiac.animal}${opposite.label}取名`,
            to: `/zodiac/${zodiac.slug}/${opposite.path}` as string,
          },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={`https://name.duimai.net/zodiac/${zodiac.slug}/${genderPath}`}
      />

      <div className="mt-7 rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold">属{zodiac.animal} · 宜用与忌用部首</h3>
          <Link
            to="/zodiac/$animal"
            params={{ animal: zodiac.slug }}
            className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
          >
            属{zodiac.animal}取名常青页 →
          </Link>
        </div>
        <div className="mt-3">
          <ZodiacRadicalChips info={info} />
          <ZodiacTips tips={copy.tips} />
          <ZodiacCharChips chars={preferredChars} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/naming"
          search={namingCtaSearch("zodiac_gender")}
          onClick={() => track("zodiac_gender_cta", { zodiac: zodiac.slug, gender })}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          属{zodiac.animal}
          {genderLabel}名字生成 →
        </Link>
        <Link
          to="/zodiac/$animal/$year"
          params={{ animal: zodiac.slug, year: String(info.year) }}
          className={ghostCls}
        >
          {info.year} {info.ganzhi}
          {zodiac.animal}年 →
        </Link>
      </div>

      <section className="mt-11">
        <h2 className={sectionTitle}>
          属{zodiac.animal}
          {genderLabel}的名字推荐
        </h2>
        <p className="mt-1.5 text-xs text-ink-faint">
          用字均命中 {info.preferredRadicals.join("／")}{" "}
          等宜用部首、且未用忌用部首；按命中数与人工评分排序。
        </p>
        <LongtailNameCards names={names} />
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <ZodiacFaqList items={faq} />
        <ZodiacNotice />
        <p className="mt-2 text-xs leading-relaxed text-ink-faint text-pretty">{GENERIC_NOTICE}</p>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>其它生肖的{genderLabel}取名</h2>
        <LinkChips
          links={ZODIAC_SLUGS.filter((z) => z.slug !== zodiac.slug).map((z) => ({
            label: `属${z.animal}${genderLabel}取名`,
            to: `/zodiac/${z.slug}/${genderPath}`,
          }))}
        />
      </section>
    </>
  );
}
