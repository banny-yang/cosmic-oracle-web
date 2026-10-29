/**
 * /sitemap.xml 动态输出：静态条目 + 名字详情页（闸门 200 条）+ 已发布文章（lastmod 取更新时间）。
 *
 * 由 server.ts 在进入 SSR 前拦截（public/sitemap.xml 已移除，无静态优先级冲突）；
 * 接口不可用或超时（5s）时回落纯静态清单——sitemap 绝不 5xx，
 * 收录链路（push-baidu cron 从线上 sitemap 拉新 URL）不空转。
 *
 * 名字详情页先只放 200 条（后端按评分降序截断，且只含字段齐全的词条）：
 * 一次性铺几千个结构相同的页面容易被判薄内容，先看 2–4 周收录率再放量。
 */
import { nameDetailPath } from "./name-detail";
import { runtimeApiBaseUrl } from "./runtime-env";
import { STATIC_SITEMAP, type SitemapEntry } from "./sitemap-static";
import { TOP_SURNAMES, ZODIAC_SLUGS } from "./surnames";

/** sitemap 里名字详情页的条数上限（放量前先过收录闸门）。 */
const NAME_DETAIL_SITEMAP_LIMIT = 200;

/** 姓氏×生肖取名长尾页（50 姓 × 12 生肖 = 600 条，SSR 动态渲染，路由校验同源常量）。 */
const SURNAME_ZODIAC_SITEMAP: SitemapEntry[] = TOP_SURNAMES.flatMap((s) =>
  ZODIAC_SLUGS.map((z) => ({
    loc: `https://name.duimai.net/names/${s.pinyin}/${z.slug}`,
    lastmod: "2026-10-22",
    changefreq: "monthly",
  })),
);

interface ArticleSitemapRow {
  slug: string;
  updatedAt: string | null;
}

interface NameDetailSitemapRow {
  word: string;
  updatedAt: string | null;
}

function apiBase(): string {
  return runtimeApiBaseUrl() || import.meta.env["VITE_API_BASE_URL"] || "";
}

/** 名字详情页：后端只返回可出页（字段齐全）的词条，按评分降序前 N 条。 */
async function fetchNameDetailEntries(): Promise<SitemapEntry[]> {
  const base = apiBase();
  if (!base) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `${base}/api/v1/naming/name-detail/index?limit=${NAME_DETAIL_SITEMAP_LIMIT}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: NameDetailSitemapRow[] | null };
    return (body.items ?? [])
      .filter((i) => i.word)
      .map((i) => {
        const lastmod = (i.updatedAt ?? "").slice(0, 10);
        return {
          loc: `https://name.duimai.net${nameDetailPath(i.word)}`,
          ...(lastmod ? { lastmod } : {}),
          changefreq: "monthly",
        };
      });
  } catch {
    return []; // 接口不可用：本轮不出详情页条目，静态清单照常
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleEntries(): Promise<SitemapEntry[]> {
  const base = apiBase();
  if (!base) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/api/v1/articles/sitemap`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { articles?: ArticleSitemapRow[] | null };
    return (body.articles ?? []).map((a) => {
      const lastmod = (a.updatedAt ?? "").slice(0, 10);
      return {
        loc: `https://name.duimai.net/articles/${a.slug}`,
        ...(lastmod ? { lastmod } : {}),
        changefreq: "monthly",
      };
    });
  } catch {
    return []; // 接口不可用：回落静态清单
  } finally {
    clearTimeout(timer);
  }
}

function entryXml(e: SitemapEntry): string {
  const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : "";
  const changefreq = e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : "";
  return `  <url><loc>${e.loc}</loc>${lastmod}${changefreq}</url>`;
}

export async function sitemapXml(): Promise<string> {
  const [details, articles] = await Promise.all([fetchNameDetailEntries(), fetchArticleEntries()]);
  const entries = [...STATIC_SITEMAP, ...SURNAME_ZODIAC_SITEMAP, ...details, ...articles];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entryXml),
    "</urlset>",
    "",
  ].join("\n");
}
