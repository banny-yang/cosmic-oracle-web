/**
 * /feed.xml 动态输出（RSS 2.0）：深度洞察最新 20 篇。
 *
 * 由 server.ts 在进入 SSR 前拦截；文章接口不可用或超时（5s）时输出空 channel
 * ——feed 绝不 5xx。聚合器与 AI 内容管道经此发现新文章。
 */
import { fetchPublishedArticles } from "./llms-content";

interface FeedArticleRow {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string | null;
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function itemXml(a: FeedArticleRow): string {
  const url = `https://name.duimai.net/articles/${a.slug}`;
  const pubDate = a.publishedAt ? new Date(a.publishedAt).toUTCString() : "";
  return [
    "    <item>",
    `      <title>${esc(a.title)}</title>`,
    `      <link>${url}</link>`,
    `      <guid isPermaLink="true">${url}</guid>`,
    ...(pubDate ? [`      <pubDate>${pubDate}</pubDate>`] : []),
    `      <description>${esc(a.summary)}</description>`,
    "    </item>",
  ].join("\n");
}

export async function feedXml(): Promise<string> {
  const rows = (await fetchPublishedArticles(20)) as FeedArticleRow[];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>对脉名鉴 · 深度洞察</title>",
    "    <link>https://name.duimai.net/articles</link>",
    "    <description>生肖宜忌、字辈传承、诗词典籍出处、五行用字、双胞胎取名等中长文，全文见各文章页</description>",
    "    <language>zh-cn</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ...rows.map(itemXml),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
