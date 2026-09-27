/**
 * SSR 渲染成功后把页面 URL 报给后端，由后端 BaiduPushService 做百度主动推送。
 *
 * 本模块只负责「发」：是否本站 URL、是否私有路径、去重与每日配额全部由后端判定，
 * 过滤名单只在后端维护一份（见 BaiduPushService.PRIVATE_PATHS），这里不复制第二份规则。
 * 本进程内按 pathname 去重——同一页面只在首次渲染成功时发一次请求，
 * 之后无论多少访问都不再发出，因此总请求量被「页面数」而不是「访问量」约束。
 *
 * 地址未注入时静默跳过：容器里由 compose 的 API_BASE_URL 提供；
 * dev（vite dev 加载 .env.development）不上报，避免本地开发把地址推给后端。
 */
import { runtimeApiBaseUrl } from "./runtime-env";

/** 站点规范域名：后端按 geo.site-base-url 做 host 白名单，必须与之一致。 */
const SITE_ORIGIN = "https://name.duimai.net";

/** 上报目标：容器注入的 API_BASE_URL 优先；裸跑 server 产物时用构建期地址，dev 不上报。 */
function resolveApiBase(): string {
  const runtime = runtimeApiBaseUrl();
  if (runtime) return runtime;
  return import.meta.env.PROD ? (import.meta.env["VITE_API_BASE_URL"] ?? "") : "";
}

const API_BASE = resolveApiBase();

/** 本进程已上报的 pathname：重启后清空，跨进程重复由后端去重兜底。 */
const pushed = new Set<string>();

export function pushUrlToBaidu(pathname: string): void {
  if (!API_BASE || !pathname) return;
  if (pushed.has(pathname)) return;
  pushed.add(pathname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  void fetch(`${API_BASE}/api/v1/geo/push-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: SITE_ORIGIN + pathname }),
    signal: controller.signal,
  })
    .catch(() => {
      /* 上报失败不影响页面返回，也不重试：下一轮发版或服务器脚本会补 */
    })
    .finally(() => clearTimeout(timer));
}
