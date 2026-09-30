/**
 * 节日营销露出态（管理端「节日营销」配置，公开接口 /api/v1/config/festival）。
 * 窗口命中且该节日已传素材时 enabled=true，首页 Hero 位整图替换默认轮播。
 * 与 promo-config 不同：这里刻意不做进程级缓存——首页每次 SSR 现取，
 * 运营换图/关开关后下一次请求即生效，无需等 SSR 重启。
 */
import { apiBase, get } from "./api";

export interface FestivalHeroData {
  enabled: boolean;
  code?: string;
  label?: string;
  date?: string;
  daysUntil?: number;
  phase?: string;
  imageUrl?: string;
  ctaTarget?: string;
  ctaExternal?: boolean;
}

/** 取当前节日露出态；关闭/无素材/接口失败一律返回 null（首页保持默认轮播）。 */
export async function fetchFestival(): Promise<FestivalHeroData | null> {
  try {
    const data = await get<FestivalHeroData>("/api/v1/config/festival", {}, { auth: false, timeoutMs: 1500 });
    return data?.enabled && data.imageUrl ? data : null;
  } catch {
    return null;
  }
}

/** 素材地址：后端下发 /files/festival/** 相对路径，拼上后端域名（SSR 无 window 也能取到）。 */
export function festivalImageUrl(imageUrl: string): string {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  return apiBase() + imageUrl;
}
