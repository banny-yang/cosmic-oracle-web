/**
 * 容器/SSR 进程环境读取。
 * 部署时经环境变量注入后端地址（docker run -e API_BASE_URL=... 或 compose environment），
 * 优先级介于 window.__RUNTIME_CONFIG__ 与构建期 VITE_API_BASE_URL 之间；
 * 客户端 bundle 无 process，本函数恒返回 undefined（地址由 SSR 注入的脚本带回）。
 */
declare const process: { env?: Record<string, string | undefined> } | undefined;

export function runtimeApiBaseUrl(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env["API_BASE_URL"];
  if (!value || !value.trim()) return undefined;
  return value.trim().replace(/\/+$/, "");
}
