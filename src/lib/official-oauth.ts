/**
 * 微信内 H5（微信浏览器，非小程序）服务号网页授权登录：snsapi_base 静默授权，一次跳转换登录态。
 *
 * 与 mp-handoff 同一模式：code/state 在模块加载时（早于 createRouter 与一切 effect）就从地址栏
 * 摘走——授权码一次性、留在地址栏会被 wx-share 的 location.href 分享或经 ?redirect= 带走；
 * 由 __root 的 effect 调 redeemOfficialOAuthLogin() 兑换。任何失败都静默：页面保持匿名照常可用。
 */
import { get, post } from "./api";
import { saveAuth, getAuthUser } from "./auth";
import { isMiniProgramEnv } from "./mp-bridge";
import { loginAttribution } from "./attribution";

/** 微信内置浏览器且不在小程序 web-view 内——OAuth 网页授权唯一可用的环境。 */
export function isWeChatBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent) && !isMiniProgramEnv();
}

interface PendingOAuth {
  code: string;
  state: string;
}

/** 授权回调参数（如有）在模块加载时摘走，这里只留值。 */
const pending: PendingOAuth = takeOAuthParamsFromUrl();

function takeOAuthParamsFromUrl(): PendingOAuth {
  const empty: PendingOAuth = { code: "", state: "" };
  if (typeof window === "undefined") return empty;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return empty;
  }
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) return empty;
  const state = (url.searchParams.get("state") || "").trim();
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  try {
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    /* 地址栏改写失败不影响本次兑换 */
  }
  return { code, state };
}

interface OAuthLoginResponse {
  jwtToken?: string;
  userId?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tokenBalance?: number | null;
  hasBazi?: boolean | null;
}

/**
 * 兑换授权码并写入登录态（unionid 命中即合并为同账号，服务号 openid 落 official_open_id）。
 * 成功后若 state 指向与当前不同的页面（发起授权的页面），整页回到那一页；
 * 相同（或 state 缺失）时 saveAuth 的订阅会让页头昵称/点数即时刷新，无需跳转。
 */
export async function redeemOfficialOAuthLogin(): Promise<void> {
  if (!pending.code) return;
  const code = pending.code;
  pending.code = ""; // 授权码一次性：先消费，避免重复请求
  try {
    const res = await post<OAuthLoginResponse>(
      "/api/v1/users/wechat/official-oauth-login",
      { code, ...loginAttribution() },
      { auth: false },
    );
    if (!res?.jwtToken || !res.userId) return;
    saveAuth({
      jwtToken: res.jwtToken,
      userId: res.userId,
      displayName: res.displayName,
      avatarUrl: res.avatarUrl,
      tokenBalance: res.tokenBalance,
      hasBazi: res.hasBazi,
    });
    const target = pending.state;
    if (target && target.startsWith("/") && target !== window.location.pathname + window.location.search) {
      window.location.replace(target);
    }
  } catch {
    /* 静默：code 过期/已用过/后端不可用时，页面保持匿名照常可用 */
  }
}

let cachedAppId: string | null = null;

/** 服务号 appid（公开端点，缓存一次）：未配置时返回空串。 */
export async function fetchOfficialAppId(): Promise<string> {
  if (cachedAppId != null) return cachedAppId;
  try {
    const res = await get<{ configured?: boolean; appId?: string }>(
      "/api/v1/wechat/official/appid",
      {},
      { auth: false, timeoutMs: 6000 },
    );
    cachedAppId = res?.configured && res.appId ? res.appId : "";
  } catch {
    cachedAppId = "";
  }
  return cachedAppId;
}

/**
 * 发起 snsapi_base 网页授权：整页跳到微信，授权后带着 code 回到 origin+path（state 记住回跳路径）。
 * 已在微信浏览器内且后端配好公众号才有意义；调用方应先判 isWeChatBrowser()。
 */
export async function startOfficialOAuth(targetPath?: string): Promise<boolean> {
  if (typeof window === "undefined" || !isWeChatBrowser()) return false;
  const appId = await fetchOfficialAppId();
  if (!appId) return false;
  const here = window.location.pathname + window.location.search;
  const target = targetPath && targetPath.startsWith("/") ? targetPath : here;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  const redirectUri = url.toString();
  const authorize =
    "https://open.weixin.qq.com/connect/oauth2/authorize" +
    "?appid=" + encodeURIComponent(appId) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&response_type=code&scope=snsapi_base" +
    "&state=" + encodeURIComponent(target) +
    "#wechat_redirect";
  window.location.replace(authorize);
  return true;
}

/** 已登录则无需再走授权（返回用户 id 供调用方判断）。 */
export const officialOAuthLoggedIn = () => !!getAuthUser()?.userId;
