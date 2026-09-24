/**
 * 报告生成流：purchase（点数直扣）→ SSE 流式渲染 markdown。
 * 点数不足/购买失败 → 统一展示「去小程序解锁」引导卡。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { post } from "@/lib/api";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { getToken } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { ScanBuyPanel } from "@/components/scan-buy";

export type ReportPhase = "form" | "running" | "done";

export function useReportFlow() {
  const [phase, setPhase] = useState<ReportPhase>("form");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [needPay, setNeedPay] = useState(false);
  const [reportId, setReportId] = useState("");
  const streamRef = useRef<StreamHandle | null>(null);

  useEffect(() => () => streamRef.current?.abort(), []);

  const run = async (body: Record<string, unknown>) => {
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent(location.pathname);
      return;
    }
    setError("");
    setNeedPay(false);
    setMarkdown("");
    setPhase("running");
    try {
      const res = await post<{ reportId?: string }>("/api/v1/reports/purchase", body);
      if (!res?.reportId) throw new Error("报告创建失败");
      setReportId(res.reportId);
      // 点数已在购买时扣除：立即刷新登录态余额，页头实时变化
      refreshBalance();
      let acc = "";
      streamRef.current = streamPost({
        path: `/api/v1/reports/${res.reportId}/stream?lang=zh`,
        idleTimeoutMs: 300_000,
        onEvent: (ev) => {
          if (typeof ev.answer === "string" && ev.answer) {
            acc += ev.answer;
            setMarkdown(acc);
          } else if (ev.error) {
            setError(String(ev.error) || "生成中断，请重试");
            setPhase("done");
          }
        },
        onDone: () => {
          setPhase("done");
          // 生成中断退款等余额变动兜底刷新
          refreshBalance();
        },
        onError: (e) => {
          setError(e.message || "网络连接失败");
          setPhase("done");
          refreshBalance();
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "购买失败";
      setError(msg);
      // 点数不足 / 支付类错误 → 引导小程序充值（402 为主判据，文案匹配兜底）
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402 || /点|余额|支付|购买|token|insufficient/i.test(msg)) setNeedPay(true);
      setPhase("done");
    }
  };

  const reset = () => {
    streamRef.current?.abort();
    setPhase("form");
    setMarkdown("");
    setError("");
    setNeedPay(false);
  };

  return { phase, markdown, error, needPay, reportId, run, reset };
}

/** 轻量 markdown 渲染：标题/粗体/列表/段落（报告为标准 md 文本） */
export function MiniMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^###\s?(.+)$/gm, '<h4 class="mt-5 text-sm font-semibold text-ink">$1</h4>')
    .replace(/^##\s?(.+)$/gm, '<h3 class="mt-6 text-base font-semibold text-ink">$1</h3>')
    .replace(/^#\s?(.+)$/gm, '<h2 class="mt-7 text-lg font-bold text-ink">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-sm leading-relaxed text-ink-soft">$1</li>')
    .split(/\n{2,}/)
    .map((block) =>
      block.startsWith("<h") || block.startsWith("<li")
        ? block
        : `<p class="mt-3 text-sm leading-relaxed text-ink-soft">${block.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 生成中骨架 */
export function ReportRunning({ error }: { error?: string }) {
  return (
    <section className="mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
      <div className="flex items-center gap-3">
        <span className="size-2 animate-pulse rounded-full bg-vermilion" />
        <p className="text-sm font-medium">正在撰写报告…</p>
      </div>
      <div className="mt-4 space-y-2.5">
        {[90, 70, 80, 55, 75].map((w, i) => (
          <div key={i} className="h-3.5 animate-pulse rounded bg-paper-3" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      {error ? <p className="mt-4 text-xs text-vermilion-deep">{error}</p> : null}
    </section>
  );
}

/** 点数不足 / 支付引导卡：选套餐 → 扫码直购（入账当前登录账号，到账自动提示）。 */
export function PaywallCard({ message, inModal }: { message: string; inModal?: boolean }) {
  return (
    <section className={(inModal ? "" : "mt-7 ") + "rounded-2xl bg-vermilion-wash p-5 "}>
      <p className="text-sm font-semibold text-vermilion-deep">{message}</p>
      <p className="mt-1 text-xs text-ink-soft">
        微信扫码支付所选套餐，点数/畅享直接充入当前登录账号，到账后自动提示，即可继续生成。
      </p>
      <div className="mt-3">
        <ScanBuyPanel trackWhere="paywall" />
      </div>
    </section>
  );
}

/** 点数不足弹窗：中文提示 + 小程序充值引导（复用 PaywallCard 的动态码与档位）。 */
export function RechargeModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-scrim p-4"
      onClick={onClose}
    >
      <div className="ink-in w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <PaywallCard message={message} inModal />
        <button
          onClick={onClose}
          className="mx-auto mt-3 block rounded-xl bg-paper-3 px-6 py-2 text-xs font-semibold text-ink transition-colors hover:bg-vermilion-wash"
        >
          我知道了
        </button>
      </div>
    </div>
  );
}

/** 表单容器 */
export function ReportForm({ children }: { children: ReactNode }) {
  return (
    <section className="ink-in d1 mt-7 space-y-3 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">{children}</section>
  );
}
