// 小程序 web-view 打开本站时的内核很旧：安卓微信报 Chrome/97（T7/SP-engine），iOS 15 的系统
// WebView 也一样，而 Tailwind v4 的产物默认要 Chrome 111+，直接渲染会丢样式。
// 这里只做一件事：展开 @layer —— 产物九成以上规则都在 @layer 里，老内核遇到不认识的 @layer
// 会整块丢弃，页面就变成没样式的原始 HTML；用特异性技巧（:not(#\#)）保持原来的层叠顺序。
// 颜色（oklch 转 sRGB 兜底，现代浏览器仍走 @supports 里的广色域写法）、@media (width>=X) 范围
// 语法、-webkit- 前缀交给 vite 自带的 lightningcss 转换器，目标写在 vite.config.ts 里。
import cascadeLayers from "@csstools/postcss-cascade-layers";
import postcss from "postcss";
import type { Plugin } from "vite";

/** 目标内核下限：安卓微信 X5/T7 与 iOS 15 系统 WebView */
export const LEGACY_CSS_TARGETS = { chrome: 97 << 16, ios_saf: 15 << 16 };

/**
 * 同一组内核的 esbuild 写法，给 build.cssTarget 用。vite 压 CSS 时会用
 * build.cssTarget（默认跟随 build.target）覆盖 css.lightningcss.targets，
 * 不一起设的话 @media 会被重新“升级”回 (width>=X) 范围语法。
 */
export const LEGACY_CSS_ESBUILD_TARGETS = ["chrome97", "ios15"];

export function legacyCssCompat(): Plugin {
  return {
    name: "legacy-css-compat:flatten-layers",
    // 必须与 @tailwindcss/vite 同组（pre）并排在其后，才能拿到编译好的 Tailwind 产物
    enforce: "pre",
    transform(code, id) {
      if (!id.includes(".css") || !code.includes("@layer")) return null;
      return postcss([cascadeLayers()])
        .process(code, { from: id })
        .then((result) => ({ code: result.css, map: null }));
    },
  };
}
