/**
 * 城市×姓氏页（M3）的元数据口径与收录判定。
 *
 * 地址 = 地名页规范地址 + "/" + 姓氏拼音（如 /qiming/sichuan/chengdu/wang、
 * /qiming/beijing/wang）。宿主限定为 58 个省会/直辖市入口（地名第 1 批），
 * 姓氏按「放开前 N 大姓」档位截断，两道闸同时生效（isSurnamePlaceIndexable）。
 */
import { PLACE_SITE_ORIGIN } from "@/lib/qiming/content";
import type { PlaceInfo } from "@/lib/qiming/places";
import { isSurnamePlaceIndexable, type LongtailStages } from "./rollout";
import { surnameRank } from "./longtail";

export interface PlaceSurnameContent {
  h1: string;
  title: string;
  description: string;
  keywords: string;
  canonical: string;
}

export function buildPlaceSurnameContent(
  place: PlaceInfo,
  surname: { han: string; pinyin: string },
): PlaceSurnameContent {
  const placeName = place.displayName;
  return {
    h1: `${placeName}${surname.han}姓小孩取名`,
    title: `${placeName}${surname.han}姓小孩取名：选字要点与名字参考 · 对脉名鉴`,
    description: `${placeName}${surname.han}姓小孩取名怎么选字？从「${surname.han}」姓的读音连读、字义与书写入手，附男宝女宝名字参考、谐音提示与常见问题。`,
    keywords: `${placeName}${surname.han}姓取名,${placeName}${surname.han}姓宝宝取名,${surname.han}姓小孩取名,${placeName}取名,宝宝取名`,
    canonical: `${PLACE_SITE_ORIGIN}${place.path}/${surname.pinyin}`,
  };
}

export function placeSurnameHead(
  place: PlaceInfo | null | undefined,
  surname: { han: string; pinyin: string } | null | undefined,
  stages: LongtailStages | null | undefined,
) {
  if (!place || !surname) {
    return {
      meta: [{ title: "小孩取名 · 对脉名鉴" }, { name: "robots", content: "noindex" }],
    };
  }
  const content = buildPlaceSurnameContent(place, surname);
  const indexable = isSurnamePlaceIndexable(
    place.group,
    surnameRank(surname.pinyin),
    stages?.surnamePlace ?? 0,
  );
  return {
    links: [{ rel: "canonical", href: content.canonical }],
    meta: [
      { title: content.title },
      { name: "description", content: content.description },
      ...(indexable ? [] : [{ name: "robots", content: "noindex, follow" }]),
      { name: "keywords", content: content.keywords },
      { property: "og:url", content: content.canonical },
      { property: "og:title", content: content.title },
      { property: "og:description", content: content.description },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
  };
}
