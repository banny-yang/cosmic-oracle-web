/**
 * 小程序 web-view 内的桥接口。
 *
 * 微信平台规则：含 web-view 的页面不支持发起分享（朋友圈更不行，官方文档明列），
 * 加分享钩子也无效。所以在这个环境里，分享只能交给小程序的原生页去做——
 * 这里只负责把用户送过去：小程序原生分享页 pages/share/index（不含 web-view，
 * 页内可在小程序里发起「发送给朋友 / 分享到朋友圈」）。
 *
 * wx.miniProgram.* 是 web-view 的桥接 API，只需加载 JSSDK 脚本，不需要 wx.config 签名。
 */
const JSSDK_SRC = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
const SHARE_PAGE = "/pages/share/index";
const MINE_PAGE = "/pages/mine/index";

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
 * 小程序环境判断：先看 UA（同步、最快），但 iOS 上 UA 有时不带该标识，
 * 再用官方推荐的两条途径兜底——window.__wxjs_environment，以及
 * wx.miniProgram.getEnv（JSSDK 只在微信内加载，普通浏览器不碰）。
 */
export async function detectMiniProgramEnv(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (uaHasMiniProgram()) return true;
  if ((window as any).__wxjs_environment === "miniprogram") return true;
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
 * 跳到小程序原生分享页。返回是否跳转成功；
 * 失败（旧版本小程序里还没有该页、JSSDK 加载不出来）时由调用方给出兜底文案。
 */
export async function openMpSharePage(): Promise<boolean> {
  const wx = await loadWxSdk();
  const mp = wx?.["miniProgram"];
  if (!mp || !mp["navigateTo"]) return false;
  return new Promise((resolve) => {
    mp["navigateTo"]({
      url: SHARE_PAGE,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
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
