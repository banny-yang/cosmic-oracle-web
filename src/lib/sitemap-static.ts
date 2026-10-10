/**
 * sitemap 静态条目（2026-10 收录口径：核心功能页 + 生肖常青页 + 12 个窗口年份页）。
 * /sitemap.xml 由 server.ts 动态输出：静态条目 + 已发布文章（/api/v1/articles/sitemap），
 * 文章接口不可用时回落纯静态清单——收录链路绝不空转。
 */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
}

export const STATIC_SITEMAP: SitemapEntry[] = [
  { loc: "https://name.duimai.net/", lastmod: "2026-09-25", changefreq: "weekly" },
  { loc: "https://name.duimai.net/naming", lastmod: "2026-09-25", changefreq: "weekly" },
  { loc: "https://name.duimai.net/name-eval", lastmod: "2026-09-25", changefreq: "weekly" },
  { loc: "https://name.duimai.net/dianji", lastmod: "2026-09-25", changefreq: "weekly" },
  { loc: "https://name.duimai.net/zodiac", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/shu", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/niu", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/hu", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/tu", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/long", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/she", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/ma", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/yang", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/hou", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/ji", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/gou", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/zhu", lastmod: "2026-09-25", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/hou/2016", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/ji/2017", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/gou/2018", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/zhu/2019", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/shu/2020", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/niu/2021", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/hu/2022", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/tu/2023", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/long/2024", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/she/2025", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/ma/2026", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/zodiac/yang/2027", lastmod: "2026-10-10", changefreq: "monthly" },
  { loc: "https://name.duimai.net/analysis", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/personality", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/marriage", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/liuyao", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/qimen", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/names", lastmod: "2026-09-25", changefreq: "daily" },
  { loc: "https://name.duimai.net/privacy", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/terms", lastmod: "2026-09-20", changefreq: "weekly" },
  { loc: "https://name.duimai.net/help", lastmod: "2026-09-20", changefreq: "weekly" },
];
