/**
 * 报告生成流：purchase（点数直扣）→ SSE 流式渲染 markdown。
 * 点数不足/购买失败 → 统一展示「去小程序解锁」引导卡。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { post } from "@/lib/api";
import { streamPost, type StreamHandle } from "@/lib/sse";
import { getToken } from "@/lib/auth";
import { track } from "@/lib/track";

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
        onDone: () => setPhase("done"),
        onError: (e) => {
          setError(e.message || "网络连接失败");
          setPhase("done");
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
    <section className="mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
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

/** 点数不足 / 支付引导卡：动态生成直达小程序充值页的小程序码（失败回落静态码） */
export function PaywallCard({ message }: { message: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");

  useEffect(() => {
    post<{ qrCodeBase64?: string; urlLink?: string }>("/api/v1/users/wechat/login-ticket", {
      mpSource: "self",
      pagePath: "pages/mine/recharge",
    })
      .then((r) => {
        if (r?.qrCodeBase64) setQr(r.qrCodeBase64);
        if (r?.urlLink) setLink(r.urlLink);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="mt-7 rounded-2xl bg-vermilion/10 p-5 ring-1 ring-vermilion/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <p className="text-sm font-semibold text-vermilion-deep">{message}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            微信扫右侧小程序码直达充值页（或在微信里搜索「对脉名鉴」），用同一微信登录后购买点数，回到这里即可继续生成。
          </p>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            小程序充值：60 点 ¥6 · 320 点 ¥30 · 768 点 ¥72（约 0.1 元 / 点），点数双端通用。
          </p>
          <a
            href={link || "weixin://"}
            className="mt-3 inline-block rounded-xl bg-vermilion px-5 py-2 text-xs font-semibold text-paper"
          >
            去小程序充值
          </a>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-paper p-3 ring-1 ring-ink/10">
          <img src={qr || "/mp-qrcode.jpg"} alt="对脉名鉴小程序充值码" className="size-24 rounded object-contain" onClick={() => track("mp_qr_click", { where: "paywall" })} />
          <p className="text-[10px] font-medium text-ink">扫码直达充值</p>
        </div>
      </div>
    </section>
  );
}

/** 表单容器 */
export function ReportForm({ children }: { children: ReactNode }) {
  return (
    <section className="ink-in d1 mt-7 space-y-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">{children}</section>
  );
}
