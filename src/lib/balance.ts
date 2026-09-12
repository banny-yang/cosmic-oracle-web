/**
 * 余额实时刷新：消费/入账后拉取 profile 最新点数写回登录态，
 * 页头余额（useAuth → tokenBalance）随之即时变化。
 */
import { get } from "./api";
import { getAuthUser, updateUser } from "./auth";

export async function refreshBalance(): Promise<number | null> {
  const userId = getAuthUser()?.userId;
  if (!userId) return null;
  try {
    const p = await get<{ tokenBalance?: number }>(`/api/v1/users/${userId}/profile`);
    const balance = Number(p.tokenBalance || 0);
    updateUser({ tokenBalance: balance });
    return balance;
  } catch {
    return null;
  }
}
