import { createFileRoute, Link } from "@tanstack/react-router";
import { track } from "@/lib/track";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { get } from "@/lib/api";
import { getToken, getAuthUser } from "@/lib/auth";

export const Route = createFileRoute("/records/")({
  component: RecordsPage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/records/" },
    ],
    meta: [
      { name: "robots", content: "noindex" },
      { title: "解析记录 · 对脉名鉴" },
      { name: "description", content: "查看历史起名方案与解析报告。" },
    ],
  }),
});

interface NamingLog {
  id: string;
  created_at: string;
  surname?: string | null;
  card_count?: number;
}

interface ReportItem {
  reportId: string;
  purchaseTime: string;
  reportType?: string;
  titleZh?: string;
  status?: string;
  partnerName?: string | null;
  reportContentMarkdown?: string;
}

const TYPE_TITLES: Record<string, string> = {
  COMPATIBILITY: "性格契合测评",
  NAME: "姓名解析",
  MARRIAGE_FIT: "八字合婚",
};
const SEALS: Record<string, string> = { COMPATIBILITY: "性", NAME: "析", MARRIAGE_FIT: "缘" };

function RecordsPage() {
  const [items, setItems] = useState<
    { kind: "naming" | "report"; id: string; time: string; raw: NamingLog | ReportItem }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    track("records_view");
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/records");
      return;
    }
    const uid = getAuthUser()?.userId;
    Promise.all([
      get<NamingLog[]>("/api/v1/naming/my-logs", { user_id: uid }).catch(() => []),
      get<ReportItem[]>("/api/v1/reports/my-reports", { user_id: uid }).catch(() => []),
    ]).then(([naming, reports]) => {
      const n = (Array.isArray(naming) ? naming : [])
        .filter((l) => l && l.id)
        .map((l) => ({ kind: "naming" as const, id: l.id, time: l.created_at || "", raw: l }));
      const r = (Array.isArray(reports) ? reports : [])
        .filter((x) => x && x.reportId)
        .map((x) => ({ kind: "report" as const, id: x.reportId, time: x.purchaseTime || "", raw: x }));
      setItems([...n, ...r].sort((a, b) => String(b.time).localeCompare(String(a.time))));
      setLoaded(true);
    });
  }, []);

  const time = (t: string) => (t ? t.replace("T", " ").slice(0, 16) : "");

  return (
    <AppShell>
      <PageHeader eyebrow="账号" title="解析记录" desc="起名方案与解析报告的历史记录。" />

      {!loaded ? (
        <div className="mt-7 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper-2 ring-1 ring-ink/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-7 rounded-2xl bg-paper-2 p-10 text-center ring-1 ring-ink/5">
          <p className="font-seal text-3xl text-ink-faint">析</p>
          <p className="mt-3 text-sm font-medium">暂无解析记录</p>
          <p className="mt-1 text-xs text-ink-faint">到「宝宝起名」体验生成吧</p>
          <Link to="/naming" className="mt-5 inline-block rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper">
            去起名
          </Link>
        </div>
      ) : (
        <div className="mt-7 space-y-3">
          {items.map((it) =>
            it.kind === "naming" ? (
              <Link
                key={"n" + it.id}
                to="/records/$id"
                params={{ id: it.id }}
                className="ink-in flex items-center gap-4 rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5 transition-transform active:scale-[0.99]"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink/85 font-seal text-lg text-paper">
                  {(it.raw as NamingLog).surname || "名"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{(it.raw as NamingLog).surname || ""}家 · 起名方案</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {(it.raw as NamingLog).card_count ?? 0} 个名字 · {time(it.time)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-vermilion/10 px-2.5 py-1 text-[11px] font-medium text-vermilion-deep">
                  详情
                </span>
              </Link>
            ) : (
              <div
                key={"r" + it.id}
                className="ink-in flex items-center gap-4 rounded-2xl bg-paper-2 p-4 ring-1 ring-ink/5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-stone-600/90 font-seal text-lg text-paper">
                  {SEALS[String((it.raw as ReportItem).reportType || "").toUpperCase()] || "析"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {(it.raw as ReportItem).titleZh ||
                      TYPE_TITLES[String((it.raw as ReportItem).reportType || "").toUpperCase()] ||
                      "解析报告"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {(it.raw as ReportItem).partnerName ? "对象：" + (it.raw as ReportItem).partnerName + " · " : ""}
                    {time(it.time)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    (it.raw as ReportItem).status === "FAILED"
                      ? "bg-vermilion/10 text-vermilion-deep"
                      : "bg-paper-3 text-ink-soft"
                  }`}
                >
                  {(it.raw as ReportItem).status === "FAILED" ? "失败" : (it.raw as ReportItem).reportContentMarkdown || (it.raw as ReportItem).status === "SUCCESS" ? "已生成" : "待生成"}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </AppShell>
  );
}
