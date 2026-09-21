/**
 * 自建访问统计（V162）：sendBeacon 上报到自己后端 /api/v1/analytics/collect，
 * 明细落 t_web_visit（event 空=页面浏览 PV，非空=业务埋点）。
 * 仅生产构建且 VITE_TRACKING=1 时上报；失败静默，绝不影响业务。
 */

const ENDPOINT = "/api/v1/analytics/collect";
const VID_KEY = "co_vid";
const REF_KEY = "co_ref";

type Payload = {
  path?: string | undefined;
  event?: string | undefined;
  props?: string | undefined;
};

export function beacon(payload: Payload) {
  try {
    if (import.meta.env["VITE_TRACKING"] !== "1") return;
    const body = {
      path: payload.path ?? window.location.pathname,
      event: payload.event,
      props: payload.props,
      referrer: refHost(),
      vid: vid(),
      device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
    };
    navigator.sendBeacon?.(
      ENDPOINT,
      new Blob([JSON.stringify(body)], { type: "application/json" }),
    );
  } catch {
    /* 统计失败不影响业务 */
  }
}

/** 页面浏览（PV）：AppShell 路由变化时调用。
 *  同一文档内按路径去重——路由过渡会让新旧两棵树都跑一次 effect，
 *  不去重时每次站内跳转都会记 2 条 PV；刷新页面模块状态重置，照常计数。 */
let lastReportedPath: string | null = null;

export function pageView(path: string) {
  if (path === lastReportedPath) return;
  lastReportedPath = path;
  beacon({ path });
}

/** 匿名访客 id（UV 口径）：localStorage 持久 uuid，无 cookie 合规问题。 */
function vid(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v =
        globalThis.crypto?.randomUUID?.() ??
        `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

/** 进站来源 host（站外）：会话内首次记录复用，SPA 内部导航不覆盖。 */
function refHost(): string | null {
  try {
    let r = sessionStorage.getItem(REF_KEY);
    if (r === null) {
      r = "";
      try {
        const u = new URL(document.referrer);
        if (u.host && u.host !== window.location.host) {
          r = u.host;
        }
      } catch {
        /* 无 referrer 或非法 URL = 直接访问 */
      }
      sessionStorage.setItem(REF_KEY, r);
    }
    return r || null;
  } catch {
    return null;
  }
}
