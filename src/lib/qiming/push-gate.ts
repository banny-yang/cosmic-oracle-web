/**
 * 百度主动推送的放量闸门（仅服务端引用，见 server.ts）。
 *
 * notifyBaiduOfPage 只看状态码和 content-type，不读页面里的 noindex；未到批次的
 * 地名页/长尾页如果照常推送，等于把 noindex 地址主动塞给百度。这里按路径形状
 * 找到对应矩阵的运行时配置挡掉未放量页面：
 * - /qiming/{省}/{姓}、/qiming/{省}/{市}/{姓}：城市×姓氏闸（省会/直辖市宿主 + 姓氏档位）；
 * - /qiming/ 其余路径：地名页 group 闸（sitemap.json 的 path → group 映射）；
 * - /names/{拼音}（单段）：姓氏单页闸；
 * - /classic/...、/wuxing/...、/zodiac/{生肖}/boy|girl：对应矩阵开关；
 * - 其它路径（/names/{姓}/{生肖}、/zodiac 常青/年份页等）：放行。
 *
 * 跳过时不调用 pushUrlToBaidu，路径不会进入它的去重集合，放量后还能再推。
 */
import placeSitemap from "../../data/places/sitemap.json";
import { isPlaceIndexable } from "./rollout";
import { getPlaceRolloutStage } from "./rollout-runtime";
import { isSurnamePlaceIndexable } from "@/lib/seo/rollout";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import { SURNAME_PLACE_HOSTS } from "@/lib/seo/longtail";
import { TOP_SURNAMES, surnameByPinyin } from "@/lib/surnames";

interface PlaceSitemapRow {
  loc: string;
  group: number;
}

let pathGroups: Map<string, number> | null = null;

function placeGroupIndex(): Map<string, number> {
  if (!pathGroups) {
    pathGroups = new Map<string, number>();
    for (const row of placeSitemap as PlaceSitemapRow[]) {
      try {
        pathGroups.set(new URL(row.loc).pathname, row.group);
      } catch {
        /* 数据由生成脚本产出，理论上不会出现坏 URL；坏一条不影响其余 */
      }
    }
  }
  return pathGroups;
}

/** 城市×姓氏页的宿主地址集合（58 个省会/直辖市入口，与 capitals.json 同源）。 */
let hostPaths: Set<string> | null = null;
function surnamePlaceHostPaths(): Set<string> {
  if (!hostPaths) {
    hostPaths = new Set(SURNAME_PLACE_HOSTS.map((h) => h.path));
  }
  return hostPaths;
}

function surnameRank(pinyin: string): number {
  return TOP_SURNAMES.findIndex((s) => s.pinyin === pinyin) + 1;
}

export async function shouldPushPath(pathname: string): Promise<boolean> {
  const segments = pathname.split("/").filter(Boolean);

  // /qiming/{省}/{市}/{姓}（4 段）：城市×姓氏页（宿主必须是省会入口；县级页优先，撞车时走 group 闸）
  if (segments[0] === "qiming" && segments.length === 4) {
    const fourth = segments[3];
    const citySeg = segments[2];
    if (fourth && citySeg) {
      const rank = surnameRank(fourth);
      const cityPath = `/qiming/${segments[1]}/${citySeg}`;
      if (rank >= 1 && surnamePlaceHostPaths().has(cityPath)) {
        const stages = await getLongtailStages();
        // 宿主都是地名第 1 批（group 1），批次闸恒过；姓氏档位是唯一变量
        return isSurnamePlaceIndexable(1, rank, stages.surnamePlace);
      }
    }
  }

  // /qiming/{省}/{姓}（3 段）：省级×姓氏页（31 个省级入口都是 group 1）
  if (segments[0] === "qiming" && segments.length === 3) {
    const third = segments[2];
    const rank = third ? surnameRank(third) : -1;
    if (rank >= 1) {
      const stages = await getLongtailStages();
      return isSurnamePlaceIndexable(1, rank, stages.surnamePlace);
    }
  }

  // 其余 /qiming/ 路径：地名页 group 闸
  if (segments[0] === "qiming") {
    const group = placeGroupIndex().get(pathname);
    if (group === undefined) return false;
    return isPlaceIndexable(group, await getPlaceRolloutStage());
  }

  // /names/{拼音}（两段）：姓氏单页闸；/names（灵感库）与 /names/{姓}/{生肖} 不受闸
  if (segments[0] === "names" && segments.length === 2) {
    const second = segments[1];
    if (second && surnameByPinyin(second)) {
      const stages = await getLongtailStages();
      return stages.surname === 1;
    }
  }

  if (segments[0] === "classic") {
    const stages = await getLongtailStages();
    return stages.classic === 1;
  }

  if (segments[0] === "wuxing") {
    const stages = await getLongtailStages();
    return stages.wuxing === 1;
  }

  // /zodiac/{生肖}/boy|girl：生肖×性别页闸
  if (segments[0] === "zodiac" && segments.length === 3) {
    const third = segments[2];
    if (third && (third === "boy" || third === "girl")) {
      const stages = await getLongtailStages();
      return stages.zodiacGender === 1;
    }
  }

  return true;
}
