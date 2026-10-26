/**
 * 站外引流打标（建议 #4）：微信内分享会剥掉 referrer，来源只有靠链接自带的
 * ?src= 才留得下来。取值收敛在白名单里，原因有两条：
 *
 * 1. /naming 的 ?src= 是「典籍类目码」（如 shijing），不做白名单会把类目码
 *    误当渠道、也会把渠道名塞进类目筛选；
 * 2. 只有白名单值才从地址栏摘走，杂参数一律原样留着。
 *
 * 采到的值落 localStorage dm_src，注册时由 attribution 作为 channel 上报
 * （后端 t_user.register_channel 首写生效），PV 埋点也带上 src 便于分渠道看访问。
 */

export const SRC_VALUES = ["wx", "baidu", "zhihu", "poster", "share", "mp", "vote"] as const;
export type SrcTag = (typeof SRC_VALUES)[number];

const SRC_KEY = "dm_src";

export function isSrcTag(v: string | null | undefined): v is SrcTag {
  return !!v && (SRC_VALUES as readonly string[]).includes(v);
}

const captured: SrcTag | "" = captureFromUrl();

function captureFromUrl(): SrcTag | "" {
  if (typeof window === "undefined") return "";
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return "";
  }
  const raw = (url.searchParams.get("src") || "").trim();
  if (isSrcTag(raw)) {
    write(raw);
    url.searchParams.delete("src");
    try {
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* 地址栏改写失败不影响归因值 */
    }
    return raw;
  }
  return read();
}

function read(): SrcTag | "" {
  try {
    const v = window.localStorage.getItem(SRC_KEY);
    return isSrcTag(v) ? v : "";
  } catch {
    return "";
  }
}

function write(v: SrcTag) {
  try {
    window.localStorage.setItem(SRC_KEY, v);
  } catch {
    /* 隐私模式写不进去：只影响本次会话，不打断业务 */
  }
}

/** 当前访客的渠道标记（本次落地参数优先，其次上次留下的）。 */
export function currentSrcTag(): SrcTag | "" {
  return captured || read();
}

/**
 * 给站内/站外链接补 src 参数（已有同名参数则覆盖）。
 * 相对路径按当前 origin 补成绝对地址——分享出去的都是绝对链接。
 */
export function withSrc(url: string, src: SrcTag): string {
  try {
    const absolute = /^https?:\/\//i.test(url);
    const base =
      typeof window === "undefined" ? "https://name.duimai.net" : window.location.origin;
    const u = new URL(url, base);
    u.searchParams.set("src", src);
    // 传进来是相对路径就还回相对路径，避免首屏/客户端渲染出不同字符串
    return absolute ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

/** 分享渠道：微信内分享记 wx，其他环境记 share。 */
export function shareSrcTag(): SrcTag {
  if (typeof navigator === "undefined") return "share";
  return /MicroMessenger/i.test(navigator.userAgent) ? "wx" : "share";
}
