/**
 * 轻量埋点封装：对接自托管 GoatCounter（同域 /count.js，见 __root 注入）。
 * 未加载（本地 dev / 脚本被拦截）时静默丢弃，绝不影响业务。
 */

type TrackProps = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    goatcounter?: {
      count: (params: { path: string; title?: string; event?: boolean }) => void;
    };
  }
}

export function track(event: string, props?: TrackProps) {
  try {
    window.goatcounter?.count({
      path: `/event/${event}`,
      title: props ? JSON.stringify(props) : undefined,
      event: true,
    });
  } catch {
    /* 统计失败不影响业务 */
  }
}
