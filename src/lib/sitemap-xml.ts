/**
 * /sitemap.xml 动态输出：静态条目 + 已发布文章（lastmod 取文章更新时间）。
 *
 * 由 server.ts 在进入 SSR 前拦截（public/sitemap.xml 已移除，无静态优先级冲突）；
 * 文章接口不可用或超时（5s）时回落纯静态清单——sitemap 绝不 5xx，
 * 收录链路（push-baidu cron 从线上 sitemap 拉新 URL）不空转。
 */
import { runtimeApiBaseUrl } from "./runtime-env";
import { STATIC_SITEMAP, type SitemapEntry } from "./sitemap-static";

interface ArticleSitemapRow {
  slug: string;
  updatedAt: string | null;
}

async function fetchArticleEntries(): Promise<SitemapEntry[]> {
  const base = runtimeApiBaseUrl() || import.meta.env["VITE_API_BASE_URL"] || "";
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
    return [];   // 接口不可用：回落静态清单
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
  const articles = await fetchArticleEntries();
  const entries = [...STATIC_SITEMAP, ...articles];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entryXml),
    "</urlset>",
    "",
  ].join("\n");
}
