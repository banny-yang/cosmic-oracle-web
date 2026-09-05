import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const SITE_URL = "https://www.oracle.duimai.net";
const SITE_TITLE = "对脉名鉴 · 起名与姓名文化参考";
const SITE_DESC =
  "对脉名鉴：宝宝起名、姓名解析、性格契合测评与婚姻契合分析。从字义、音韵与诗句出处出发，为重要的人取一个经得起时间的名字。";

/** 部署时经 VITE_TRACKING=1 启用统计（GoatCounter 同域脚本），本地 dev 不加载 */
const TRACKING_ENABLED = import.meta.env.VITE_TRACKING === "1";

/** 站长平台验证码（百度/Google/Bing），构建时经 VITE_*_SITE_VERIFICATION 注入 */
const SITE_VERIFICATIONS = [
  ["baidu-site-verification", import.meta.env.VITE_BAIDU_SITE_VERIFICATION as string | undefined],
  ["google-site-verification", import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined],
  ["msvalidate.01", import.meta.env.VITE_BING_SITE_VERIFICATION as string | undefined],
].filter(([, v]) => !!v) as [string, string][];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">页面不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">你要找的页面可能已被移动或删除。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/naming"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            去起名
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">页面没能加载出来</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          我们这边出了点问题，你可以刷新重试，或先回首页看看。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            重试
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            回到首页
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      ...SITE_VERIFICATIONS.map(([name, content]) => ({ name, content })),
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESC },
      { property: "og:site_name", content: "对脉名鉴" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE_URL}/og-card.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/og-card.jpg` },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      /* 毛笔字体预载：首屏印章字与标题直接渲染，Core Web Vitals */
      {
        rel: "preload",
        href: "/fonts/mashanzheng.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
    scripts: TRACKING_ENABLED
      ? [
          {
            src: "/count.js",
            async: true,
            "data-goatcounter": `${SITE_URL}/count`,
          },
        ]
      : undefined,
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
