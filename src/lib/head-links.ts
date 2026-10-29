/**
 * 全站共用 head 片段。
 *
 * 毛笔字体（mashanzheng.woff2，1.7MB）不再在 __root 里全站预载：预载会和首屏
 * JS/CSS 抢 4G 带宽，而大多数页面只有头像那一枚小字用到它。只在印章字撑门面的
 * 路由（/ /naming /names）的 head 里引用下面这条，其余页面交给 font-display: swap
 * 惰性加载。生产上 11/14 条 js_error 就是全站预载超时被中断产生的。
 */
export const SEAL_FONT_PRELOAD = {
  rel: "preload",
  href: "/fonts/mashanzheng.woff2",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous",
} as const;
