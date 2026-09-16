/**
 * AI 解读 think/正文流状态（六爻 / 奇门共用）。
 * 后端把 thinking/answer 两种增量交替下发，且 <think> 标签跨 token 断裂时残片会漏进
 * answer——本 hook 把两种增量全量缓存在原始缓冲上重算 think 边界（App 端
 * parseDifyStreamBuffer 的同职责实现）：解析到 </think> 即收起 think，正文为其余部分。
 */
import { useRef, useState } from "react";

export interface ThinkStreamState {
  think: string;
  /** true=思考中（首行显示 think）；false=思考结束（隐藏 think） */
  thinkLive: boolean;
  visible: string;
}

function derive(raw: string): ThinkStreamState {
  const close = raw.lastIndexOf("</think>");
  if (close >= 0) {
    const open = raw.indexOf("<think>");
    const think = (open >= 0 ? raw.slice(open + 7, close) : raw.slice(0, close)).trim();
    return { think, thinkLive: false, visible: raw.slice(close + 8) };
  }
  const open = raw.indexOf("<think>");
  if (open >= 0) {
    return { think: raw.slice(open + 7).trim(), thinkLive: true, visible: "" };
  }
  return { think: "", thinkLive: false, visible: raw };
}

export function useThinkStream() {
  const [state, setState] = useState<ThinkStreamState>({
    think: "",
    thinkLive: false,
    visible: "",
  });
  const raw = useRef("");

  /** 追加一个流式增量（thinking / answer 任一可空） */
  const push = (thinking: unknown, answer: unknown) => {
    const th = typeof thinking === "string" ? thinking : "";
    const an = typeof answer === "string" ? answer : "";
    if (!th && !an) return;
    raw.current += th + an;
    setState(derive(raw.current));
  };

  /** 直接设定全文（非流式来源，如 RAG 卦辞） */
  const setText = (text: string) => {
    raw.current = text;
    setState(derive(text));
  };

  const reset = () => {
    raw.current = "";
    setState({ think: "", thinkLive: false, visible: "" });
  };

  return { ...state, push, setText, reset };
}
