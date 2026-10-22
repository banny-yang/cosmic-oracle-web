import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import {
  ZodiacCharChips,
  ZodiacFaqList,
  ZodiacNotice,
  ZodiacRadicalChips,
  ZodiacTips,
  ZodiacYearHeadline,
} from "@/components/zodiac-blocks";
import { get } from "@/lib/api";
import { track } from "@/lib/track";
import {
  TOP_SURNAMES,
  ZODIAC_SLUGS,
  surnameByPinyin,
  surnameZodiacPath,
  zodiacBySlug,
  type Surname,
} from "@/lib/surnames";
import { lookupZodiacGuide, type ZodiacGuideView } from "@/lib/zodiac-guide";

/**
 * 姓氏×生肖取名长尾页：/names/{姓氏拼音}/{生肖slug}（如 /names/wang/ma）。
 * 姓氏与生肖都先在前端常量校验（未收录 → 404，不产生无效地址）；生肖宜忌与干支由
 * zodiac-guide 现算（口径与 /zodiac 一致），男/女名字从灵感库按生肖+性别筛（各 8 个）。
 * 内容形态照抄生肖年份页：FAQPage 与可见问答共用同一数组，接口失败走 noindex 兜底。
 */
export const Route = createFileRoute("/names/$surname/$animal")({
  component: SurnameZodiacPage,
  loader: async ({ params }) => {
    const surname = surnameByPinyin(params.surname);
    const zodiac = zodiacBySlug(params.animal);
    if (!surname || !zodiac) throw notFound();
    const [guide, boys, girls] = await Promise.all([
      lookupZodiacGuide({ animal: params.animal, limit: 10 }),
      fetchZodiacNames(params.animal, "M"),
      fetchZodiacNames(params.animal, "F"),
    ]);
    // 生肖 slug 已过常量校验，invalid 理论不出现；view 为 null 视为接口未就绪（页面走 noindex 兜底）
    return { surname, zodiac, view: guide.view, boys, girls };
  },
  head: ({ loaderData }) => {
    const surname = loaderData?.surname;
    const zodiac = loaderData?.zodiac;
    const info = loaderData?.view?.info ?? null;
    const canonical = `https://name.duimai.net${surnameZodiacPath(surname?.pinyin ?? "", zodiac?.slug ?? "")}`;
    const title =
      surname && zodiac
        ? `${surname.han}姓${zodiac.animal}年宝宝取名：宜用部首与名字推荐 · 对脉名鉴`
        : "姓氏×生肖取名 · 对脉名鉴";
    const desc =
      surname && zodiac && info
        ? `按传统取名习俗，${zodiac.animal}年宜用 ${info.preferredRadicals.join("、")} 等部首。本页给出${surname.han}姓${zodiac.animal}年男宝与女宝名字推荐（附拼音、典籍出处原句与意蕴），并可按「${surname.han}」姓一键生成完整取名方案。`
        : "按姓氏与生肖查取名：宜用部首与男宝女宝名字推荐。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        // 姓氏/生肖未收录或接口未就绪 → 兜底内容不进索引
        ...(info ? [] : [{ name: "robots", content: "noindex" }]),
        {
          name: "keywords",
          content:
            surname && zodiac
              ? `${surname.han}姓取名,${zodiac.animal}年宝宝取名,${surname.han}姓${zodiac.animal}年名字,${info ? info.ganzhi + "年," : ""}生肖取名`
              : "姓氏取名,生肖取名",
        },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

interface GalleryName {
  word: string;
  pinyin?: string | null;
  gender?: string | null;
  score?: number | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
}

/** 灵感库按生肖+性别取名字（与 /names 同接口，页首直出；失败返回空，区块隐藏）。 */
function fetchZodiacNames(zodiac: string, gender: "M" | "F"): Promise<GalleryName[]> {
  return get<{ items: GalleryName[] }>(
    "/api/v1/naming/name-gallery",
    { page: 0, size: 8, zodiac, gender },
    { auth: false, timeoutMs: 10000 },
  )
    .then((r) => (Array.isArray(r?.items) ? r.items : []))
    .catch(() => []);
}

const sectionTitle = "text-lg font-semibold";
const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

function SurnameZodiacPage() {
  const { surname, zodiac, view, boys, girls } = Route.useLoaderData() as {
    surname: Surname;
    zodiac: { slug: string; animal: string };
    view: ZodiacGuideView | null;
    boys: GalleryName[];
    girls: GalleryName[];
  };

  if (!view) {
    return (
      <AppShell>
        <PageHeader eyebrow="姓氏×生肖取名" title="姓氏×生肖取名" />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            「{surname.han}姓{zodiac.animal}
            年」的资料暂时没有加载出来，可能是数据服务未就绪，稍后刷新试试。
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
      </AppShell>
    );
  }

  const { info, copy, preferredChars, years } = view;
  const boyWords = boys
    .slice(0, 3)
    .map((n) => n.word)
    .join("、");
  const girlWords = girls
    .slice(0, 3)
    .map((n) => n.word)
    .join("、");

  // 现算问答（可见列表与 FAQPage 结构化数据共用同一数组，内容天然一致）
  const faq = [
    {
      q: `${surname.han}姓${zodiac.animal}年宝宝取名宜用哪些部首？`,
      a: `按传统取名习俗，属${zodiac.animal}宜用 ${info.preferredRadicals.join("、")} 等部首，忌用 ${info.forbiddenRadicals.join("、")} 等部首。本页推荐的${surname.han}姓${zodiac.animal}年名字均命中宜用部首、未用忌用部首；宜忌是文化参考，最终以字音、字义与书写综合取舍。`,
    },
    {
      q: `${surname.han}姓${zodiac.animal}年男宝名字有哪些推荐？`,
      a: boyWords
        ? `如 ${boyWords} 等：均出自典籍语料并命中${zodiac.animal}年宜用部首。名字与「${surname.han}」姓的完整搭配（音律、数理与生辰五行）可在起名页按${surname.han}姓现算，首次免费看 3 个精选名。`
        : `本页暂未收录${surname.han}姓${zodiac.animal}年男宝名字，可到名字灵感库按生肖「${zodiac.animal}」与性别筛选，或直接在起名页按${surname.han}姓生成。`,
    },
    {
      q: `${surname.han}姓${zodiac.animal}年女宝名字有哪些推荐？`,
      a: girlWords
        ? `如 ${girlWords} 等：均出自典籍语料并命中${zodiac.animal}年宜用部首。名字与「${surname.han}」姓的完整搭配（音律、数理与生辰五行）可在起名页按${surname.han}姓现算，首次免费看 3 个精选名。`
        : `本页暂未收录${surname.han}姓${zodiac.animal}年女宝名字，可到名字灵感库按生肖「${zodiac.animal}」与性别筛选，或直接在起名页按${surname.han}姓生成。`,
    },
    {
      q: `${zodiac.animal}年是哪几年？宝宝属${zodiac.animal}怎么算？`,
      a: `生肖年以立春为界：当前一轮${zodiac.animal}年为 ${info.ganzhi}${zodiac.animal}年（${info.termStart} 立春起、${info.termEnd} 止），每 12 年一轮（近几轮如 ${years
        .slice(0, 3)
        .map((r) => `${r.year} ${r.ganzhi}`)
        .join("、")}）。立春前出生的宝宝仍属上一生肖。`,
    },
  ];

  return (
    <AppShell>
      <BreadcrumbJsonLd
        name={`${surname.han}姓${zodiac.animal}年取名`}
        path={surnameZodiacPath(surname.pinyin, zodiac.slug)}
      />
      {[...boys, ...girls].length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${surname.han}姓${zodiac.animal}年宝宝名字推荐`,
              numberOfItems: boys.length + girls.length,
              itemListElement: [...boys, ...girls].map((n, i) => ({
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

      <PageHeader
        eyebrow={`姓氏×生肖取名 · ${info.branchCn}${zodiac.animal}`}
        title={`${surname.han}姓${zodiac.animal}年宝宝取名`}
        desc={`${info.ganzhi}${zodiac.animal}年（${info.termStart} 立春起）出生的宝宝属${zodiac.animal}。本页按${zodiac.animal}年宜用部首筛出与「${surname.han}」姓搭配的名字，男宝女宝各一组，附拼音、典籍出处原句与意蕴。${info.note}`}
      />

      <div className="mt-7 rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            {info.year} {info.ganzhi}
            {zodiac.animal}年 · 宜用与忌用部首
          </p>
          <Link
            to="/zodiac/$animal"
            params={{ animal: zodiac.slug }}
            className="text-xs text-vermilion-deep transition-colors hover:text-vermilion"
          >
            属{zodiac.animal}取名常青页 →
          </Link>
        </div>
        <div className="mt-3">
          <ZodiacYearHeadline info={info} current={view.current} />
          <ZodiacRadicalChips info={info} />
          <ZodiacTips tips={copy.tips} />
          <ZodiacCharChips chars={preferredChars} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/naming"
          search={{
            x: surname.han,
            prefer: undefined,
            src: undefined,
            g: undefined,
            cat: undefined,
            book: undefined,
          }}
          onClick={() =>
            track("surname_zodiac_cta", { surname: surname.pinyin, zodiac: zodiac.slug })
          }
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          用「{surname.han}」姓 + {zodiac.animal}年宜用部首起名 →
        </Link>
        <Link
          to="/naming"
          search={{
            x: surname.han,
            prefer: undefined,
            src: undefined,
            g: "M",
            cat: undefined,
            book: undefined,
          }}
          className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
        >
          {surname.han}姓男宝取名
        </Link>
        <Link
          to="/naming"
          search={{
            x: surname.han,
            prefer: undefined,
            src: undefined,
            g: "F",
            cat: undefined,
            book: undefined,
          }}
          className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
        >
          {surname.han}姓女宝取名
        </Link>
      </div>

      {boys.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>
            {surname.han}姓{zodiac.animal}年男宝名字推荐
          </h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            用字均命中 {info.preferredRadicals.join("／")} 等宜用部首、未用忌用部首；与「
            {surname.han}」姓的搭配示例仅供参考，完整方案以起名页按生辰现算为准。
          </p>
          <PairedNameCards surname={surname.han} names={boys} />
        </section>
      ) : null}

      {girls.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>
            {surname.han}姓{zodiac.animal}年女宝名字推荐
          </h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            用字均命中 {info.preferredRadicals.join("／")} 等宜用部首、未用忌用部首；与「
            {surname.han}」姓的搭配示例仅供参考，完整方案以起名页按生辰现算为准。
          </p>
          <PairedNameCards surname={surname.han} names={girls} />
        </section>
      ) : null}

      <section className="mt-11">
        <h2 className={sectionTitle}>
          {surname.han}姓{zodiac.animal}年取名常见问题
        </h2>
        <ZodiacFaqList items={faq} />
        <ZodiacNotice />
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>{surname.han}姓的其它生肖取名</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {ZODIAC_SLUGS.filter((z) => z.slug !== zodiac.slug).map((z) => (
            <Link
              key={z.slug}
              to="/names/$surname/$animal"
              params={{ surname: surname.pinyin, animal: z.slug }}
              className={ghostCls}
            >
              {surname.han}姓{z.animal}年取名
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>{zodiac.animal}年的其它姓氏取名</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {TOP_SURNAMES.filter((s) => s.pinyin !== surname.pinyin)
            .slice(0, 10)
            .map((s) => (
              <Link
                key={s.pinyin}
                to="/names/$surname/$animal"
                params={{ surname: s.pinyin, animal: zodiac.slug }}
                className={ghostCls}
              >
                {s.han}姓{zodiac.animal}年取名
              </Link>
            ))}
          <Link to="/names" search={{ zodiac: zodiac.slug }} className={ghostCls}>
            全部属{zodiac.animal}的名字 →
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

/** 名字卡（姓氏×生肖版）：大字带姓氏搭配展示（「王 · 云起」），出处原句与意蕴随卡直出。 */
function PairedNameCards({ surname, names }: { surname: string; names: GalleryName[] }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {names.map((n) => (
        <div
          key={n.word}
          className="rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-seal text-3xl leading-none text-ink">
                <span className="text-ink-soft">{surname} · </span>
                {n.word}
              </p>
              {n.pinyin ? (
                <p className="mt-1.5 text-xs tracking-wider text-ink-soft">{n.pinyin}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {n.gender === "M" ? (
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-paper">
                  男
                </span>
              ) : n.gender === "F" ? (
                <span className="rounded-full bg-vermilion px-2 py-0.5 text-[10px] font-medium text-paper">
                  女
                </span>
              ) : null}
              {typeof n.score === "number" ? (
                <span className="rounded-full bg-vermilion-wash px-2 py-0.5 text-[10px] font-semibold text-vermilion-deep">
                  {n.score} 分
                </span>
              ) : null}
            </div>
          </div>
          {n.meaning ? (
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">{n.meaning}</p>
          ) : null}
          {n.text || n.source ? (
            <div className="mt-3 rounded-xl bg-paper-2 p-3">
              {n.text ? (
                <p className="text-xs leading-relaxed text-ink-soft text-pretty">{n.text}</p>
              ) : null}
              {n.source ? <p className="mt-1 text-[11px] text-ink-faint">—— {n.source}</p> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
