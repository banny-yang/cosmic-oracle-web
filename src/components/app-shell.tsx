import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import type { ReactNode } from "react";
import { useAuth, getToken, updateToken } from "@/lib/auth";
import { post } from "@/lib/api";
import { useFeatureEnabled } from "@/lib/use-feature-price";
import {
  Baby,
  BookOpen,
  Coins,
  Grid3x3,
  Heart,
  HeartHandshake,
  History,
  Menu,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * 全站顶栏功能菜单（7 项）：管理端关闭的功能（t_feature.enabled=false）自动隐藏。
 * 价格在各功能页内动态展示，菜单只放入口；lucide 线性图标与右侧胶囊图标风格统一。
 */
const FEATURE_MENU = [
  { to: "/naming", code: "BABY_NAMING", icon: Baby, title: "宝宝起名" },
  { to: "/analysis", code: "INSIGHT_NAME", icon: Waves, title: "姓名共振" },
  { to: "/personality", code: "INSIGHT_PAIR", icon: HeartHandshake, title: "缘分匹配" },
  { to: "/marriage", code: "MARRIAGE_FIT", icon: Heart, title: "八字合婚" },
  { to: "/liuyao", code: "DIVINATION", icon: Coins, title: "六爻占卜" },
  { to: "/qimen", code: "QIMEN_JUDGE", icon: Grid3x3, title: "奇门断局" },
  { to: "/names", code: "NAME_GALLERY", icon: BookOpen, title: "名字灵感库" },
] as const satisfies ReadonlyArray<{
  to: string;
  code: string;
  icon: LucideIcon;
  title: string;
}>;

/** 顶栏功能菜单（横排桌面 / 纵排汉堡浮层），受管理端功能开关控制 */
function FeatureNav({ vertical = false }: { vertical?: boolean }) {
  const enabled = {
    BABY_NAMING: useFeatureEnabled("BABY_NAMING"),
    INSIGHT_NAME: useFeatureEnabled("INSIGHT_NAME"),
    INSIGHT_PAIR: useFeatureEnabled("INSIGHT_PAIR"),
    MARRIAGE_FIT: useFeatureEnabled("MARRIAGE_FIT"),
    DIVINATION: useFeatureEnabled("DIVINATION"),
    QIMEN_JUDGE: useFeatureEnabled("QIMEN_JUDGE"),
    NAME_GALLERY: useFeatureEnabled("NAME_GALLERY"),
  };
  const items = FEATURE_MENU.filter((f) => enabled[f.code] !== false);
  return (
    <nav
      className={vertical ? "flex flex-col items-stretch gap-1" : "flex items-center gap-1"}
      aria-label="功能菜单"
    >
      {items.map((f) => {
        const Icon = f.icon;
        return (
          <Link
            key={f.to}
            to={f.to}
            className={[
              "group relative flex items-center text-sm whitespace-nowrap text-ink-soft transition-colors hover:text-ink",
              vertical
                ? "gap-3 rounded-xl px-3.5 py-2.5 text-[15px] hover:bg-paper-3"
                : "gap-1.5 px-3 py-2",
            ].join(" ")}
            activeProps={{
              className: [
                "relative flex items-center font-medium whitespace-nowrap text-vermilion-deep transition-colors",
                vertical
                  ? "gap-3 rounded-xl bg-vermilion/[0.08] px-3.5 py-2.5 text-[15px]"
                  : "gap-1.5 px-3 py-2 text-sm",
                // 横排选中态：底部朱笔短线（朱批），与右侧胶囊拉开层级
                vertical
                  ? ""
                  : "after:absolute after:-bottom-px after:left-1/2 after:h-[2px] after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-vermilion",
              ].join(" "),
            }}
          >
            <Icon aria-hidden className={vertical ? "size-[18px]" : "size-4"} strokeWidth={1.75} />
            {f.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** 内容列与 banner 内层共用同一套宽度约束，保证左对齐一致 */
export const shellCls = "mx-auto max-w-[430px] px-5 md:max-w-3xl md:px-8 lg:max-w-5xl";

/** 品牌标：与微信小程序同源的朱红方章图标 */
export function BrandMark({ className = "size-11 shrink-0 rounded-xl" }: { className?: string }) {
  return (
    <img
      src="/brand-logo.png"
      alt="对脉名鉴"
      className={`shadow-sm ring-1 ring-vermilion-deep/25 ${className}`}
    />
  );
}

export function AppShell({ banner, children }: { banner?: ReactNode; children: ReactNode }) {
  // 轻量前端错误监控：未捕获异常/未处理 Promise 拒绝 → 埋点
  useEffect(() => {
    const onErr = (e: ErrorEvent) =>
      track("js_error", {
        msg: String(e.message || "").slice(0, 120),
        src: String(e.filename || "").slice(-60),
      });
    const onRej = (e: PromiseRejectionEvent) =>
      track("js_error", { msg: "unhandledrejection:" + String(e.reason).slice(0, 120) });
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  // 登录态持久化：打开页面即静默滑动续期（fire-and-forget，失败不打扰）
  useEffect(() => {
    if (!getToken()) return;
    post<{ token?: string }>("/api/v1/users/refresh-token", undefined, { timeoutMs: 8000 })
      .then((r) => {
        if (r?.token) updateToken(r.token);
      })
      .catch(() => {});
  }, []);

  const { loggedIn, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-song text-foreground selection:bg-vermilion/20">
      {/* 吸顶顶栏：滚动常驻，半透明纸色+毛玻璃；不能加 overflow-hidden（朱笔下划线/浮层阴影需露出） */}
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper-2/85 backdrop-blur-md">
        {/* xl+ 顶栏比内容栏宽一档（max-w-7xl）：7 项带图标菜单在内容栏宽度（max-w-5xl）内会逐字断行 */}
        <div className={`${shellCls} pt-3.5 pb-3 xl:max-w-7xl`}>
          <div className="flex items-center gap-2">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <div className="min-w-0 leading-snug">
                <p className="truncate text-lg font-semibold tracking-[0.06em] min-[430px]:tracking-[0.14em]">
                  对脉名鉴
                </p>
                {/* 小屏省略副标题：与右侧两个胶囊（解析记录+点数）抢宽度会换行挤压 */}
                <p className="hidden truncate text-sm text-ink-soft min-[430px]:block">
                  起名与姓名文化参考
                </p>
              </div>
            </Link>
            {/* 桌面端功能菜单（xl+ 一排铺开居中）；管理端关闭的项自动隐藏 */}
            <div className="mx-auto hidden xl:block">
              <FeatureNav />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* 小屏汉堡：功能菜单浮层下拉 */}
              <button
                type="button"
                aria-label="功能菜单"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="grid size-9 place-items-center rounded-full bg-paper-2 text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-ink xl:hidden"
              >
                <Menu className="size-5" />
              </button>
              {loggedIn ? (
                <>
                  <Link
                    to="/records"
                    aria-label="解析记录"
                    className="flex items-center rounded-full bg-paper-2 px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-ink min-[430px]:px-3.5"
                  >
                    {/* <360px 只留图标，为品牌名腾出宽度 */}
                    <History className="size-4 min-[360px]:hidden" />
                    <span className="hidden min-[360px]:inline">解析记录</span>
                  </Link>
                  <Link
                    to="/me"
                    className="flex items-center gap-1.5 rounded-full bg-vermilion/10 px-3 py-1.5 ring-1 ring-vermilion/20 min-[430px]:px-3.5"
                  >
                    <span className="size-1.5 rounded-full bg-vermilion" />
                    <span className="text-base font-semibold tabular-nums">
                      {user?.tokenBalance ?? 0}
                    </span>
                    <span className="text-sm text-ink-soft">点</span>
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  className="rounded-full bg-vermilion/10 px-4 py-1.5 text-base font-medium text-vermilion-deep ring-1 ring-vermilion/20"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* 小屏功能菜单浮层（贴顶栏下沿展开，滚动中不推挤页面内容） */}
        {menuOpen ? (
          <div className="absolute inset-x-0 top-full border-b border-ink/5 bg-paper-2/95 shadow-lg shadow-ink/5 backdrop-blur-md xl:hidden">
            <div className={`${shellCls} pt-2 pb-4 xl:max-w-7xl`}>
              <FeatureNav vertical />
            </div>
          </div>
        ) : null}
      </header>
      <div className="relative overflow-hidden">{banner}</div>
      <div className={`${shellCls} pt-7 pb-28`}>
        {children}
        <footer className="mt-10 space-y-2 text-center">
          <p className="text-[11px] leading-relaxed text-ink-faint text-pretty">
            本工具内容基于传统文化整理，仅作文化参考与娱乐用途，不构成任何预测或占卜建议。
          </p>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            <Link to="/privacy" className="hover:text-ink-soft">
              隐私政策
            </Link>
            <span className="mx-1.5">·</span>
            <Link to="/terms" className="hover:text-ink-soft">
              用户协议
            </Link>
            <span className="mx-1.5">·</span>
            <Link to="/help" className="hover:text-ink-soft">
              帮助中心
            </Link>
          </p>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            © 2026
            <a
              href="https://www.mihaha.com/"
              target="_blank"
              rel="noreferrer"
              className="mx-1 hover:text-ink-soft"
            >
              成都米哈哈科技
            </a>
            ·
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="ml-1 hover:text-ink-soft"
            >
              蜀ICP备16031368号-7
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="ink-in mt-9">
      {eyebrow ? (
        <p className="text-xs tracking-[0.35em] text-vermilion-deep uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="mt-3 max-w-[24ch] text-3xl leading-tight font-semibold text-balance md:text-4xl">
        {title}
      </h1>
      {desc ? (
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-soft text-pretty">
          {desc}
        </p>
      ) : null}
    </div>
  );
}

/** 面包屑结构化数据：搜索结果展示层级路径（首页自动作为第一级） */
export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { name: "首页", path: "/" },
            { name, path },
          ].map((it, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: it.name,
            item: "https://www.oracle.duimai.net" + it.path,
          })),
        }),
      }}
    />
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">
        {required ? (
          <span
            aria-hidden
            className="mr-1 inline-block size-1.5 rounded-full bg-vermilion align-[1px]"
          />
        ) : null}
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl bg-paper-2 px-3.5 py-2.5 text-base text-ink ring-1 ring-ink/10 outline-none placeholder:text-ink-faint focus:ring-vermilion/50 md:text-sm";
