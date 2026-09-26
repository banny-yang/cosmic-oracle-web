import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { AppShell, PageHeader, inputCls } from "@/components/app-shell";
import { bindInviter, getMyInvite, type InviteInfo } from "@/lib/ops";
import { promoWebUrl } from "@/lib/promo-config";
import { getToken } from "@/lib/auth";
import { track } from "@/lib/track";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "邀请好友 · 对脉名鉴" },
      { name: "description", content: "分享专属邀请链接，好友首次充值后你可获得点数奖励。" },
    ],
  }),
});

function InvitePage() {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [bindCode, setBindCode] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindMsg, setBindMsg] = useState("");

  const load = () => {
    getMyInvite()
      .then((res) => {
        setInfo(res);
        // 专属链接 = 推广域名 + ?ref=<我的短号>，与后端 trackLogin 的 ref 口径一致
        if (res?.inviteCode) {
          promoWebUrl().then((base) => setShareUrl(`${base}/?ref=${res.inviteCode}`));
        }
        setLoaded(true);
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoaded(true);
      });
  };

  useEffect(() => {
    track("invite_view");
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/invite");
      return;
    }
    load();
  }, []);

  const share = async () => {
    track("invite_share_click");
    const text = "我在「对脉名鉴」用八字给自己起了名字，你也来看看";
    try {
      if (navigator.share) {
        await navigator.share({ title: "对脉名鉴 · 邀请", text, url: shareUrl });
        return;
      }
      throw new Error("no share");
    } catch {
      try {
        await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const bind = async () => {
    const code = bindCode.trim();
    if (!code) return setBindMsg("请输入邀请码");
    setBinding(true);
    setBindMsg("");
    try {
      const res = await bindInviter(code);
      if (res?.bound) {
        track("invite_bound");
        setBindCode("");
        setBindMsg("已绑定邀请人");
        load();
      } else {
        setBindMsg("邀请码无效，或你已有邀请人");
      }
    } catch (e) {
      setBindMsg(e instanceof Error ? e.message : "绑定失败");
    } finally {
      setBinding(false);
    }
  };

  return (
    <AppShell>
      <PageHeader eyebrow="账号" title="邀请好友" desc="好友首次充值后，奖励自动到账。" />

      {err ? <p className="mt-4 text-xs text-vermilion-deep">{err}</p> : null}

      {!loaded ? (
        <div className="mt-7 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-paper-3" />
          ))}
        </div>
      ) : (
        <>
          <section className="ink-in d1 mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">我的邀请码</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {info?.enabled === false
                    ? "邀请奖励当前暂停发放，邀请关系仍会记录"
                    : `好友首次充值后，你获得 ${info?.rewardTokens ?? 0} 点`}
                </p>
              </div>
              <span className="shrink-0 rounded-xl bg-paper-3 px-3.5 py-1.5 font-mono text-base font-semibold text-ink">
                {info?.inviteCode || "-"}
              </span>
            </div>

            <p className="mt-4 break-all rounded-xl bg-paper-3 px-3 py-2 text-[11px] text-ink-soft">
              {shareUrl || "链接生成中…"}
            </p>

            <button
              onClick={share}
              disabled={!shareUrl}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "链接已复制，去粘贴给好友" : "分享邀请链接"}
            </button>
          </section>

          <div className="ink-in d2 mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "已邀请", value: info?.invitedTotal ?? 0, unit: "人" },
              { label: "已发奖", value: info?.rewardedTotal ?? 0, unit: "人" },
              { label: "累计奖励", value: info?.earnedTokens ?? 0, unit: "点" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white p-4 text-center">
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  {s.label}（{s.unit}）
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            好友完成首次充值才发奖，同一好友只计一次。
          </p>

          {info && !info.invited ? (
            <section className="ink-in d3 mt-4 rounded-2xl bg-white p-5">
              <p className="text-sm font-medium">填写好友邀请码</p>
              <p className="mt-1 text-xs text-ink-faint">
                朋友邀请你来的？填上他的邀请码，绑定后不可更改
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  className={inputCls}
                  placeholder="好友的邀请码"
                  value={bindCode}
                  onChange={(e) => setBindCode(e.target.value)}
                  maxLength={36}
                />
                <button
                  onClick={bind}
                  disabled={binding || !bindCode.trim()}
                  className="shrink-0 rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink disabled:opacity-60"
                >
                  {binding ? "绑定中…" : "绑定"}
                </button>
              </div>
              {bindMsg ? <p className="mt-2 text-xs text-ink-soft">{bindMsg}</p> : null}
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
