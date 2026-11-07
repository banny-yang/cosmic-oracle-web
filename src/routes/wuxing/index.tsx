import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, BreadcrumbJsonLd } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { LinkChips, ghostCls, sectionTitle } from "@/components/seo/longtail-blocks";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import { WUXING_ELEMENTS } from "@/lib/seo/longtail";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 五行用字入口页：/wuxing。五行属字口径来自字库（t_char_profile 的部首/笔画/五行），
 * 是 5 个 /wuxing/{slug} 元素页的唯一站内入口。
 * 放量由 longtail.wuxing.stage 控制（0=整矩阵 noindex，含本页）。
 */
export const Route = createFileRoute("/wuxing/")({
  component: WuxingHubPage,
  loader: async () => {
    const stages = await getLongtailStages();
    return { stages };
  },
  head: ({ loaderData }) => {
    const stages = loaderData?.stages;
    const canonical = "https://name.duimai.net/wuxing";
    const title = "五行取名：属金木水火土的取名字 · 对脉名鉴";
    const desc =
      "按五行查取名字：金、木、水、火、土各属的常见用字（附拼音、康熙笔画与部首）与名字参考。五行口径为传统姓名文化参考。";
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        ...(!stages || stages.wuxing !== 1 ? [{ name: "robots", content: "noindex, follow" }] : []),
        { name: "keywords", content: "五行取名,五行属水的字,五行属木的字,康熙笔画,取名字" },
        { property: "og:url", content: canonical },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
      ],
    };
  },
});

function WuxingHubPage() {
  const canonical = "https://name.duimai.net/wuxing";

  return (
    <AppShell>
      <BreadcrumbJsonLd name="五行取名" path="/wuxing" />
      <PageHeader
        eyebrow="五行取名"
        title="五行取名"
        desc="按传统五行口径整理各属性常见用字：字形部首与康熙笔画为准，附名字参考。五行补益是传统姓名文化参考，不是命理判断。"
      />

      <PageBrief
        summary="五行取名按金、木、水、火、土五类整理适名用字：字的属性以部首与康熙笔画口径归类，本站字库逐字标注，每个元素页给出用字表与名字参考。"
        points={[
          "字的五行以部首优先（氵属水、木旁属木），无部首线索的按康熙笔画尾数归类。",
          "五行补益讲「缺什么看什么」，但更基础的是读音、字义与姓氏连读。",
          "本页所有字的拼音、笔画、部首来自站内字库，名字均标注出处。",
        ]}
        links={[
          { label: "名字灵感库", to: "/names" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={canonical}
      />

      <section className="mt-11">
        <h2 className={sectionTitle}>按五行属性查用字</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {WUXING_ELEMENTS.map((el) => (
            <Link
              key={el.slug}
              to="/wuxing/$element"
              params={{ element: el.slug }}
              className="rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
            >
              <p className="text-base font-semibold text-ink">五行属{el.han}的字取名</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{el.intro}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-11">
        <h2 className={sectionTitle}>继续浏览</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/names" className={ghostCls}>
            名字灵感库 →
          </Link>
          <Link to="/naming" search={namingCtaSearch("wuxing_hub")} className={ghostCls}>
            开始取名 →
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">
          五行用字属姓名文化参考，不构成吉凶判断；户籍用字以《通用规范汉字表》和公安户籍窗口为准。
        </p>
      </section>
    </AppShell>
  );
}
