/**
 * 扫码直购面板：选点数档 → 微信扫该档位专属码（bindUserId+productId 随票据携带）→
 * 小程序内支付入账当前登录账号 → 本面板轮询余额，到账自动提示。
 * 微信浏览器内（wechat-h5）优先走服务号 JSAPI 直付，无需跳小程序。
 *
 * includePasses=true 时额外列出两个畅享档（24 小时/包月）：它们不走现金下单，
 * 直接用点数余额开通（POST /api/v1/naming/pass/purchase-points），与起名页同一套口径。
 * 小程序原生充值页仍只卖点数档（合规口径），所以畅享档只出现在网页端充值面板。
 */
import { useEffect, useRef, useState } from "react";
import { post, get } from "@/lib/api";
import { getAuthUser, useAuth } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { startOfficialOAuth } from "@/lib/official-oauth";
import { track } from "@/lib/track";
import { invokeWxJsapiPay } from "@/lib/wx-pay";
import { useQrEnv, type QrEnv } from "@/lib/qr-env";
import { openMpRechargePage } from "@/lib/mp-bridge";

/** 二维码旁的操作提示：按打开环境分档（小程序内点按钮 / 微信内直付 / 手机浏览器扫码 / 电脑用手机扫） */
const QR_HINT: Record<QrEnv, string> = {
  mp: "点击下方按钮 → 在小程序内完成支付（也可长按左侧二维码），点数直接充入当前账号，到账后这里会自动提示。",
  "wechat-h5":
    "长按左侧二维码前往小程序支付，点数充入当前账号，到账后这里会自动提示。",
  mobile:
    "微信扫一扫左侧二维码支付所选点数（也可在微信里点下方链接），点数直接充入当前账号，到账后这里会自动提示。",
  desktop:
    "请用手机微信扫一扫左侧二维码支付所选点数，点数直接充入当前账号，到账后这里会自动提示。",
};

/** 支付入口样式：小程序内是按钮（桥接跳原生页），其它环境是链接（URL Link），共用一份 */
const PAY_BTN_CLS =
  "mt-2 inline-block rounded-lg bg-vermilion px-4 py-1.5 text-[11px] font-semibold text-paper";

interface Sku {
  productId: string;
  title?: string;
  tag?: string;
  credits?: number;
  priceFen?: number;
  kind?: string; // POINTS | DAY_PASS | MONTH_PASS（缺省视为 POINTS）
}

/** 畅享权益状态（GET /api/v1/naming/pass/status）：本面板只用点数价格与生效状态。 */
type PassStatus = {
  active?: boolean;
  passType?: string;
  expiresAtEpochMs?: number;
  dayPricePoints?: number;
  monthPricePoints?: number;
};

function yuan(priceFen?: number): string {
  const fen = priceFen ?? 0;
  const v = fen / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function ScanBuyPanel({
  trackWhere = "scan_buy",
  includePasses = false,
}: {
  trackWhere?: string;
  includePasses?: boolean;
}) {
  const qrEnv = useQrEnv();
  const { loggedIn } = useAuth();
  const [skus, setSkus] = useState<Sku[] | null>(null);
  const [selected, setSelected] = useState("");
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [ticket, setTicket] = useState("");
  const [mpHint, setMpHint] = useState("");
  // 到账提示：点数增加（只提示一次，随后停止轮询）
  const [arrived, setArrived] = useState<number | null>(null);
  // 微信内直付（服务号 JSAPI）状态
  const [payBusy, setPayBusy] = useState(false);
  const [payHint, setPayHint] = useState("");
  // 畅享档（includePasses 时展示）：点数价格、开通状态
  const [passInfo, setPassInfo] = useState<PassStatus | null>(null);
  const [passBusy, setPassBusy] = useState<"" | "DAY" | "MONTH">("");
  const [passHint, setPassHint] = useState("");
  // 通道可用性：后端私钥不可读/未配置时压根不显示直付按钮，避免点了只报错
  const [h5Pay, setH5Pay] = useState(false);
  const baseBalanceRef = useRef<number | null>(null);

  const list = skus ?? [];
  const pointTiers = list.filter((s) => !s.kind || s.kind === "POINTS");
  const passTiers = includePasses
    ? list.filter((s) => s.kind === "DAY_PASS" || s.kind === "MONTH_PASS")
    : [];
  const selectedSku = list.find((s) => s.productId === selected);
  const selectedIsPass =
    selectedSku?.kind === "DAY_PASS" || selectedSku?.kind === "MONTH_PASS";

  const passLabel = (s: Sku) => (s.kind === "MONTH_PASS" ? "包月畅享" : "24 小时畅享");
  const passDesc = (s: Sku) =>
    s.kind === "MONTH_PASS" ? "30 天内生成与换批不限次" : "24 小时内生成与换批不限次";
  const passPoints = (s: Sku) =>
    s.kind === "MONTH_PASS"
      ? (passInfo?.monthPricePoints ?? 100)
      : (passInfo?.dayPricePoints ?? 40);

  /** 畅享档：点数余额直购（与起名页「用点数开通」同一接口），不产生现金订单。 */
  const buyPass = async () => {
    if (!selectedSku || passBusy) return;
    const passType = selectedSku.kind === "MONTH_PASS" ? "MONTH" : "DAY";
    if (!getAuthUser()?.userId) {
      setPassHint("请先登录后再用点数开通");
      return;
    }
    setPassBusy(passType);
    setPassHint("");
    try {
      const res = await post<{ expiresAt?: string; coinsDeducted?: number }>(
        "/api/v1/naming/pass/purchase-points",
        { passType },
      );
      track("naming_pass_purchased", { passType, where: trackWhere, via: "points" });
      const until = res?.expiresAt ? res.expiresAt.replace("T", " ").slice(0, 16) : "";
      setPassHint(
        "已开通" +
          (until ? "，有效期至 " + until : "") +
          (res?.coinsDeducted ? "（扣 " + res.coinsDeducted + " 点）" : ""),
      );
      setPassInfo((prev) => ({ ...(prev || {}), active: true, passType }));
      // 页面下方的「我的套餐与畅享」可能已缓存过旧状态，通知它清缓存重拉
      window.dispatchEvent(new Event("dm:pass-changed"));
      const b = await refreshBalance();
      if (b != null) baseBalanceRef.current = b;
    } catch (e) {
      const status = (e as Error & { statusCode?: number }).statusCode;
      setPassHint(
        status === 402
          ? "点数余额不足，请先在上方充值点数"
          : e instanceof Error
            ? e.message
            : "开通失败，请重试",
      );
    } finally {
      setPassBusy("");
    }
  };

  /**
   * 微信内直付：未登录先静默 OAuth 取 openid（回本页），已登录则下单 → WeixinJSBridge 拉起收银台。
   * 成功后余额轮询兜底确认到账（与扫码购买同一套感知逻辑）。
   */
  const wechatH5Pay = async () => {
    setPayHint("");
    if (!selected) return;
    if (!getAuthUser()?.userId) {
      const ok = await startOfficialOAuth(window.location.pathname + window.location.search);
      if (!ok) setPayHint("请先在微信内打开本页并允许授权，或使用下方二维码支付");
      return;
    }
    setPayBusy(true);
    track("h5_pay_start", { productId: selected, where: trackWhere });
    try {
      const res = await post<{ orderId?: string; payParams?: Record<string, string> }>(
        "/api/v1/payments/client/wechat/h5-order",
        { productId: selected },
      );
      if (!res?.payParams) throw new Error("下单失败，请稍后重试");
      const result = await invokeWxJsapiPay(res.payParams as never);
      if (result === "ok") {
        setPayHint("支付成功，点数到账确认中…");
        track("h5_pay_success", { productId: selected, orderId: res.orderId });
        const b = await refreshBalance();
        if (b != null && baseBalanceRef.current != null && b > baseBalanceRef.current) {
          setArrived(b - baseBalanceRef.current);
        }
        if (b != null) baseBalanceRef.current = b;
      } else if (result === "cancel") {
        setPayHint("已取消支付，可重新发起");
      } else {
        setPayHint("未能唤起微信支付，请长按下方二维码在小程序内支付");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "下单失败，请稍后重试";
      setPayHint(msg);
      track("h5_pay_fail", { productId: selected });
      // 老账号可能从未走过公众号授权（无 official_open_id）：静默补一次授权回来即可支付
      if (msg.includes("公众号支付身份")) {
        await startOfficialOAuth(window.location.pathname + window.location.search);
      }
    } finally {
      setPayBusy(false);
    }
  };

  useEffect(() => {
    get<Sku[]>("/api/v1/payments/client/virtual/products", {}, { auth: false, timeoutMs: 6000 })
      .then((res) => {
        const arr = Array.isArray(res) ? res : [];
        setSkus(arr);
        const first = arr.find((s) => !s.kind || s.kind === "POINTS") || arr[0];
        if (first) setSelected(first.productId);
      })
      .catch(() => setSkus([]));
    // 基线余额（到账判定与「+N 点」差额都以此为准）
    refreshBalance().then((b) => {
      if (b != null) baseBalanceRef.current = b;
    });
    // 支付通道可用性（公开只读）：私钥缺失时后端返回 false，前端据此不渲染直付入口
    get<{ wxH5Pay?: boolean }>("/api/v1/payments/client/channels", {}, { auth: false, timeoutMs: 6000 })
      .then((c) => setH5Pay(!!c?.wxH5Pay))
      .catch(() => setH5Pay(false));
  }, []);

  // 畅享档价格/生效状态：登录后拉一次（价格来自后台配置，缺省 40 / 100 点）
  useEffect(() => {
    if (!includePasses || !loggedIn) return;
    get<PassStatus>("/api/v1/naming/pass/status", {}, { timeoutMs: 6000 })
      .then((r) => setPassInfo(r || null))
      .catch(() => {});
  }, [includePasses, loggedIn]);

  // 选中档位 → 生成专属动态码（携带账号绑定 + 套餐预选）；畅享档走点数开通，不出码
  useEffect(() => {
    if (!selected) return;
    setQr("");
    setLink("");
    setTicket("");
    setMpHint("");
    setPassHint("");
    if (selectedIsPass) return;
    post<{ qrCodeBase64?: string; urlLink?: string; ticket?: string }>(
      "/api/v1/users/wechat/login-ticket",
      {
        mpSource: "self",
        pagePath: "pages/mine/recharge",
        bindUserId: getAuthUser()?.userId,
        productId: selected,
      },
    )
      .then((r) => {
        if (r?.qrCodeBase64) setQr(r.qrCodeBase64);
        if (r?.urlLink) setLink(r.urlLink);
        // 站内（小程序 web-view）也复用这张票：跳转时带上，充值页据它入账当前账号并预选档位
        if (r?.ticket) setTicket(r.ticket);
      })
      .catch(() => {});
  }, [selected, selectedIsPass]);

  // 支付到账感知：轮询点数余额
  useEffect(() => {
    const timer = setInterval(async () => {
      if (arrived == null) {
        const b = await refreshBalance();
        if (b != null) {
          if (baseBalanceRef.current != null && b > baseBalanceRef.current) {
            setArrived(b - baseBalanceRef.current);
          }
          baseBalanceRef.current = b;
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [arrived]);

  return (
    <div className="space-y-3">
      {arrived != null ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          已到账 +{arrived} 点，可直接继续使用
        </p>
      ) : null}

      {pointTiers.length ? (
        <div>
          <p className="text-[11px] font-medium text-ink-faint">点数档位</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {pointTiers.map((s) => (
              <button
                key={s.productId}
                onClick={() => setSelected(s.productId)}
                className={
                  "rounded-xl p-2.5 text-left transition-colors " +
                  (selected === s.productId
                    ? "bg-vermilion-wash"
                    : "bg-paper-3 hover:bg-vermilion-wash")
                }
              >
                <p className="text-sm font-bold text-ink">{s.credits ?? ""} 点</p>
                <p className="mt-0.5 text-xs font-semibold text-vermilion-deep">¥{yuan(s.priceFen)}</p>
                {s.tag ? <p className="mt-0.5 text-xs text-ink-faint">{s.tag}</p> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {passTiers.length ? (
        <div>
          <p className="text-[11px] font-medium text-ink-faint">畅享档位（用点数开通）</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {passTiers.map((s) => (
              <button
                key={s.productId}
                onClick={() => setSelected(s.productId)}
                className={
                  "rounded-xl p-2.5 text-left transition-colors " +
                  (selected === s.productId
                    ? "bg-vermilion-wash"
                    : "bg-paper-3 hover:bg-vermilion-wash")
                }
              >
                <p className="text-sm font-bold text-ink">{passLabel(s)}</p>
                <p className="mt-0.5 text-xs font-semibold text-vermilion-deep">{passPoints(s)} 点</p>
                <p className="mt-0.5 text-xs text-ink-faint">{passDesc(s)}</p>
              </button>
            ))}
          </div>
          {selectedSku && selectedIsPass ? (
            <div className="mt-2 rounded-xl bg-amber-50 p-3">
              <p className="text-xs leading-relaxed text-amber-900">
                {passDesc(selectedSku)}，开通后立即生效，不再按次扣点。
              </p>
              <button
                type="button"
                disabled={passBusy !== ""}
                onClick={buyPass}
                className="mt-2 w-full rounded-lg bg-amber-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:opacity-60"
              >
                {passBusy ? "开通中…" : `用 ${passPoints(selectedSku)} 点开通`}
              </button>
              {passHint ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-900">{passHint}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {qrEnv === "wechat-h5" && h5Pay && !selectedIsPass ? (
        <div className="rounded-xl bg-paper-3 p-3">
          <button
            type="button"
            disabled={payBusy || !selected}
            onClick={wechatH5Pay}
            className="w-full rounded-lg bg-vermilion py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {payBusy
              ? "发起支付中…"
              : selectedSku
                ? `微信内直接支付 ¥${yuan(selectedSku.priceFen)}`
                : "微信内直接支付"}
          </button>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {payHint || "无需跳转小程序：一路微信支付，点数直接充入当前账号。"}
          </p>
        </div>
      ) : null}

      {!selectedIsPass ? (
        <div className="flex items-center gap-3 rounded-xl bg-paper-3 p-3">
          <img
            src={qr || "/mp-qrcode.jpg"}
            alt="对脉名鉴小程序支付码"
            className="size-24 shrink-0 rounded-lg bg-paper-3"
            onClick={() => track("mp_qr_click", { where: trackWhere })}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-ink-soft">{mpHint || QR_HINT[qrEnv]}</p>
            {qrEnv === "mp" ? (
              <button
                type="button"
                className={PAY_BTN_CLS}
                onClick={async () => {
                  // 站内直接用桥接跳到原生充值页：web-view 里打不开 URL Link，点链接只会卡加载
                  if (!(await openMpRechargePage(ticket))) {
                    setMpHint("当前小程序版本较旧：请长按左侧二维码完成支付");
                  }
                }}
              >
                去小程序支付
              </button>
            ) : (
              <a href={link || "weixin://"} className={PAY_BTN_CLS}>
                去小程序支付
              </a>
            )}
          </div>
        </div>
      ) : null}
      {skus === null ? <p className="text-xs text-ink-faint">档位加载中…</p> : null}
      {skus !== null && !list.length ? (
        <p className="text-xs text-ink-faint">档位暂不可用，可稍后重试或在小程序内购买</p>
      ) : null}
    </div>
  );
}
