/**
 * 文章栏目（公开接口 GET /api/v1/articles）。SSR 首屏直出（搜索引擎/AI 引擎
 * 不执行 JS 也能读全文）；接口不可用时页面走兜底提示 + noindex，不当 404。
 */
import { ApiError, get } from "@/lib/api";

export const ARTICLE_CATEGORIES = [
  { key: "zodiac", label: "生肖取名" },
  { key: "generation", label: "字辈传承" },
  { key: "poems", label: "诗词典籍" },
  { key: "wuxing", label: "五行用字" },
  { key: "twins", label: "双胞胎" },
  { key: "tips", label: "取名避坑" },
  { key: "general", label: "综合" },
] as const;

export function articleCategoryLabel(key: string): string {
  return ARTICLE_CATEGORIES.find((c) => c.key === key)?.label ?? "综合";
}

export interface ArticleSummary {
  slug: string;
  title: string;
  summary: string;
  category: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ArticleDetail extends ArticleSummary {
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ArticlePage {
  items: ArticleSummary[];
  total: number;
  page: number;
  size: number;
}

export function articlePath(slug: string): string {
  return `/articles/${slug}`;
}

export async function fetchArticles(opts: {
  category?: string;
  page?: number;
  size?: number;
}): Promise<ArticlePage | null> {
  const clean = (opts.category ?? "").trim();
  return get<ArticlePage>(
    "/api/v1/articles",
    {
      category: clean || undefined,
      page: opts.page ?? 0,
      size: opts.size ?? 12,
    },
    { auth: false, timeoutMs: 12000 },
  ).catch(() => null);
}

export interface ArticleLookup {
  article: ArticleDetail | null;
  /** true = 服务端明确拒绝（未发布/下线）→ 调用方 404；false = 接口不可用 → 兜底页。 */
  invalid: boolean;
}

export async function lookupArticle(slug: string): Promise<ArticleLookup> {
  try {
    const article = await get<ArticleDetail>(
      `/api/v1/articles/${encodeURIComponent(slug)}`,
      {},
      { auth: false, timeoutMs: 12000 },
    );
    return { article, invalid: false };
  } catch (e) {
    return {
      article: null,
      invalid: e instanceof ApiError && (e.statusCode === 404 || e.statusCode === 400),
    };
  }
}
