/**
 * SSE 流式 POST 客户端（fetch + ReadableStream，浏览器 EventSource 不支持 POST+Bearer）。
 * 协议与后端/小程序端一致：
 * - 起名流：`data:{"stage":...,"message"/"delta"/"data":...}`，终态 stage=result|error
 * - 报告流：`data:{"answer":"增量文本"}` / `{"close":"end"}` / `{"error":"msg"}`
 * 返回句柄可 abort；超时（无新事件的间隔）自动中断并 onError。
 */
import { apiBase } from "./api";
import { getToken } from "./auth";

export interface StreamHandle {
  abort: () => void;
}

export interface StreamOptions {
  path: string;
  data?: unknown;
  /** 任意两个事件之间的最大间隔（默认 300s，起名含 AI 生成较慢） */
  idleTimeoutMs?: number;
  onEvent: (obj: Record<string, unknown>) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export function streamPost(opts: StreamOptions): StreamHandle {
  const { path, data, idleTimeoutMs = 300_000, onEvent, onDone, onError } = opts;
  const controller = new AbortController();
  let aborted = false;

  const fail = (err: Error) => {
    if (aborted) return;
    aborted = true;
    controller.abort().catch?.(() => {});
    onError?.(err);
  };

  (async () => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fail(new Error("生成超时，请重试")), idleTimeoutMs);
    };
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      const token = getToken();
      if (token) headers.Authorization = "Bearer " + token;

      resetTimer();
      const res = await fetch(apiBase() + path, {
        method: "POST",
        headers,
        body: data !== undefined ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let message = `连接失败（${res.status}）`;
        try {
          const body = await res.json();
          if (body && (body.message || body.error)) message = body.message || body.error;
        } catch {
          // 非 JSON 错误体
        }
        fail(new Error(message));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        try {
          onEvent(JSON.parse(payload) as Record<string, unknown>);
        } catch {
          // 忽略无法解析的行
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(handleLine);
      }
      if (buffer) handleLine(buffer);
      if (timer) clearTimeout(timer);
      if (!aborted) {
        aborted = true;
        onDone?.();
      }
    } catch (e) {
      if (timer) clearTimeout(timer);
      if (!aborted) {
        aborted = true;
        onError?.(e instanceof Error ? e : new Error("连接中断"));
      }
    }
  })();

  return {
    abort: () => {
      if (aborted) return;
      aborted = true;
      controller.abort();
    },
  };
}
