/**
 * 注册归因采集：把落地页 URL 上的分享参数在进入 SPA 前摘下来存本地，
 * 手机号登录/注册时随请求上报（后端 t_user.register_channel / register_referrer 首写生效）。
 *
 * - ?ref=（邀请码，即邀请人的短号）→ 上报 ref，后端顺带绑定邀请人
 * - ?ch= / ?utm_source= → 上报 channel；都没有时用 ?from=（海报二维码口径），再退到 "web"
 *
 * ref/ch 摘走的理由同 mp-handoff：留在地址栏会被 wx-share 的 location.href 分享出去，
 * 让下一位访问者莫名绑到别人的邀请码。from 不摘——海报口径的既有约定，其他统计也可能读它。
 */

const REF_KEY = "dm_ref";
const CH_KEY = "dm_ch";

interface Captured {
  ref: string;
  channel: string;
}

const captured: Captured = captureFromUrl();

function captureFromUrl(): Captured {
  const empty: Captured = { ref: "", channel: "" };
  if (typeof window === "undefined") return empty;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return empty;
  }
  const ref = (url.searchParams.get("ref") || "").trim();
  const channel = (
    url.searchParams.get("ch") ||
    url.searchParams.get("utm_source") ||
    url.searchParams.get("from") ||
    ""
  ).trim();

  if (ref || channel) {
    const before = read(REF_KEY);
    const beforeCh = read(CH_KEY);
    // 后点开的分享链接覆盖前一次：注册前最后一次触达才是有效归因
    if (ref && ref !== before) write(REF_KEY, ref);
    if (channel && channel !== beforeCh) write(CH_KEY, channel);
  }

  if (ref || url.searchParams.has("ch") || url.searchParams.has("utm_source")) {
    url.searchParams.delete("ref");
    url.searchParams.delete("ch");
    url.searchParams.delete("utm_source");
    try {
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* 地址栏改写失败不影响归因值 */
    }
  }

  return { ref: ref || read(REF_KEY), channel: channel || read(CH_KEY) };
}

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式等写不进去时只影响本次归因，不抛错打断登录 */
  }
}

/**
 * 登录/注册请求要带的归因字段：channel 缺省补 "web"（web 官网注册口径），
 * ref 没采到就不带，避免给后端塞空串。
 */
export function loginAttribution(): { channel: string; ref?: string } {
  const channel = captured.channel || read(CH_KEY) || "web";
  const ref = captured.ref || read(REF_KEY);
  return ref ? { channel, ref } : { channel };
}
