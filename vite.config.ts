// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { LEGACY_CSS_ESBUILD_TARGETS, LEGACY_CSS_TARGETS, legacyCssCompat } from "./legacy-css-compat";

export default defineConfig({
  // 8080 留给 Java 后端；本 Web dev 固定 8082（与 dashboard 的 8081 区分）
  vite: {
    server: { port: 8082, strictPort: true },
    preview: { port: 8082, strictPort: true },
    // Tailwind v4 的产物默认要 Chrome 111+，而小程序 web-view 是 Chrome 97 / iOS 15，见 legacy-css-compat.ts
    plugins: [legacyCssCompat()],
    // 转换阶段看 css.lightningcss.targets，压缩阶段 vite 改用 build.cssTarget（默认跟随
    // build.target），不一起设的话 @media 会被压回 (width>=X) 范围语法
    build: { cssTarget: LEGACY_CSS_ESBUILD_TARGETS },
    css: { lightningcss: { targets: LEGACY_CSS_TARGETS } },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // 自托管 Node SSR（默认 cloudflare-module 不适合本机/服务器直跑）
  nitro: { preset: "node-server" },
});
