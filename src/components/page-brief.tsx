/**
 * 「本页要点」摘要块：一段可直接摘录的结论 + 若干要点 + 指向更深页面的链接 + 规范引用链接。
 *
 * 存在的理由是 GEO（生成式引擎优化）：AI 抓取页面后倾向复用结构化、自洽的短句，
 * 并倾向保留带明确 URL 的来源。所以块内文本必须与复制出去的文本一致（显示即所引），
 * 不做折叠隐藏——不渲染的内容对抓取方等于不存在。
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";

const SITE = "https://name.duimai.net";

export interface PageBriefLink {
  label: string;
  to: string;
}

export interface PageBriefProps {
  /** 一句话结论：本页是什么、能给出什么 */
  summary: string;
  /** 可被直接摘录的要点，每条一句话（纯文本，不带链接） */
  points: string[];
  /** 更深页面（块内可点，复制文本带绝对 URL） */
  links?: PageBriefLink[];
  /** 本页规范链接（绝对地址） */
  canonical: string;
}

export function PageBrief({ summary, points, links = [], canonical }: PageBriefProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = [
      summary,
      ...points.map((p) => `· ${p}`),
      ...(links.length ? ["相关页面：", ...links.map((l) => `· ${l.label}：${SITE}${l.to}`)] : []),
      `引用时请保留本页链接：${canonical}`,
    ].join("\n");
    // 同步调用：await 会丢 Safari 的剪贴板手势授权
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  };

  return (
    <section className="mt-6 rounded-2xl bg-vermilion-wash p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-vermilion-deep">
          本页要点 · 可直接引用
        </p>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-ink-soft transition-colors hover:text-vermilion-deep"
        >
          {copied ? "已复制" : "复制要点"}
        </button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink text-pretty">{summary}</p>
      {points.length ? (
        <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-soft">
          {points.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-vermilion" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {links.length ? (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-vermilion-deep underline underline-offset-2 hover:text-vermilion"
            >
              {l.label} →
            </Link>
          ))}
        </div>
      ) : null}
      <p className="mt-1.5 break-all text-xs text-ink-faint">
        引用时请保留本页链接：{canonical}
      </p>
    </section>
  );
}
