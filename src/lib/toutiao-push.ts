/**
 * 头条搜索自动收录 push token 的运行时下发。
 *
 * 构建时可用 VITE_TOUTIAO_AUTO_PUSH 把标签直接写进 head；管理端「GEO 收录 → 设置」把 token 存库后，
 * 这里经公开接口 /api/v1/geo/push-config 取回：库里有值就以库为准（换 token 不用重新发版），
 * 库里为空则保留构建时注入的标签。push.js 在页面被访问时自动把当前 URL 推给头条，
 * 因此同一页面只保留一个 #ttzz 标签，避免重复上报。
 */
import { get } from "./api";

const PUSH_JS = "https://lf1-cdn-tos.bytegoofy.com/goofy/ttzz/push.js";

/** 按后台下发的 token 注入/替换 push.js 标签（浏览器端调用；接口不可用时静默跳过）。 */
export async function syncToutiaoPush(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    const cfg = await get<{ toutiaoToken?: string | null }>(
      "/api/v1/geo/push-config",
      {},
      { auth: false, timeoutMs: 6000 },
    );
    const token = cfg?.toutiaoToken?.trim();
    if (!token) return;
    const existing = document.getElementById("ttzz");
    if (existing?.getAttribute("src")?.includes(token)) return;
    existing?.remove();
    const el = document.createElement("script");
    el.id = "ttzz";
    el.async = true;
    el.src = `${PUSH_JS}?${token}`;
    document.head.appendChild(el);
  } catch {
    /* 保持构建时注入的标签 */
  }
}
