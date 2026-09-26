/**
 * 小程序 web-view 内的桥接口。
 *
 * 微信平台规则：含 web-view 的页面不支持发起分享（朋友圈更不行，官方文档明列），
 * 加分享钩子也无效——页内因此不设任何分享入口。
 *
 * wx.miniProgram.* 是 web-view 的桥接 API，只需加载 JSSDK 脚本，不需要 wx.config 签名。
 */
const JSSDK_SRC = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
const MINE_PAGE = "/pages/mine/index";
const RECHARGE_PAGE = "/pages/mine/recharge";

function loadWxSdk(): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    const existing = (window as any).wx;
    if (existing && existing.miniProgram) return resolve(existing);
    const el = document.createElement("script");
    el.src = JSSDK_SRC;
    el.onload = () => resolve((window as any).wx || null);
    el.onerror = () => resolve(null);
    document.head.appendChild(el);
  });
}

/** 同步快判：微信 7.0.0+ 会在 web-view 的 UA 里带 miniProgram 标识 */
function uaHasMiniProgram(): boolean {
  if (typeof navigator === "undefined") return false;
  return /miniProgram/i.test(navigator.userAgent);
}

/**
 * 同步快判（不加载 JSSDK）：UA 标识或 web-view 注入的 __wxjs_environment。
 * 可用于首屏渲染的场景（如二维码旁的操作提示文案）。
 */
export function isMiniProgramEnv(): boolean {
  if (typeof window === "undefined") return false;
  return uaHasMiniProgram() || (window as any).__wxjs_environment === "miniprogram";
}

/**
 * 小程序环境判断：先看 UA（同步、最快），但 iOS 上 UA 有时不带该标识，
 * 再用官方推荐的两条途径兜底——window.__wxjs_environment，以及
 * wx.miniProgram.getEnv（JSSDK 只在微信内加载，普通浏览器不碰）。
 */
export async function detectMiniProgramEnv(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isMiniProgramEnv()) return true;
  if (!/MicroMessenger/i.test(navigator.userAgent)) return false;
  const wx = await loadWxSdk();
  const mp = wx?.["miniProgram"];
  if (!mp || !mp["getEnv"]) return false;
  return new Promise((resolve) => {
    try {
      mp["getEnv"]((res: any) => resolve(!!(res && res.miniprogram)));
    } catch {
      resolve(false);
    }
  });
}

/**
 * 跳到小程序原生「我的」页去设置微信头像/昵称。返回是否跳转成功。
 *
 * H5 侧拿不到微信头像昵称（官方已禁止静默获取，只能在小程序原生页用
 * chooseAvatar / nickname 弹层一键带出），所以这里只负责把用户送过去。
 * 该页是 tabBar 页，必须用 switchTab（navigateTo 会直接失败）；
 * 旧版本小程序里 JSSDK 加载不出来时返回 false，由调用方给兜底文案。
 */
export async function openMpProfilePage(): Promise<boolean> {
  const wx = await loadWxSdk();
  const mp = wx?.["miniProgram"];
  if (!mp || !mp["switchTab"]) return false;
  return new Promise((resolve) => {
    mp["switchTab"]({
      url: MINE_PAGE,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

/**
 * 站内 H5（小程序 web-view 内）直达小程序充值页。返回是否跳转成功。
 *
 * web-view 里微信不允许打开 URL Link / weixin://（点了只会卡在加载态），
 * 所以站内改走桥接 API 把小程序推到原生充值页——与扫网页充值码共用一张票据：
 * state（login-ticket 返回的 ticket）让充值页把支付入账网页账号并预选档位；
 * from=webview 让充值页支付成功后退回 H5（那边在轮询到账），
 * 而不是像扫码入口那样退出小程序。旧版本小程序忽略未知参数。
 * 充值页是普通页，用 navigateTo（tabBar 页才必须 switchTab）；
 * 加载不出 JSSDK 时返回 false，由调用方给兜底文案。
 */
export async function openMpRechargePage(state?: string): Promise<boolean> {
  const wx = await loadWxSdk();
  const mp = wx?.["miniProgram"];
  if (!mp || !mp["navigateTo"]) return false;
  const query = "?from=webview" + (state ? "&state=" + encodeURIComponent(state) : "");
  return new Promise((resolve) => {
    mp["navigateTo"]({
      url: RECHARGE_PAGE + query,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}
