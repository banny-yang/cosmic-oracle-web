import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { get, post } from "@/lib/api";
import { track } from "@/lib/track";
import { setupWxShare } from "@/lib/wx-share";

export const Route = createFileRoute("/vote/$token")({
  component: VotePage,
  head: () => ({
    links: [{ rel: "canonical", href: "http://name.duimai.net/vote" }],
    meta: [
      { property: "og:image", content: "http://name.duimai.net/og-card.jpg" },
      { title: "名字投票 · 对脉名鉴" },
      {
        name: "description",
        content: "家人为宝宝的名字投上一票：点击你喜欢的名字即可参与，每人限投一次。",
      },
      { property: "og:title", content: "名字投票 · 对脉名鉴" },
      {
        property: "og:description",
        content: "点击你喜欢的名字投一票，每人限投一次。结果实时可见。",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

interface Candidate {
  name: string;
  pinyin?: string;
  votes: number;
}

interface SessionView {
  babySurname?: string;
  totalVotes: number;
  candidates: Candidate[];
}

const VOTER_KEY = "dm_voter_key";

function voterKey() {
  let k = localStorage.getItem(VOTER_KEY);
  if (!k) {
    k = "web-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VOTER_KEY, k);
  }
  return k;
}

function isGone(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e || "");
  return /404|不存在|过期|失效|not found/i.test(msg);
}

function VotePage() {
  const { token } = Route.useParams();
  const [session, setSession] = useState<SessionView | null>(null);
  const [myChoice, setMyChoice] = useState("");
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMyChoice(localStorage.getItem("dm_vote_" + token) || "");
    track("vote_page_view");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 微信内转发卡片（公众号配置后自动生效）
  useEffect(() => {
    setupWxShare({
      title: "来帮宝宝选名字 · 对脉名鉴",
      desc: "家人为宝宝的名字投上一票，每人一票，结果实时可见",
    });
  }, []);

  const refresh = () => {
    get<SessionView>(`/api/v1/naming/voting/${token}`, {}, { auth: false })
      .then((r) => {
        setSession(r);
        setLoaded(true);
      })
      .catch((e) => {
        if (isGone(e)) setGone(true);
        else setError(e instanceof Error ? e.message : "投票加载失败");
        setLoaded(true);
      });
  };

  const vote = async (name: string) => {
    if (myChoice) return;
    try {
      const r = await post<SessionView>(
        `/api/v1/naming/voting/${token}/vote`,
        { voterOpenid: voterKey(), selectedName: name },
        { auth: false },
      );
      setSession(r);
      setMyChoice(name);
      localStorage.setItem("dm_vote_" + token, name);
      track("vote_cast", { name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票失败");
    }
  };

  /** 转发给更多家人：优先系统分享面板，否则复制链接 */
  const share = async () => {
    track("vote_share_click");
    const url = location.href;
    const text = `${session?.babySurname || ""}家宝宝的名字投票，来帮你喜欢的名字投一票`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "名字投票 · 对脉名鉴", text, url });
        return;
      }
      throw new Error("no share");
    } catch {
      try {
        await navigator.clipboard.writeText(text + " " + url);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const maxVotes = Math.max(1, ...(session?.candidates || []).map((c) => c.votes || 0));

  return (
    <div className="min-h-screen bg-background font-song text-foreground selection:bg-vermilion/20">
      <div className="mx-auto max-w-[430px] px-5 pt-7 pb-16 md:max-w-2xl">
        <PageHeader
          eyebrow="亲友投票"
          title={`${session?.babySurname || ""}家宝宝的名字投票`}
          desc="点击你喜欢的名字投一票，每人限投一次。"
        />

        <p className="mt-3 text-center text-xs text-ink-soft">
          想给自己的宝宝也起一组有出处的好名字？
          <Link to="/naming" className="font-medium text-vermilion-deep underline underline-offset-2">免费试试宝宝起名 →</Link>
        </p>

        {gone ? (
          <div className="mt-7 rounded-2xl bg-paper-2 p-8 text-center ring-1 ring-ink/5">
            <span className="font-seal text-3xl text-ink-faint">过</span>
            <p className="mt-3 text-sm font-medium text-ink">投票链接已失效或不存在</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              链接可能已过期，或发起人已关闭投票。可以请发起人重新分享。
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-paper"
            >
              逛逛对脉名鉴
            </Link>
          </div>
        ) : error ? (
          <div className="mt-7 rounded-2xl bg-paper-2 p-8 text-center ring-1 ring-ink/5">
            <p className="text-sm text-vermilion-deep">{error}</p>
            <button onClick={refresh} className="mt-4 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-paper">
              重新加载
            </button>
          </div>
        ) : !loaded ? (
          <div className="mt-7 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper-2 ring-1 ring-ink/5" />
            ))}
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs text-ink-faint">共 {session?.totalVotes || 0} 人参与</p>
            <div className="mt-3 space-y-3">
              {(session?.candidates || []).map((c) => {
                const mine = myChoice === c.name;
                const chosen = !!myChoice;
                return (
                  <button
                    key={c.name}
                    disabled={chosen}
                    onClick={() => vote(c.name)}
                    className={`relative w-full overflow-hidden rounded-2xl bg-paper-2 p-4 text-left ring-1 transition-transform ${
                      mine ? "ring-vermilion" : "ring-ink/5"
                    } ${chosen ? "" : "active:scale-[0.99]"}`}
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-vermilion/10"
                      style={{ width: `${((c.votes || 0) / maxVotes) * 100}%` }}
                    />
                    <span className="relative flex items-center justify-between">
                      <span className="flex items-baseline gap-2">
                        <span className="font-seal text-2xl text-ink">{c.name}</span>
                        {c.pinyin ? <span className="text-xs text-ink-faint">{c.pinyin}</span> : null}
                        {mine ? <span className="text-[11px] font-medium text-vermilion-deep">我的选择</span> : null}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-vermilion-deep">{c.votes || 0}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {myChoice ? (
              <div className="mt-6 text-center">
                <p className="text-xs text-ink-soft">你选择了「{myChoice}」，感谢参与</p>
                <button
                  onClick={share}
                  className="mt-3 rounded-xl bg-vermilion px-6 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98]"
                >
                  {copied ? "链接已复制，去粘贴给家人" : "转发给更多家人"}
                </button>
              </div>
            ) : null}
            <p className="mt-10 text-center text-[11px] leading-relaxed text-ink-faint">
              投票由对脉名鉴提供 · 内容仅供文化参考与娱乐
            </p>
          </>
        )}
      </div>
    </div>
  );
}
