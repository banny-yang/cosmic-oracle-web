/**
 * 轻量埋点封装：对接自托管 umami（同域 /umami.js，见 __root 注入）。
 * 未加载（本地 dev / 脚本被拦截）时静默丢弃，绝不影响业务。
 */

type TrackProps = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    umami?: { track: (event: string, props?: TrackProps) => void };
  }
}

export function track(event: string, props?: TrackProps) {
  try {
    window.umami?.track(event, props);
  } catch {
    /* 统计失败不影响业务 */
  }
}
