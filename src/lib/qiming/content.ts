/**
 * 地名页的标题/描述/关键词口径。
 *
 * 地名只进元数据与 H1：title/description 都是「{地名}小孩取名」的长尾写法，
 * 正文由通用文案 + 真实名字参考构成（见 components/qiming/place-page-view.tsx）。
 * canonical 硬编码正式域名，和站内其他程序化页面保持一致。
 */
import type { PlaceInfo } from "./places";
import { isPlaceIndexable } from "./rollout";

export const PLACE_SITE_ORIGIN = "https://name.duimai.net";

export interface PlaceContent {
  h1: string;
  title: string;
  description: string;
  keywords: string;
  canonical: string;
}

export function buildPlaceContent(place: PlaceInfo): PlaceContent {
  const name = place.displayName;
  return {
    h1: `${name}小孩取名`,
    title: `${name}小孩取名：宝宝取名选字要点与名字参考 · 对脉名鉴`,
    description: `${name}小孩取名怎么选字？从读音、字义、书写和姓氏连读入手，附男宝女宝名字参考、出处与常见问题。`,
    keywords: `${name}小孩取名,${name}宝宝取名,${name}取名,${name}起名,小孩取名,宝宝取名`,
    canonical: `${PLACE_SITE_ORIGIN}${place.path}`,
  };
}

/** 总入口 /qiming 的元数据（始终可收录）。 */
export const QIMING_HUB_CONTENT = {
  h1: "全国小孩取名",
  title: "全国小孩取名：各省地区取名入口 · 对脉名鉴",
  description: "按省份查找小孩取名页：选字要点、名字参考与常见问题。",
  keywords: "全国小孩取名,各省小孩取名,宝宝取名,小孩取名,取名选字",
  canonical: `${PLACE_SITE_ORIGIN}/qiming`,
} as const;

/**
 * 地名页的 head：title/description/keywords/canonical 带地名，未放量批次加 noindex, follow。
 * canonical 始终指向自己——未放量页面也保留规范地址，放量后无需改页面。
 */
export function placeHead(place: PlaceInfo | null | undefined) {
  if (!place) {
    return {
      meta: [{ title: "小孩取名 · 对脉名鉴" }, { name: "robots", content: "noindex" }],
    };
  }
  const content = buildPlaceContent(place);
  return {
    links: [{ rel: "canonical", href: content.canonical }],
    meta: [
      { title: content.title },
      { name: "description", content: content.description },
      ...(isPlaceIndexable(place.group) ? [] : [{ name: "robots", content: "noindex, follow" }]),
      { name: "keywords", content: content.keywords },
      { property: "og:url", content: content.canonical },
      { property: "og:title", content: content.title },
      { property: "og:description", content: content.description },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  };
}
