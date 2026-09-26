/**
 * 扫码直购面板：选套餐 → 微信扫该套餐专属码（bindUserId+productId 随票据携带）→
 * 小程序内支付入账当前登录账号 → 本面板轮询余额/畅享状态，到账自动提示。
 */
import { useEffect, useRef, useState } from "react";
import { post, get } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { refreshBalance } from "@/lib/balance";
import { track } from "@/lib/track";
import { useQrEnv, type QrEnv } from "@/lib/qr-env";
import { openMpRechargePage } from "@/lib/mp-bridge";

/** 二维码旁的操作提示：按打开环境分档（小程序内点按钮 / 手机浏览器扫码 / 电脑用手机扫） */
const QR_HINT: Record<QrEnv, string> = {
  mp: "点击下方按钮 → 在小程序内完成支付（也可长按左侧二维码），点数/畅享直接充入当前账号，到账后这里会自动提示。",
  mobile:
    "微信扫一扫左侧二维码支付所选套餐（也可在微信里点下方链接），点数/畅享直接充入当前账号，到账后这里会自动提示。",
  desktop:
    "请用手机微信扫一扫左侧二维码支付所选套餐，点数/畅享直接充入当前账号，到账后这里会自动提示。",
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

function yuan(priceFen?: number): string {
  const fen = priceFen ?? 0;
  const v = fen / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function ScanBuyPanel({ trackWhere = "scan_buy" }: { trackWhere?: string }) {
  const qrEnv = useQrEnv();
  const [skus, setSkus] = useState<Sku[] | null>(null);
  const [selected, setSelected] = useState("");
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [ticket, setTicket] = useState("");
  const [mpHint, setMpHint] = useState("");
  // 到账提示：点数增加 / 畅享开通（二者只提示一次，随后停止轮询对应项）
  const [arrived, setArrived] = useState<number | null>(null);
  const [passActive, setPassActive] = useState(false);
  const baseBalanceRef = useRef<number | null>(null);

  const list = skus ?? [];
  const pointTiers = list.filter((s) => !s.kind || s.kind === "POINTS");
  const passTiers = list.filter((s) => s.kind === "DAY_PASS" || s.kind === "MONTH_PASS");
  const selectedSku = list.find((s) => s.productId === selected);
  const passMode = selectedSku?.kind === "DAY_PASS" || selectedSku?.kind === "MONTH_PASS";

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
  }, []);

  // 选中档位 → 生成专属动态码（携带账号绑定 + 套餐预选）
  useEffect(() => {
    if (!selected) return;
    setQr("");
    setLink("");
    setTicket("");
    setMpHint("");
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
  }, [selected]);

  // 支付到账感知：点数余额轮询；选中畅享卡时另轮询畅享状态
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
      if (passMode && !passActive) {
        get<{ active?: boolean }>("/api/v1/naming/pass/status", {}, { timeoutMs: 6000 })
          .then((p) => {
            if (p?.active) setPassActive(true);
          })
          .catch(() => {});
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [arrived, passMode, passActive]);

  return (
    <div className="space-y-3">
      {arrived != null ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          已到账 +{arrived} 点，可直接继续使用
        </p>
      ) : null}
      {passActive ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          畅享已开通，关闭本弹窗即可使用
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
                {s.tag ? <p className="mt-0.5 text-[10px] text-ink-faint">{s.tag}</p> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {passTiers.length ? (
        <div>
          <p className="text-[11px] font-medium text-ink-faint">宝宝起名畅享</p>
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
                <p className="text-sm font-bold text-ink">
                  {s.kind === "MONTH_PASS" ? "包月畅享" : "24 小时畅享"}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-vermilion-deep">¥{yuan(s.priceFen)}</p>
                <p className="mt-0.5 text-[10px] text-ink-faint">
                  {s.kind === "MONTH_PASS" ? "30 天不限次生成与换一批" : "24 小时不限次生成与换一批"}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-xl bg-paper-3 p-3">
        <img
          src={qr || "/mp-qrcode.jpg"}
          alt="对脉名鉴小程序支付码"
          className="size-24 shrink-0 rounded-lg bg-paper-3"
          onClick={() => track("mp_qr_click", { where: trackWhere })}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-relaxed text-ink-soft">{mpHint || QR_HINT[qrEnv]}</p>
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
      {skus === null ? <p className="text-[11px] text-ink-faint">档位加载中…</p> : null}
      {skus !== null && !list.length ? (
        <p className="text-[11px] text-ink-faint">档位暂不可用，可稍后重试或在小程序内购买</p>
      ) : null}
    </div>
  );
}
