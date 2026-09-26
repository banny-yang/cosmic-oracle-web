import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, inputCls } from "@/components/app-shell";
import { listMyCoupons, redeemCouponCode, type UserCoupon } from "@/lib/ops";
import { getToken, updateUser } from "@/lib/auth";
import { track } from "@/lib/track";

export const Route = createFileRoute("/coupons")({
  component: CouponsPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "我的券 · 对脉名鉴" },
      { name: "description", content: "查看已领取的优惠券与点数券，输入兑换码兑换。" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  UNUSED: "未使用",
  USED: "已使用",
  EXPIRED: "已过期",
};

/** 面值展示：点数券看点数，抵扣券看元（后端一律以「分」传输）。 */
function faceValue(c: UserCoupon): string {
  if (c.couponType === "FIXED_TOKENS") return `${c.value ?? 0} 点`;
  if (c.couponType === "DISCOUNT_FEN") return `¥${(((c.value ?? 0) || 0) / 100).toFixed(2)}`;
  return "-";
}

function CouponsPage() {
  const [items, setItems] = useState<UserCoupon[]>([]);
  const [usable, setUsable] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [okLine, setOkLine] = useState("");

  const load = () => {
    listMyCoupons()
      .then((res) => {
        setItems(res?.data || []);
        setUsable(res?.usable ?? 0);
        setLoaded(true);
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoaded(true);
      });
  };

  useEffect(() => {
    track("coupons_view");
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/coupons");
      return;
    }
    load();
  }, []);

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return setErr("请输入兑换码");
    setRedeeming(true);
    setErr("");
    setOkLine("");
    try {
      const res = await redeemCouponCode(trimmed);
      track("coupon_redeem", { type: res.couponType });
      setOkLine(
        res.couponType === "FIXED_TOKENS"
          ? `「${res.couponName}」已到账，点数余额 ${res.tokenBalance}`
          : `「${res.couponName}」已放入券包，下单时可用`,
      );
      updateUser({ tokenBalance: res.tokenBalance });
      setCode("");
      load();
    } catch (e) {
      track("coupon_redeem_fail");
      setErr(e instanceof Error ? e.message : "兑换失败");
    } finally {
      setRedeeming(false);
    }
  };

  const time = (t: string | null) => (t ? t.replace("T", " ").slice(0, 10) : "");

  return (
    <AppShell>
      <PageHeader eyebrow="账号" title="我的券" desc="兑换码兑换、券包与有效期。" />

      {/* 兑换码 */}
      <section className="ink-in d1 mt-7 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
        <p className="text-sm font-medium">兑换码兑换</p>
        <p className="mt-1 text-xs text-ink-faint">点数券兑换即到账；抵扣券进券包，充值时自动可选</p>
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="请输入兑换码"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={32}
          />
          <button
            onClick={redeem}
            disabled={redeeming || !code.trim()}
            className="shrink-0 rounded-xl bg-vermilion px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {redeeming ? "兑换中…" : "兑换"}
          </button>
        </div>
        {okLine ? <p className="mt-2 text-xs text-emerald-700">{okLine}</p> : null}
        {err ? <p className="mt-2 text-xs text-vermilion-deep">{err}</p> : null}
      </section>

      {/* 券包 */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">券包</h2>
        <span className="text-xs text-ink-faint">可用 {usable} 张</span>
      </div>

      {!loaded ? (
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper-3" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="font-seal text-3xl text-ink-faint">券</p>
          <p className="mt-3 text-sm font-medium">券包还是空的</p>
          <p className="mt-1 text-xs text-ink-faint">参与活动、邀请好友或在客服处领取兑换码</p>
          <Link to="/invite" className="mt-5 inline-block rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper">
            去邀请好友
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((c) => {
            const expired = c.status !== "UNUSED";
            return (
              <div
                key={c.id}
                className={`ink-in flex items-center gap-4 rounded-2xl bg-white p-4 transition-colors ${
                  expired ? "opacity-60" : "hover:bg-vermilion-wash"
                }`}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink font-seal text-lg text-paper">
                  券
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name || "优惠券"}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {faceValue(c)}
                    {c.couponType === "DISCOUNT_FEN" && (c.minSpendFen ?? 0) > 0
                      ? ` · 满 ${((c.minSpendFen ?? 0) / 100).toFixed(2)} 元可用`
                      : ""}
                    {c.expiresAt ? ` · ${time(c.expiresAt)} 前有效` : " · 长期有效"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    c.status === "UNUSED" ? "bg-vermilion-wash text-vermilion-deep" : "bg-paper-3 text-ink-soft"
                  }`}
                >
                  {STATUS_LABEL[c.status] || c.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
