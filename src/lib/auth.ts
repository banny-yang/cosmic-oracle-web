/**
 * 登录态（localStorage + 订阅通知）。
 * token 与用户摘要由登录页写入；401 时由 api 层清除。
 */
import { useSyncExternalStore } from "react";

export interface AuthUser {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  tokenBalance?: number;
}

const KEY = "dm_token";
const USER_KEY = "dm_user";

let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY) || "";
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function authSnapshot(): string {
  return getToken() + "|" + (getAuthUser()?.displayName || "");
}

/** React hook：登录态变化时触发重渲染 */
export function useAuth() {
  const snapshot = useSyncExternalStore(subscribeAuth, authSnapshot, () => "");
  const token = snapshot.split("|")[0] || "";
  return { loggedIn: !!token, token, user: getAuthUser() };
}

/** 登录成功统一写入（三种登录方式共用） */
export function saveAuth(res: {
  jwtToken: string;
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tokenBalance?: number | null;
  hasBazi?: boolean | null;
}) {
  localStorage.setItem(KEY, res.jwtToken);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      userId: res.userId,
      displayName: res.displayName || "",
      avatarUrl: res.avatarUrl || "",
      tokenBalance: res.tokenBalance ?? 0,
    }),
  );
  emit();
}

/** 静默续期：只换 token，保留本地用户摘要（滑动续期，让登录态长期有效）。 */
export function updateToken(jwtToken: string) {
  if (!jwtToken) return;
  localStorage.setItem(KEY, jwtToken);
  emit();
}

export function updateUser(patch: Partial<AuthUser>) {
  const u = getAuthUser();
  if (!u) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...u, ...patch }));
  emit();
}

export function clearAuth() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(USER_KEY);
  emit();
}
