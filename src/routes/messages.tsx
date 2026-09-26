import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { listMessages, markAllMessagesRead, type InboxMessage } from "@/lib/ops";
import { getToken } from "@/lib/auth";
import { track } from "@/lib/track";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "消息中心 · 对脉名鉴" },
      { name: "description", content: "查看活动通知、优惠券到账与召回提醒。" },
    ],
  }),
});

const TYPE_LABEL: Record<string, string> = {
  COUPON: "券",
  CAMPAIGN: "活动",
  RECALL: "提醒",
  SYSTEM: "通知",
};

const PAGE_SIZE = 20;

function MessagesPage() {
  const [items, setItems] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = (p: number) => {
    listMessages(p, PAGE_SIZE)
      .then((res) => {
        setItems(res?.data || []);
        setTotal(res?.total ?? 0);
        setUnread(res?.unread ?? 0);
        setPage(res?.page || p);
        setLoaded(true);
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoaded(true);
      });
  };

  useEffect(() => {
    track("messages_view");
    if (!getToken()) {
      location.href = "/login?redirect=" + encodeURIComponent("/messages");
      return;
    }
    load(1);
  }, []);

  const readAll = async () => {
    setMarking(true);
    setErr("");
    try {
      await markAllMessagesRead();
      setUnread(0);
      setItems((list) => list.map((m) => ({ ...m, read: true })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setMarking(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const time = (t: string | null) => (t ? t.replace("T", " ").slice(0, 16) : "");

  return (
    <AppShell>
      <PageHeader eyebrow="账号" title="消息中心" desc="活动通知、优惠券到账与召回提醒。" />

      {unread > 0 ? (
        <div className="ink-in d1 mt-6 flex items-center justify-between rounded-2xl bg-vermilion-wash px-5 py-3.5">
          <p className="text-sm font-medium text-vermilion-deep">{unread} 条未读</p>
          <button
            onClick={readAll}
            disabled={marking}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-vermilion-deep disabled:opacity-60"
          >
            {marking ? "处理中…" : "全部标为已读"}
          </button>
        </div>
      ) : null}

      {err ? <p className="mt-4 text-xs text-vermilion-deep">{err}</p> : null}

      {!loaded ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper-3" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center transition-colors hover:bg-vermilion-wash">
          <p className="font-seal text-3xl text-ink-faint">信</p>
          <p className="mt-3 text-sm font-medium">暂无消息</p>
          <p className="mt-1 text-xs text-ink-faint">活动奖励、券到账后会在这里通知你</p>
          <Link to="/" className="mt-5 inline-block rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper">
            回首页
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                className="ink-in block w-full rounded-2xl bg-white p-4 text-left transition-colors hover:bg-vermilion-wash"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper-3 font-seal text-base text-ink">
                    {TYPE_LABEL[m.type] || "信"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!m.read ? <span className="size-1.5 shrink-0 rounded-full bg-vermilion" /> : null}
                      <p className={`truncate text-sm ${m.read ? "font-medium" : "font-semibold"}`}>{m.title}</p>
                    </div>
                    <p className={`mt-1 text-xs text-ink-soft ${expanded === m.id ? "" : "line-clamp-2"}`}>
                      {m.body}
                    </p>
                    <p className="mt-1.5 text-[11px] text-ink-faint">{time(m.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {pages > 1 ? (
            <div className="mt-5 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="rounded-xl bg-paper-3 px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-xs text-ink-faint">
                {page} / {pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => load(page + 1)}
                className="rounded-xl bg-paper-3 px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
