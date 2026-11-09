/**
 * /sitemap.xml 动态输出：静态条目 + 地名/长尾矩阵条目（各自过运行时放量闸）+
 * 名字详情页（闸门 500 条）+ 已发布文章（lastmod 取更新时间）。
 *
 * 由 server.ts 在进入 SSR 前拦截（public/sitemap.xml 已移除，无静态优先级冲突）；
 * 接口不可用或超时（5s）时回落纯静态清单——sitemap 绝不 5xx，
 * 收录链路（push-baidu cron 从线上 sitemap 拉新 URL）不空转。
 *
 * 名字详情页先只放 500 条（后端按评分降序截断，且只含字段齐全的词条）：
 * 结构相同的页面一次性铺开容易被判薄内容，先看 2–4 周收录率再放量。
 */
import { nameDetailPath } from "./name-detail";
import { isPlaceIndexable } from "./qiming/rollout";
import { getPlaceRolloutStage } from "./qiming/rollout-runtime";
import { runtimeApiBaseUrl } from "./runtime-env";
import { CLASSIC_CATEGORIES, SURNAME_PLACE_HOSTS, WUXING_ELEMENTS } from "./seo/longtail";
import { getLongtailStages } from "./seo/rollout-runtime";
import type { LongtailStages } from "./seo/rollout";
import { STATIC_SITEMAP, type SitemapEntry } from "./sitemap-static";
import { TOP_SURNAMES, ZODIAC_SLUGS } from "./surnames";
import placeSitemap from "../data/places/sitemap.json";

/** sitemap 里名字详情页的条数上限（放量前先过收录闸门）。 */
const NAME_DETAIL_SITEMAP_LIMIT = 500;

/** 长尾矩阵新页面的 lastmod（上线日期，后续可按矩阵维护）。 */
const LONGTAIL_LASTMOD = "2026-11-07";

const ORIGIN = "https://name.duimai.net";

/** 地名页条目：与页面 head 的 noindex、百度推送共用运行时放量批次，未放量批次不进 sitemap。 */
function placeSitemapEntries(stage: number): SitemapEntry[] {
  return (placeSitemap as { loc: string; lastmod: string; group: number }[])
    .filter((p) => isPlaceIndexable(p.group, stage))
    .map((p) => ({ loc: p.loc, lastmod: p.lastmod, changefreq: "monthly" }));
}

/** 姓氏单页（50 条）：longtail.surname.stage=1 时进 sitemap。 */
function surnameEntries(stages: LongtailStages): SitemapEntry[] {
  if (stages.surname !== 1) return [];
  return TOP_SURNAMES.map((s) => ({
    loc: `${ORIGIN}/names/${s.pinyin}`,
    lastmod: LONGTAIL_LASTMOD,
    changefreq: "monthly",
  }));
}

/** 典籍类目页（18 条 + 入口 1 条）：longtail.classic.stage=1 时进 sitemap。 */
function classicEntries(stages: LongtailStages): SitemapEntry[] {
  if (stages.classic !== 1) return [];
  return [
    { loc: `${ORIGIN}/classic`, lastmod: LONGTAIL_LASTMOD, changefreq: "monthly" },
    ...CLASSIC_CATEGORIES.map((c) => ({
      loc: `${ORIGIN}/classic/${c.code}`,
      lastmod: LONGTAIL_LASTMOD,
      changefreq: "monthly",
    })),
  ];
}

/**
 * 城市×姓氏页（58 宿主 × 放开的大姓数）：宿主限定为省会/直辖市入口
 * （capitals.json 的 58 条，与地名第 1 批一致），姓氏按放开档位截断；
 * head 侧同口径判定见 isSurnamePlaceIndexable。
 */
function surnamePlaceEntries(stages: LongtailStages): SitemapEntry[] {
  if (stages.surnamePlace <= 0) return [];
  const released = TOP_SURNAMES.slice(0, stages.surnamePlace);
  return SURNAME_PLACE_HOSTS.flatMap((host) =>
    released.map((s) => ({
      loc: `${ORIGIN}${host.path}/${s.pinyin}`,
      lastmod: LONGTAIL_LASTMOD,
      changefreq: "monthly",
    })),
  );
}

/** 五行用字页（5 条 + 入口 1 条）：longtail.wuxing.stage=1 时进 sitemap。 */
function wuxingEntries(stages: LongtailStages): SitemapEntry[] {
  if (stages.wuxing !== 1) return [];
  return [
    { loc: `${ORIGIN}/wuxing`, lastmod: LONGTAIL_LASTMOD, changefreq: "monthly" },
    ...WUXING_ELEMENTS.map((e) => ({
      loc: `${ORIGIN}/wuxing/${e.slug}`,
      lastmod: LONGTAIL_LASTMOD,
      changefreq: "monthly",
    })),
  ];
}

/** 生肖×性别页（24 条）：longtail.zodiac-gender.stage=1 时进 sitemap。 */
function zodiacGenderEntries(stages: LongtailStages): SitemapEntry[] {
  if (stages.zodiacGender !== 1) return [];
  return ZODIAC_SLUGS.flatMap((z) => [
    { loc: `${ORIGIN}/zodiac/${z.slug}/boy`, lastmod: LONGTAIL_LASTMOD, changefreq: "monthly" },
    { loc: `${ORIGIN}/zodiac/${z.slug}/girl`, lastmod: LONGTAIL_LASTMOD, changefreq: "monthly" },
  ]);
}

/** 姓氏×生肖取名长尾页（50 姓 × 12 生肖 = 600 条，SSR 动态渲染，路由校验同源常量）。 */
const SURNAME_ZODIAC_SITEMAP: SitemapEntry[] = TOP_SURNAMES.flatMap((s) =>
  ZODIAC_SLUGS.map((z) => ({
    loc: `https://name.duimai.net/names/${s.pinyin}/${z.slug}`,
    // 2026-11-09 修复：此前渲染成姓氏父页，600 条正文全部重写，需让引擎重抓
    lastmod: "2026-11-09",
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
  const [details, articles, placeStage, longtailStages] = await Promise.all([
    fetchNameDetailEntries(),
    fetchArticleEntries(),
    getPlaceRolloutStage(),
    getLongtailStages(),
  ]);
  const entries = [
    ...STATIC_SITEMAP,
    ...placeSitemapEntries(placeStage),
    ...SURNAME_ZODIAC_SITEMAP,
    ...surnameEntries(longtailStages),
    ...classicEntries(longtailStages),
    ...surnamePlaceEntries(longtailStages),
    ...wuxingEntries(longtailStages),
    ...zodiacGenderEntries(longtailStages),
    ...details,
    ...articles,
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entryXml),
    "</urlset>",
    "",
  ].join("\n");
}
