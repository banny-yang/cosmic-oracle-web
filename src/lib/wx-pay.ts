/**
 * 微信内置浏览器 JSAPI 支付：用服务号 appid + openid 直接拉起微信收银台（不走小程序）。
 * WeixinJSBridge 是微信客户端在网页里注入的桥接对象；部分安卓机注入较晚，
 * 需等 WeixinJSBridgeReady 事件，超时兜底返回 false 由调用方给降级提示。
 */

export interface WxJsapiPayParams {
  appId?: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType?: string;
  paySign: string;
}

export type WxPayResult = "ok" | "cancel" | "fail" | "unavailable";

function bridgeReady(timeoutMs = 3000): Promise<any | null> {
  const w = window as any;
  if (w.WeixinJSBridge?.invoke) return Promise.resolve(w.WeixinJSBridge);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: any | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    document.addEventListener("WeixinJSBridgeReady", () => finish(w.WeixinJSBridge || null), { once: true });
    setTimeout(() => finish(w.WeixinJSBridge?.invoke ? w.WeixinJSBridge : null), timeoutMs);
  });
}

/** 唤起微信收银台；resolve 支付结果（ok=成功，cancel=用户取消，fail/unavailable=失败或环境不支持）。 */
export async function invokeWxJsapiPay(params: WxJsapiPayParams): Promise<WxPayResult> {
  if (typeof window === "undefined") return "unavailable";
  const bridge = await bridgeReady();
  if (!bridge) return "unavailable";
  return new Promise((resolve) => {
    try {
      bridge.invoke(
        "getBrandWCPayRequest",
        {
          appId: params.appId,
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType || "RSA",
          paySign: params.paySign,
        },
        (res: any) => {
          const msg = String(res?.err_msg || "");
          if (msg.endsWith(":ok")) resolve("ok");
          else if (msg.endsWith(":cancel")) resolve("cancel");
          else resolve("fail");
        },
      );
    } catch {
      resolve("fail");
    }
  });
}
