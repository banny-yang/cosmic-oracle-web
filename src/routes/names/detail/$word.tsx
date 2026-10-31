import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import { get } from "@/lib/api";
import { sourceToCategory, categoryToExpectation } from "@/lib/gallery-signals";
import { SEAL_FONT_PRELOAD } from "@/lib/head-links";
import { nameDetailPath } from "@/lib/name-detail";
import { TOP_SURNAMES, currentZodiacSlug } from "@/lib/surnames";
import { track } from "@/lib/track";

/**
 * 单个好名字的详情页：/names/detail/{名字}（如 /names/detail/明远）。
 *
 * 灵感库卡片上每个名字都能单独成一页：出处原句、逐字画像（拼音/声调/康熙笔画/部首/五行）、
 * 平仄与适合的姓氏。内容全部来自后端 NameDetailService，前端不补字义（避免臆造）。
 * 只对字段齐全的词条出页（后端 found=false → 404），缺字段的条目在这里就是 404，
 * 不会以薄内容进索引。接口暂不可用时渲染兜底页并 noindex，不把网络抖动写成 404。
 */
export const Route = createFileRoute("/names/detail/$word")({
  component: NameDetailPage,
  loader: async ({ params }) => {
    const word = (params.word ?? "").trim();
    if (!word) throw notFound();
    const detail = await get<NameDetailView>(
      "/api/v1/naming/name-detail",
      { word },
      { auth: false, timeoutMs: 10000 },
    ).catch(() => null);
    // 词条不存在或字段不全：真 404（不是服务抖动，抖动的分支走 detail=null 的兜底页）
    if (detail && !detail.found) throw notFound();
    return { detail, word };
  },
  head: ({ loaderData }) => {
    const word = loaderData?.word ?? "";
    const d = loaderData?.detail ?? null;
    const canonical = `https://name.duimai.net${nameDetailPath(word)}`;
    const title = d
      ? `${word}这个名字怎么样：出处、字义与适合的姓氏 · 对脉名鉴`
      : `${word} · 好名字详情 · 对脉名鉴`;
    const desc = d
      ? `「${word}」（${d.pinyin}）出自${d.source}「${d.quote}」，意为${trimSentence(d.meaning)}。本页给出逐字拼音、康熙笔画、部首与五行，以及与该名字连读较稳的常见姓氏。`
      : "好名字详情：出处原句、字义、逐字画像与适合的姓氏。";
    return {
      links: [{ rel: "canonical", href: canonical }, SEAL_FONT_PRELOAD],
      meta: [
        { title },
        { name: "description", content: desc },
        // 接口未就绪的兜底页不进索引；条目本身不存在时 loader 已抛 404
        ...(d ? [] : [{ name: "robots", content: "noindex" }]),
        {
          name: "keywords",
          content: d
            ? `${word},${word}的意思,${word}的寓意,${word}出自哪里,${word}适合什么姓,${d.source ?? ""}取名`
            : `${word},好名字,名字出处`,
        },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

interface DetailChar {
  char: string;
  pinyin: string;
  tone: number | null;
  toneZh: string;
  strokes: number | null;
  radical: string;
  element: string;
  elementZh: string;
}

interface DetailRelated {
  word: string;
  pinyin?: string | null;
  score?: number | null;
  category?: string | null;
}

export interface NameDetailView {
  found: boolean;
  word?: string;
  pinyin?: string | null;
  gender?: string | null;
  genderZh?: string;
  score?: number | null;
  category?: string | null;
  source?: string | null;
  quote?: string | null;
  meaning?: string | null;
  elements?: { code: string; zh: string }[];
  chars?: DetailChar[];
  /** 平仄串（平/仄逐字），缺声调时为空串。 */
  pingze?: string;
  surnames?: string[];
  related?: DetailRelated[];
  updatedAt?: string;
}

const sectionTitle = "text-lg font-semibold";
const cardCls = "rounded-2xl bg-white p-5";

/** 去掉句末标点，便于把意蕴嵌进长句（避免「意为……。。」）。 */
function trimSentence(s?: string | null): string {
  const t = (s ?? "").trim();
  return t.replace(/[。！？!?；;，,]+$/u, "");
}

/** 平仄读出人话：平仄相间 / 全平 / 全仄。 */
function pingzeNote(pingze: string): string {
  if (!pingze) return "";
  const hasPing = pingze.includes("平");
  const hasZe = pingze.includes("仄");
  if (hasPing && hasZe) {
    return "平声（阴平、阳平）与仄声（上声、去声）交替，连读起伏清楚，不容易听混。";
  }
  if (hasPing) {
    return "两字都是平声，读起来舒展平顺；若介意单薄，可在姓氏或辈分字上配一个仄声字。";
  }
  return "两字都是仄声，读音短促有力；若担心连读偏硬，可配一个平声的姓氏或辈分字。";
}

function NameDetailPage() {
  const { detail } = Route.useLoaderData() as { detail: NameDetailView | null; word: string };

  if (!detail) {
    return (
      <AppShell>
        <PageHeader eyebrow="好名字详情" title="这个名字的资料暂时没加载出来" />
        <div className="mt-8 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="text-sm text-ink-soft">
            数据服务未就绪或请求超时，稍后刷新试试；也可以直接去灵感库按风格找名字。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/names"
              className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              去名字灵感库 →
            </Link>
            <Link
              to="/naming"
              search={{
                prefer: undefined,
                x: undefined,
                src: undefined,
                g: undefined,
                cat: undefined,
                book: undefined,
              }}
              className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
            >
              直接起名 →
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const word = detail.word ?? "";
  const pinyin = detail.pinyin ?? "";
  const source = detail.source ?? "";
  const quote = detail.quote ?? "";
  const meaning = detail.meaning ?? "";
  const chars = detail.chars ?? [];
  const pingze = detail.pingze ?? "";
  const surnames = detail.surnames ?? [];
  const related = detail.related ?? [];
  const elements = detail.elements ?? [];
  const genderZh = detail.genderZh ?? "";
  const styleCategory = categoryToExpectation(detail.category) ? (detail.category ?? undefined) : undefined;
  const preferSrc = sourceToCategory(source);
  /** 姓氏入口落到当前生肖年的该姓取名页（与 /names 的入口同口径）。 */
  const zodiacSlug = currentZodiacSlug();

  /** 起名页深链：带上「这个姓 + 这个名字的风格」。 */
  const namingSearch = (surnameHan?: string) => ({
    x: surnameHan,
    prefer: word,
    src: preferSrc,
    g: detail.gender === "M" || detail.gender === "F" ? detail.gender : undefined,
    cat: styleCategory,
    book: undefined,
  });

  // 现算问答（可见列表与 FAQPage 结构化数据共用同一数组，内容天然一致）
  const faq = [
    {
      q: `${word}有什么寓意？`,
      a: `${meaning}用字与出处的搭配，是这个名字被收录的主要原因：字义清楚、原句可查，不是凭空拼字。`,
    },
    {
      q: `${word}出自哪里？`,
      a: `出自${source}「${quote}」。本页把原句与书名一并列出，便于回到原文核对语境；取名时建议连原句一起读一遍，确认语义与用法没有断章。`,
    },
    ...(pingze
      ? [
          {
            q: `${word}怎么读？平仄如何？`,
            a: `读作 ${pinyin}。按普通话四声，逐字平仄为「${pingze}」：${pingzeNote(pingze)}`,
          },
        ]
      : []),
    {
      q: `${word}适合什么姓氏？`,
      a: surnames.length
        ? `与「${surnames.join("」「")}」等 ${surnames.length} 个常见姓氏连读较稳。判定时剔除了名字含姓氏本字、首字读音撞该姓口语谐音（如吴伟→无为）、以及该姓通用避字的情况。常见姓氏远不止这些，其余姓氏可在起名页按生辰现算。`
        : `在 50 个常见姓氏里没有特别需要回避的组合；具体搭配仍建议按生辰、辈分字与方言读音在起名页现算。`,
    },
    ...(genderZh
      ? [
          {
            q: `${word}是${genderZh}宝名字吗？`,
            a: `语料里「${word}」多用于${genderZh}宝名字，但用字本身并不排他；性别只是语料中的使用倾向，最终按字义与家庭偏好取舍。`,
          },
        ]
      : []),
  ];

  return (
    <AppShell>
      <BreadcrumbJsonLd name={`好名字 · ${word}`} path={nameDetailPath(word)} />
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
        eyebrow={`好名字 · ${[detail.category, genderZh ? `${genderZh}宝` : "", typeof detail.score === "number" ? `${detail.score} 分` : ""]
          .filter(Boolean)
          .join(" · ")}`}
        title={word}
        desc={meaning}
      />

      {/* 可摘录结论（GEO）：一段话说清这个名字好在哪，AI 抓取后可直接引用并带链接 */}
      <section className="mt-6 rounded-2xl bg-vermilion-wash p-5">
        <p className="text-[11px] font-semibold tracking-wide text-vermilion-deep">
          本页结论 · 可直接引用
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink text-pretty">
          「{word}」读作 {pinyin}，出自{source}「{quote}」，意为{trimSentence(meaning)}。
          {pingze ? `逐字平仄为「${pingze}」，${pingzeNote(pingze)}` : ""}
          {surnames.length
            ? `与「${surnames.slice(0, 6).join("」「")}」等姓氏连读较稳。`
            : "常见姓氏里没有特别需要回避的组合。"}
        </p>
        {elements.length > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">
            用字五行：
            {elements
              .map((e) => e.zh)
              .filter(Boolean)
              .join("、")}
            。
          </p>
        ) : null}
        <p className="mt-1.5 break-all text-xs text-ink-faint">
          引用时请保留本页链接：https://name.duimai.net{nameDetailPath(word)}
        </p>
      </section>

      {/* 出处与字义 */}
      <section className={`mt-6 ${cardCls}`}>
        <h2 className={sectionTitle}>出处与字义</h2>
        <div className="mt-3 rounded-xl bg-paper-2 p-4">
          <p className="text-sm leading-relaxed text-ink text-pretty">「{quote}」</p>
          <p className="mt-1.5 text-xs text-ink-faint">—— {source}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft text-pretty">{meaning}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.category ? (
            <span className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs text-ink-soft">
              风格 · {detail.category}
            </span>
          ) : null}
          {elements.map((e) =>
            e.zh ? (
              <span
                key={e.code}
                className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs text-ink-soft"
              >
                五行 · {e.zh}
              </span>
            ) : null,
          )}
          {pingze ? (
            <span className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs text-ink-soft">
              平仄 · {pingze}
            </span>
          ) : null}
        </div>
      </section>

      {/* 逐字画像 */}
      {chars.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>逐字解读</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            拼音与声调按普通话读法，笔画按康熙字典笔画（与五格数理口径一致）。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {chars.map((c) => (
              <div key={c.char} className={cardCls}>
                <div className="flex items-baseline gap-3">
                  <span className="font-seal text-4xl leading-none text-ink">{c.char}</span>
                  <span className="text-xs tracking-wider text-ink-soft">
                    {c.pinyin}
                    {c.toneZh ? ` · ${c.toneZh}` : ""}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeof c.strokes === "number" ? (
                    <span className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs text-ink-soft">
                      康熙 {c.strokes} 画
                    </span>
                  ) : null}
                  {c.radical ? (
                    <span className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs text-ink-soft">
                      部首 {c.radical}
                    </span>
                  ) : null}
                  {c.elementZh ? (
                    <span className="rounded-full bg-vermilion-wash px-2.5 py-0.5 text-[11px] text-vermilion-deep">
                      五行 {c.elementZh}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 适合的姓氏 */}
      {surnames.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>适合的姓氏</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            已排除名字含姓氏本字、首字读音撞该姓口语谐音、以及该姓通用避字的组合；点姓氏看该姓的取名页。
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {surnames.map((han) => {
              const s = TOP_SURNAMES.find((t) => t.han === han);
              return s ? (
                <Link
                  key={han}
                  to="/names/$surname/$animal"
                  params={{ surname: s.pinyin, animal: zodiacSlug }}
                  className="rounded-xl bg-paper-3 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
                >
                  {han}姓取名
                </Link>
              ) : (
                <span
                  key={han}
                  className="rounded-xl bg-paper-3 px-4 py-2 text-sm font-medium text-ink"
                >
                  {han}姓
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint text-pretty">
            姓氏与名字的搭配还要看方言读音与辈分字，上表只按普通话连读判定。
          </p>
        </section>
      ) : null}

      {/* 相关名字 */}
      {related.length > 0 ? (
        <section className="mt-11">
          <h2 className={sectionTitle}>同字或同风格的名字</h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            与「{word}」共用首字或尾字、且出处齐全的候选，按评分排序。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.word}
                to="/names/detail/$word"
                params={{ word: r.word }}
                className="rounded-2xl bg-white p-4 transition-colors hover:bg-vermilion-wash"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-seal text-2xl leading-none text-ink">{r.word}</span>
                  {typeof r.score === "number" ? (
                    <span className="rounded-full bg-vermilion-wash px-2 py-0.5 text-[11px] font-semibold text-vermilion-deep">
                      {r.score} 分
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {[r.pinyin, r.category].filter(Boolean).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 起名 CTA */}
      <section className="mt-11 rounded-2xl bg-white p-6">
        <h2 className={sectionTitle}>用「{word}」的风格起名</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft text-pretty">
          起名页会带上这个名字的偏好字、出处类目与性别倾向，再按姓氏与生辰现算：
          真太阳时校正、喜用五行、五格数理与谐音检查，给出完整 10 个方案；首次可免费看 3 个精选名。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/naming"
            search={namingSearch()}
            onClick={() => track("name_detail_cta", { word })}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            按这个风格生成名字 →
          </Link>
          <Link
            to="/name-eval"
            search={{ x: undefined, m: word, src: undefined }}
            className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
          >
            已有名字？测评一下
          </Link>
        </div>
      </section>

      {/* 常见问题 */}
      <section className="mt-11">
        <h2 className={sectionTitle}>常见问题</h2>
        <div className="mt-4 space-y-3">
          {faq.map((f) => (
            <div key={f.q} className={cardCls}>
              <p className="text-sm font-semibold">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft text-pretty">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">
          本页内容为姓名文化与传统典籍整理，供取名参考，不构成吉凶判断；具体搭配请结合字音、字义、书写与方言读音综合取舍。
        </p>
        {detail.updatedAt ? (
          <p className="mt-2 text-xs text-ink-faint">本页内容更新于 {detail.updatedAt}。</p>
        ) : null}
        <p className="mt-2 text-xs text-ink-faint">
          按风格继续找：
          <Link
            to="/names"
            search={{ keyword: word }}
            className="ml-1 text-vermilion-deep transition-colors hover:text-vermilion"
          >
            灵感库里与「{word}」相关的名字 →
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
