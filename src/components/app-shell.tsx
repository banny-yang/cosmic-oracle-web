import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { loggedIn, user } = useAuth();

  return (
    <div className="min-h-screen bg-background font-song text-foreground selection:bg-vermilion/20">
      <div className="mx-auto max-w-[430px] px-5 pt-7 pb-28 md:max-w-3xl md:px-8 lg:max-w-5xl">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand-logo.png" alt="对脉名鉴" className="size-11 shrink-0 rounded-xl object-cover" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide">对脉名鉴</p>
              <p className="text-xs text-ink-soft">起名与姓名文化参考</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <>
                <Link
                  to="/records"
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-ink/10 transition-colors hover:text-ink"
                >
                  解析记录
                </Link>
                <Link
                  to="/me"
                  className="flex items-center gap-1.5 rounded-full bg-vermilion/10 px-3 py-1.5 ring-1 ring-vermilion/20"
                >
                  <span className="size-1.5 rounded-full bg-vermilion" />
                  <span className="text-sm font-semibold tabular-nums">
                    {user?.tokenBalance ?? 0}
                  </span>
                  <span className="text-xs text-ink-soft">点</span>
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-vermilion/10 px-4 py-1.5 text-sm font-medium text-vermilion-deep ring-1 ring-vermilion/20"
              >
                登录
              </Link>
            )}
          </div>
        </header>
        {children}
        <footer className="mt-10 space-y-2 text-center">
          <p className="text-[11px] leading-relaxed text-ink-faint text-pretty">
            本工具内容基于传统文化整理，仅作文化参考与娱乐用途，不构成任何预测或占卜建议。
          </p>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            <Link to="/privacy" className="hover:text-ink-soft">隐私政策</Link>
            <span className="mx-1.5">·</span>
            <Link to="/terms" className="hover:text-ink-soft">用户协议</Link>
          </p>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            © 2026 对脉科技（武汉）有限公司 ·
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="ml-1 hover:text-ink-soft"
            >
              鄂ICP备XXXXXXXX号
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
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-soft text-pretty">{desc}</p>
      ) : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl bg-paper-2 px-3.5 py-2.5 text-sm text-ink ring-1 ring-ink/10 outline-none placeholder:text-ink-faint focus:ring-vermilion/50";
