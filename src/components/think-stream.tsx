/**
 * AI 解读流式渲染盒（六爻 / 奇门共用）：
 * - think 内容只在文本框第一行显示（单行截断 + 脉冲），思考结束（解析到 </think>）即隐藏；
 * - 正文走 MiniMarkdown 渲染。
 * think 解析为有状态全量重算：后端逐 token 清洗 <think> 时标签跨 token 断裂会漏残片
 * （与 App 端 parseDifyStreamBuffer 同职责），只有客户端在完整缓冲上重算才可靠。
 */
import { MiniMarkdown } from "@/components/report-flow";

export function ThinkAnswerBox({
  think,
  thinkLive,
  visible,
  placeholder = "正在推演…",
}: {
  think: string;
  thinkLive: boolean;
  visible: string;
  placeholder?: string;
}) {
  if (!visible && !thinkLive) return null;
  // think 是尾部追加增长的：首行只显示尾部（跑马灯式），截头部会让可见内容永远停在开头
  const thinkTail = think.length > 72 ? "…" + think.slice(-72) : think;
  return (
    <div className="ink-in rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
      {thinkLive ? (
        <p className="mb-3 flex items-center gap-2 pb-2 text-xs text-ink-faint">
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-vermilion" />
          <span className="truncate">{thinkTail || placeholder}</span>
        </p>
      ) : null}
      {visible ? <MiniMarkdown text={visible} /> : null}
    </div>
  );
}
