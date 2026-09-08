/**
 * 后端 API 客户端（fetch 封装）。
 * - BASE 地址：运行时注入（生产 serve 脚本写 __RUNTIME_CONFIG__）→ 构建环境变量 → 本地 dev 后端
 * - JWT 自动附带；401 清登录态并带 redirect 跳登录页
 * - 错误统一抛 Error（.statusCode / .message 取后端 message）
 */
import { getToken, clearAuth } from "./auth";
import { runtimeApiBaseUrl } from "./runtime-env";

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: { API_BASE_URL?: string };
  }
}

export function apiBase(): string {
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.API_BASE_URL) {
    return window.__RUNTIME_CONFIG__.API_BASE_URL!;
  }
  const runtime = runtimeApiBaseUrl();
  if (runtime) return runtime;
  return import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080";
}

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (location.pathname !== "/login") {
    location.href = "/login?redirect=" + encodeURIComponent(location.pathname + location.search);
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
  /** false = 公开端点（登录/验证码等），不带 token 也不做 401 跳转 */
  auth?: boolean;
  timeoutMs?: number;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", data, auth = true, timeoutMs = 20000 } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(apiBase() + path, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError("网络连接失败，请稍后重试", 0);
  }
  clearTimeout(timer);

  if (res.status === 401 && auth) {
    clearAuth();
    redirectToLogin();
    throw new ApiError("登录已过期，请重新登录", 401);
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = await res.json();
      if (body && (body.message || body.error)) message = body.message || body.error;
    } catch {
      // 非 JSON 错误体
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const get = <T = unknown>(path: string, params: Record<string, unknown> = {}, opts: ApiOptions = {}) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return api<T>((qs ? path + (path.includes("?") ? "&" : "?") + qs : path), { ...opts, method: "GET" });
};

export const post = <T = unknown>(path: string, data?: unknown, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "POST", data });

export const patch = <T = unknown>(path: string, data?: unknown, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "PATCH", data });
