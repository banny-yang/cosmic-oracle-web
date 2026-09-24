/**
 * 余额实时刷新：消费/入账后拉取 profile 最新点数写回登录态，
 * 页头余额（useAuth → tokenBalance）随之即时变化；
 * 顺带回写昵称/头像——登录态里的资料可能过期（小程序端改过、或首屏只带了 token），
 * 页头右上角的头像+昵称由此自动补齐。
 */
import { get } from "./api";
import { getAuthUser, updateUser } from "./auth";

export async function refreshBalance(): Promise<number | null> {
  const userId = getAuthUser()?.userId;
  if (!userId) return null;
  try {
    const p = await get<{
      tokenBalance?: number;
      displayName?: string | null;
      avatarUrl?: string | null;
    }>(`/api/v1/users/${userId}/profile`);
    const balance = Number(p.tokenBalance || 0);
    // 服务端为空时保留本地值（不把已设置好的昵称/头像抹掉）
    updateUser({
      tokenBalance: balance,
      ...(p.displayName ? { displayName: String(p.displayName) } : {}),
      ...(p.avatarUrl ? { avatarUrl: String(p.avatarUrl) } : {}),
    });
    return balance;
  } catch {
    return null;
  }
}
