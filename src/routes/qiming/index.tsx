import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PageBrief } from "@/components/page-brief";
import { PLACE_SITE_ORIGIN, QIMING_HUB_CONTENT } from "@/lib/qiming/content";
import { PROVINCES } from "@/lib/qiming/places";
import { namingCtaSearch } from "@/lib/zodiac-guide";

/**
 * 地区取名总入口：全国 31 个省级入口平铺。
 *
 * 这是整套地名页唯一的站内地区入口——省/市/县页之间不互链、不做面包屑，
 * 其余页面靠 sitemap 发现。总入口始终可收录。
 */
export const Route = createFileRoute("/qiming/")({
  component: QimingHubPage,
  head: () => ({
    links: [{ rel: "canonical", href: QIMING_HUB_CONTENT.canonical }],
    meta: [
      { title: QIMING_HUB_CONTENT.title },
      { name: "description", content: QIMING_HUB_CONTENT.description },
      { name: "keywords", content: QIMING_HUB_CONTENT.keywords },
      { property: "og:url", content: QIMING_HUB_CONTENT.canonical },
      { property: "og:title", content: QIMING_HUB_CONTENT.title },
      { property: "og:description", content: QIMING_HUB_CONTENT.description },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  }),
});

function QimingHubPage() {
  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "全国省级地区小孩取名入口",
            numberOfItems: PROVINCES.length,
            itemListElement: PROVINCES.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${p.displayName}小孩取名`,
              url: `${PLACE_SITE_ORIGIN}${p.path}`,
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />

      <PageHeader
        eyebrow="地区取名"
        title={QIMING_HUB_CONTENT.h1}
        desc={QIMING_HUB_CONTENT.description}
      />

      <PageBrief
        summary="本页汇总全国各省级地区的小孩取名入口，每个入口提供选字要点、名字参考与常见问题。"
        points={[
          "按省份进入对应的小孩取名页，省/市/县入口都从同一套通用方法展开。",
          "选字先看读音、字义、书写和姓氏连读，再看生肖等可选参考。",
          "名字参考来自名字灵感库，评分为字库内部参考，不代表运势判断。",
        ]}
        links={[
          { label: "名字灵感库", to: "/names" },
          { label: "生肖取名", to: "/zodiac" },
          { label: "开始取名", to: "/naming" },
        ]}
        canonical={QIMING_HUB_CONTENT.canonical}
      />

      <section className="mt-11">
        <h2 className="text-lg font-semibold">按省份查找</h2>
        <p className="mt-1.5 text-xs text-ink-faint">共 31 个省级入口，点击进入对应取名页。</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PROVINCES.map((p) => (
            <Link
              key={p.slug}
              to="/qiming/$province"
              params={{ province: p.slug }}
              className="flex items-baseline justify-between rounded-2xl bg-white px-4 py-3 transition-colors hover:bg-vermilion-wash"
            >
              <span className="text-sm font-medium text-ink">{p.displayName}</span>
              <span className="text-xs text-vermilion-deep">查看 →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-11">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/naming"
            search={namingCtaSearch("qiming")}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            直接开始取名 →
          </Link>
          <Link
            to="/names"
            search={{ keyword: undefined }}
            className="rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash"
          >
            浏览名字灵感库 →
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          名字与读音建议为姓名文化参考，不构成任何预测或判断；户籍用字以公安户籍窗口为准。
        </p>
      </section>
    </AppShell>
  );
}
