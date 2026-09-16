/**
 * 分享宣传推广地址（管理端「分享宣传」配置，app.promo.web_url，
 * 经公开接口 /api/v1/config/public 的 promoUrls.web 下发）。
 * 海报二维码的目标地址由此决定：未配置时回退默认域名（与旧行为一致）。
 */
import { get } from "./api";

const FALLBACK_BASE = "https://www.oracle.duimai.net";

let cache: Promise<string> | null = null;

/** 推广域名（裸域名口径，去尾部斜杠）；未配置/接口失败回退默认域名。进程内缓存一次。 */
export function promoWebUrl(): Promise<string> {
  cache ??= get<{ promoUrls?: { web?: string } }>(
    "/api/v1/config/public",
    {},
    { auth: false, timeoutMs: 6000 },
  )
    .then((cfg) => {
      const url = cfg?.promoUrls?.web?.trim() ?? "";
      return /^https?:\/\//.test(url) ? url.replace(/\/+$/, "") : FALLBACK_BASE;
    })
    .catch(() => FALLBACK_BASE);
  return cache;
}

/**
 * 海报二维码目标：配置为裸域名时 = 域名 + 功能路径（如 /naming，保持深链）；
 * 配置为带路径的落地页（pathname 非根或带查询串）时原样使用——
 * 管理端想统一指向一个活动页时只需填完整地址。
 */
export async function posterQrTarget(path: string): Promise<string> {
  const base = await promoWebUrl();
  try {
    const u = new URL(base);
    if ((u.pathname && u.pathname !== "/") || u.search) return base;
    return base + (path.startsWith("/") ? path : "/" + path);
  } catch {
    return FALLBACK_BASE + (path.startsWith("/") ? path : "/" + path);
  }
}
