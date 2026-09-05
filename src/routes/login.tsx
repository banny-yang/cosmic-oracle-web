import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls } from "@/components/app-shell";
import { get, post, apiBase } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { track } from "@/lib/track";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/login" },
    ],
    meta: [
      { title: "登录 · 对脉名鉴" },
      { name: "description", content: "手机验证码或微信扫码登录对脉名鉴，同步解析记录与购买内容。" },
    ],
  }),
});

type Tab = "phone" | "wechat";

function LoginPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const redirect = params.get("redirect") || "/";

  const [tab, setTab] = useState<Tab>("phone");

  // 手机验证码登录
  const [phone, setPhone] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState("");

  // 微信扫码登录
  const [qr, setQr] = useState("");
  const [ticket, setTicket] = useState("");
  const [qrErr, setQrErr] = useState("");
  const [qrWaiting, setQrWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCaptcha = useCallback(() => {
    get<{ captchaId: string; imageBase64: string }>("/api/v1/users/phone-captcha", {}, { auth: false })
      .then((r) => {
        setCaptchaId(r.captchaId);
        setCaptchaImg("data:image/png;base64," + r.imageBase64);
      })
      .catch(() => setCaptchaImg(""));
  }, []);

  useEffect(() => {
    loadCaptcha();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadCaptcha]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const sendCode = async () => {
    setErr("");
    if (!/^1\d{10}$/.test(phone)) return setErr("请输入正确的手机号");
    if (!captchaInput) return setErr("请输入图形验证码");
    setSending(true);
    try {
      await post(
        "/api/v1/users/send-phone-code",
        { phone, captchaId, captchaCode: captchaInput },
        { auth: false, timeoutMs: 30000 },
      );
      setCountdown(60);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "发送失败");
      setCaptchaInput("");
      loadCaptcha();
    } finally {
      setSending(false);
    }
  };

  const phoneLogin = async () => {
    setErr("");
    if (!/^1\d{10}$/.test(phone)) return setErr("请输入正确的手机号");
    if (!smsCode) return setErr("请输入短信验证码");
    setLogging(true);
    try {
      const res = await post<LoginResponse>(
        "/api/v1/users/phone-login",
        { phone, code: smsCode },
        { auth: false },
      );
      finish(res, "wechat");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLogging(false);
    }
  };

  const createTicket = async () => {
    setQrErr("");
    setQr("");
    try {
      const r = await post<{ ticket?: string; qrCodeBase64?: string; urlLink?: string }>(
        "/api/v1/users/wechat/login-ticket",
        { mpSource: "self", pagePath: "pages/login/confirm", callbackApiBaseUrl: apiBase() },
        { auth: false },
      );
      if (!r.ticket) throw new Error("登录票据创建失败");
      setTicket(r.ticket);
      setQr(r.qrCodeBase64 ? (r.qrCodeBase64.startsWith("data:") ? r.qrCodeBase64 : "data:image/png;base64," + r.qrCodeBase64) : "");
      startPoll(r.ticket);
    } catch (e) {
      setQrErr(e instanceof Error ? e.message : "二维码生成失败，请重试");
    }
  };

  const startPoll = (t: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setQrWaiting(true);
    pollRef.current = setInterval(() => {
      get<{ status?: string; jwtToken?: string }>("/api/v1/users/wechat/login-status", { ticket: t }, { auth: false })
        .then((r) => {
          if (r?.status === "done" && r.jwtToken) {
            stopPoll();
            finish(r as unknown as LoginResponse, "phone");
          } else if (r?.status === "expired") {
            stopPoll();
            setQrErr("二维码已过期，请重新生成");
          }
        })
        .catch(() => {
          // 轮询失败静默重试
        });
    }, 2500);
  };

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setQrWaiting(false);
  };

  const finish = (res: LoginResponse, via: "phone" | "wechat") => {
    track("login_success", { via });
    stopPoll();
    saveAuth(res);
    navigate({ to: redirect });
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="账号"
        title="登录对脉名鉴"
        desc="登录后同步解析记录、购买内容与亲友投票——网页与小程序同账号互通，点数通用。"
      />

      <div className="ink-in d1 mt-7 flex rounded-xl bg-paper-2 p-1 ring-1 ring-ink/10">
        {(
          [
            ["phone", "手机验证码"],
            ["wechat", "微信扫码"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === k ? "bg-ink text-paper" : "text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "phone" ? (
        <section className="ink-in d2 mt-4 space-y-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <Field label="手机号">
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={11}
              placeholder="中国大陆手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="图形验证码">
            <div className="flex items-center gap-3">
              <input
                className={inputCls}
                placeholder="输入图中字符"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
              />
              {captchaImg ? (
                <img
                  src={captchaImg}
                  alt="图形验证码，点击刷新"
                  title="点击刷新"
                  className="h-10 w-28 shrink-0 cursor-pointer rounded-lg object-contain ring-1 ring-ink/10"
                  onClick={loadCaptcha}
                />
              ) : (
                <div className="h-10 w-28 shrink-0 rounded-lg bg-paper-3 ring-1 ring-ink/10" />
              )}
            </div>
          </Field>
          <Field label="短信验证码">
            <div className="flex items-center gap-3">
              <input
                className={inputCls}
                inputMode="numeric"
                maxLength={6}
                placeholder="6 位验证码"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
              />
              <button
                disabled={countdown > 0 || sending}
                onClick={sendCode}
                className="h-10 w-24 shrink-0 rounded-xl bg-paper-3 text-xs font-medium text-ink ring-1 ring-ink/10 transition-colors disabled:text-ink-faint"
              >
                {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : "发送验证码"}
              </button>
            </div>
          </Field>
          {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
          <button
            disabled={logging}
            onClick={phoneLogin}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {logging ? "登录中…" : "登录"}
          </button>
          <p className="text-center text-[11px] text-ink-faint">未注册的手机号，验证通过后将自动创建账号</p>
        </section>
      ) : (
        <section className="ink-in d2 mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
          <p className="text-sm leading-relaxed text-ink-soft">
            使用微信扫描二维码，在「对脉名鉴」小程序里确认后自动返回。
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            {qr ? (
              <img src={qr} alt="微信登录二维码" className="w-48 rounded-xl ring-1 ring-ink/10" />
            ) : (
              <div className="grid size-48 place-items-center rounded-xl bg-paper-3 text-xs text-ink-faint">
                {qrWaiting ? "生成中…" : "点击下方按钮生成二维码"}
              </div>
            )}
            {qrWaiting && qr ? <p className="text-xs text-ink-faint">等待扫码确认…</p> : null}
            {qrErr ? <p className="text-xs text-vermilion-deep">{qrErr}</p> : null}
            <button
              onClick={createTicket}
              className="rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper"
            >
              {qr ? "重新生成二维码" : "生成登录二维码"}
            </button>
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-ink-faint">
        登录遇到问题？<Link to="/" className="text-vermilion-deep underline underline-offset-2">回首页</Link>
      </p>
    </AppShell>
  );
}

export interface LoginResponse {
  jwtToken: string;
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tokenBalance?: number | null;
  hasBazi?: boolean | null;
}
