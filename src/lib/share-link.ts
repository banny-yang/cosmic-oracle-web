/**
 * 分享链接的邀请归因（src 记渠道，ref 记邀请人短号）。
 *
 * 为什么要有这个模块：站内分享此前只拼 ?src=，落地用户注册/首次起名时后端
 * 拿不到邀请人，邀请奖励链路永远不触发。这里在登录后把「我的邀请码」预取一次
 * 缓存下来，分享时同步拼进链接——复制/分享动作必须保持同步，一旦在点击回调里
 * await，Safari 会判定剪贴板手势授权已失效。
 *
 * 缓存按 userId 分桶：同一台设备换账号登录，不会把上一个账号的邀请码分享出去。
 */
import { get } from "./api";
import { getAuthUser } from "./auth";
import { withRef, withSrc, type SrcTag } from "./src-tag";

const REF_KEY = "dm_myref";

let cached = "";
let loading: Promise<string> | null = null;

/** 当前账号的邀请短号（同步读，缺失返回空串）。 */
export function shareRef(): string {
  if (typeof window === "undefined") return "";
  const userId = getAuthUser()?.userId;
  if (!userId) return "";
  if (cached && cached.startsWith(userId + ":")) return cached.slice(userId.length + 1);
  let raw = "";
  try {
    raw = localStorage.getItem(REF_KEY) || "";
  } catch {
    return "";
  }
  return raw.startsWith(userId + ":") ? raw.slice(userId.length + 1) : "";
}

/** 登录态下预取邀请码（幂等、单飞；失败静默——分享链接退回只带 src）。 */
export function preloadShareRef(): void {
  if (typeof window === "undefined") return;
  const userId = getAuthUser()?.userId;
  if (!userId || shareRef() || loading) return;
  loading = get<{ inviteCode?: string | number }>("/api/v1/ops/invite")
    .then((r) => {
      const code = r?.inviteCode == null ? "" : String(r.inviteCode).trim();
      if (code) {
        cached = `${userId}:${code}`;
        try {
          localStorage.setItem(REF_KEY, cached);
        } catch {
          /* 隐私模式写不进去：本次会话内存里仍然有效 */
        }
      }
      return code;
    })
    .catch(() => "")
    .finally(() => {
      loading = null;
    });
}

/** 分享链接：渠道标记 + 邀请人短号（未登录/未取到邀请码时只带 src）。 */
export function withAttribution(url: string, src: SrcTag): string {
  const ref = shareRef();
  if (!ref) {
    // 首次分享可能还没取到邀请码：顺手触发一次，下一次分享就带上
    preloadShareRef();
    return withSrc(url, src);
  }
  return withRef(withSrc(url, src), ref);
}
