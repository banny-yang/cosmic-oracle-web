/**
 * 微信内置浏览器分享卡片配置（需后端已配置服务号 WECHAT_OFFICIAL_APP_ID/SECRET，
 * 且公众号 JS 安全域名包含 name.duimai.net）。非微信环境静默跳过。
 */
import { get } from "./api";
import { withAttribution } from "./share-link";

let ready = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

export async function setupWxShare(opts: { title: string; desc: string; link?: string; imgUrl?: string }) {
  if (typeof window === "undefined" || !/MicroMessenger/i.test(navigator.userAgent)) return;
  try {
    const wx = (window as any).wx;
    if (!wx) await loadScript("https://res.wx.qq.com/open/js/jweixin-1.6.0.js");
    const w = (window as any).wx;
    if (!w) return;
    const cfg = await get<any>("/api/v1/wechat/jssdk-config", { url: location.href }, { auth: false });
    if (!cfg?.appId) return;
    await new Promise<void>((resolve) => {
      w.config({
        debug: false,
        appId: cfg.appId,
        timestamp: cfg.timestamp,
        nonceStr: cfg.nonceStr,
        signature: cfg.signature,
        jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
      });
      w.ready(() => resolve());
      w.error(() => resolve());
    });
    const share = {
      title: opts.title,
      desc: opts.desc,
      // 微信分享会剥掉 referrer：链接自带的 src=wx 是唯一能留下来的来源标记；
      // 登录态下再补 ?ref=<短号>，让转发同时完成邀请归因
      link: withAttribution(opts.link || location.href, "wx"),
      imgUrl: opts.imgUrl || "https://name.duimai.net/og-card.jpg",
    };
    w.updateAppMessageShareData && w.updateAppMessageShareData(share);
    w.updateTimelineShareData && w.updateTimelineShareData({ ...share, title: share.title + " · " + share.desc });
    ready = true;
  } catch { /* 未配置公众号或网络异常：静默，不影响页面 */ }
}

export const wxShareReady = () => ready;
