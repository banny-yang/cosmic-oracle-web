/**
 * 长尾矩阵页面的共享版块：名字卡（带姓氏搭配展示）与内链 chips。
 * 结构与姓氏×生肖页的 PairedNameCards 一致，避免五类长尾页各自长出一套卡片样式。
 */
import { Link } from "@tanstack/react-router";
import type { GalleryName } from "@/lib/seo/data";

export const sectionTitle = "text-lg font-semibold";
export const ghostCls =
  "rounded-xl bg-paper-3 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash";

export function LinkChips({
  links,
}: {
  links: { label: string; to: string; params?: Record<string, string> }[];
}) {
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.to + JSON.stringify(l.params ?? {})}
          to={l.to}
          {...(l.params ? { params: l.params } : {})}
          className="rounded-full bg-paper-3 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-vermilion-wash hover:text-vermilion-deep"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export function LongtailNameCards({
  surname,
  names,
}: {
  /** 展示在名字前的搭配姓氏；典籍/五行页传 undefined 直出名。 */
  surname?: string;
  names: GalleryName[];
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {names.map((n) => (
        <div
          key={n.word}
          className="rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-seal text-3xl leading-none text-ink">
                {surname ? <span className="text-ink-soft">{surname} · </span> : null}
                {n.word}
              </p>
              {n.pinyin ? (
                <p className="mt-1.5 text-xs tracking-wider text-ink-soft">{n.pinyin}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {n.gender === "M" ? (
                <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">
                  男
                </span>
              ) : n.gender === "F" ? (
                <span className="rounded-full bg-vermilion px-2 py-0.5 text-[11px] font-medium text-paper">
                  女
                </span>
              ) : null}
              {typeof n.score === "number" ? (
                <span className="rounded-full bg-vermilion-wash px-2 py-0.5 text-[11px] font-semibold text-vermilion-deep">
                  {n.score} 分
                </span>
              ) : null}
            </div>
          </div>
          {n.meaning ? (
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">{n.meaning}</p>
          ) : null}
          {n.text || n.source ? (
            <div className="mt-3 rounded-xl bg-paper-2 p-3">
              {n.text ? (
                <p className="text-sm leading-relaxed text-ink-soft text-pretty">{n.text}</p>
              ) : null}
              {n.source ? <p className="mt-1 text-xs text-ink-faint">—— {n.source}</p> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
