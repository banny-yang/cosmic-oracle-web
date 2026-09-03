import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { get, post, apiBase } from "@/lib/api";

export const Route = createFileRoute("/vote/$token")({
  component: VotePage,
  head: () => ({
    meta: [{ title: "名字投票 · 对脉名鉴" }],
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

function VotePage() {
  const { token } = Route.useParams();
  const [session, setSession] = useState<SessionView | null>(null);
  const [myChoice, setMyChoice] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMyChoice(localStorage.getItem("dm_vote_" + token) || "");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refresh = () => {
    get<SessionView>(`/api/v1/naming/voting/${token}`, {}, { auth: false })
      .then((r) => {
        setSession(r);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "投票加载失败");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票失败");
    }
  };

  const maxVotes = Math.max(1, ...(session?.candidates || []).map((c) => c.votes || 0));

  return (
    <div className="min-h-screen bg-background font-song text-foreground selection:bg-vermilion/20">
      <div className="mx-auto max-w-[430px] px-5 pt-7 pb-16">
        <PageHeader
          eyebrow="亲友投票"
          title={`${session?.babySurname || ""}家宝宝的名字投票`}
          desc="点击你喜欢的名字投一票，每人限投一次。"
        />

        {error ? (
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
              <p className="mt-6 text-center text-xs text-ink-soft">你选择了「{myChoice}」，感谢参与</p>
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
