/**
 * 百度主动推送的放量闸门（仅服务端引用，见 server.ts）。
 *
 * notifyBaiduOfPage 只看状态码和 content-type，不读页面里的 noindex；未到批次的
 * 地名页（group > stage）如果照常推送，等于把 noindex 地址主动塞给百度。
 * 这里用 sitemap.json 的 path → group 映射挡掉未放量页面：
 * - 非 /qiming/ 路径、/qiming 总入口：放行；
 * - 已放量的地名页：放行；
 * - 未放量或 sitemap 里没有的 /qiming/ 路径：跳过。
 *
 * 跳过时不调用 pushUrlToBaidu，路径不会进入它的去重集合，放量后还能再推。
 */
import placeSitemap from "../../data/places/sitemap.json";
import { isPlaceIndexable } from "./rollout";

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

export function shouldPushQimingPath(pathname: string): boolean {
  if (!pathname.startsWith("/qiming/")) return true;
  const group = placeGroupIndex().get(pathname);
  if (group === undefined) return false;
  return isPlaceIndexable(group);
}
