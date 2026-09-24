/**
 * 小程序 web-view 免登录交接：URL 上的一次性票据 mp_ticket 换本站登录态。
 * 小程序读不到 web-view 的 localStorage、也注入不了 cookie/请求头，URL 是唯一通道。
 * 票据由后端 getAndDelete 保证一次性（120 秒有效），所以取出后立刻从地址栏抹掉——
 * 否则会被 wx-share 的 location.href 分享出去，或经 /login?redirect= 再兜一圈带走。
 */
import { api } from "./api";
import { saveAuth } from "./auth";

const PARAM = "mp_ticket";

/** 票据在模块加载时（早于 createRouter 与一切 effect/渲染）就摘走，这里只留值。 */
const pendingTicket = takeTicketFromUrl();

function takeTicketFromUrl(): string {
  if (typeof window === "undefined") return "";
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return "";
  }
  const ticket = url.searchParams.get(PARAM) || "";
  if (!ticket) return "";
  url.searchParams.delete(PARAM);
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search + url.hash,
  );
  return ticket;
}

interface HandoffAuth {
  jwtToken?: string;
  userId?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tokenBalance?: number | null;
  hasBazi?: boolean | null;
}

/**
 * 兑换票据并写入登录态（saveAuth 的订阅会让页头昵称/点数即时刷新，无需刷新页面）。
 * 本地已有登录态时同样以票据为准（两端强一致，小程序侧说了算）；
 * 任何失败都静默——票据过期/已用过/后端不可用时，页面保持匿名照常可用。
 */
export async function redeemMpHandoffTicket(): Promise<void> {
  if (!pendingTicket) return;
  try {
    const res = await api<HandoffAuth>("/api/v1/users/wechat/web-handoff-consume", {
      method: "POST",
      data: { ticket: pendingTicket },
      auth: false,
    });
    if (!res?.jwtToken || !res.userId) return;
    saveAuth({
      jwtToken: res.jwtToken,
      userId: res.userId,
      displayName: res.displayName,
      avatarUrl: res.avatarUrl,
      tokenBalance: res.tokenBalance,
      hasBazi: res.hasBazi,
    });
  } catch {
    /* 静默：不弹错、不打扰，匿名浏览不受影响 */
  }
}
