/**
 * 进站优惠券弹窗：登录用户进入站点时，若有「可自助领取」的券（管理端模板勾选 claimable），
 * 弹窗提示领取。用户关闭后按「当天 + 同一批券」记录，当日不再重复打扰；
 * 之后新上架的券（签名变化）或次日仍会提示。领完即自动消失。
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { claimCoupon, listClaimableCoupons, type ClaimableCoupon } from "@/lib/ops";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/track";

const DISMISS_KEY = "coupon_entry_popup_dismissed";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dismissedSignature(): string | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { date?: string; sig?: string };
    return saved.date === today() ? saved.sig ?? "" : null;
  } catch {
    return null;
  }
}

function markDismissed(sig: string) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: today(), sig }));
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

function valueText(c: ClaimableCoupon): string {
  if (c.couponType === "FIXED_TOKENS") return `${c.value} 点`;
  if (c.couponType === "DISCOUNT_FEN") {
    const spend = c.minSpendFen > 0 ? `满 ¥${(c.minSpendFen / 100).toFixed(2)} 减` : "减";
    return `${spend} ¥${(c.value / 100).toFixed(2)}`;
  }
  return "";
}

function validityText(c: ClaimableCoupon): string {
  if (c.validDays > 0) return `领取后 ${c.validDays} 天内有效`;
  if (c.validTo) return `${c.validTo.slice(0, 10)} 前有效`;
  return "长期有效";
}

export function CouponEntryPopup() {
  const { loggedIn } = useAuth();
  const [items, setItems] = useState<ClaimableCoupon[]>([]);
  const [claimingId, setClaimingId] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loggedIn) {
      setItems([]);
      return;
    }
    listClaimableCoupons()
      .then((res) => {
        const data = res?.data || [];
        const sig = data.map((c) => c.templateId).sort().join(",");
        if (data.length > 0 && dismissedSignature() !== sig) {
          setItems(data);
          track("coupon_popup_view");
        }
      })
      .catch(() => {});
  }, [loggedIn]);

  const close = () => {
    markDismissed(items.map((c) => c.templateId).sort().join(","));
    setItems([]);
  };

  const claim = async (c: ClaimableCoupon) => {
    setClaimingId(c.templateId);
    setErr("");
    try {
      await claimCoupon(c.templateId);
      track("coupon_claim", { source: "entry_popup", type: c.couponType });
      setItems((prev) => prev.filter((i) => i.templateId !== c.templateId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "领取失败，稍后再试");
    } finally {
      setClaimingId("");
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={close}>
      <div
        className="ink-in w-full max-w-sm rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">有福利可领取</h3>
            <p className="mt-0.5 text-xs text-ink-faint">领取后即可使用</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={close}
            className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-3"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {items.map((c) => (
            <div key={c.templateId} className="flex items-center gap-3 rounded-xl bg-paper-2 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {valueText(c)} · {validityText(c)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => claim(c)}
                disabled={claimingId === c.templateId}
                className="shrink-0 rounded-xl bg-vermilion px-4 py-2 text-xs font-semibold text-paper disabled:opacity-60"
              >
                {claimingId === c.templateId ? "领取中…" : "领取"}
              </button>
            </div>
          ))}
        </div>

        {err ? <p className="mt-2 text-xs text-vermilion-deep">{err}</p> : null}

        <Link
          to="/coupons"
          onClick={close}
          className="mt-4 block rounded-xl border border-ink/10 py-2.5 text-center text-sm font-medium text-ink-soft transition-colors hover:bg-paper-3"
        >
          查看我的券
        </Link>
      </div>
    </div>
  );
}
