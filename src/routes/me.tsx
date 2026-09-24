import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, Field, inputCls } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { ScanBuyPanel } from "@/components/scan-buy";
import { get, patch, post, api } from "@/lib/api";
import { getToken, getAuthUser, useAuth, updateUser, clearAuth } from "@/lib/auth";
import { detectMiniProgramEnv, openMpProfilePage } from "@/lib/mp-bridge";

export const Route = createFileRoute("/me")({
  component: MePage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "我的 · 对脉名鉴" },
      { name: "description", content: "管理昵称头像、出生信息与登录状态。" },
    ],
  }),
});

interface Profile {
  displayName?: string | null;
  shortId?: number;
  avatarUrl?: string | null;
  phone?: string | null;
  tokenBalance?: number;
  localBirthTime?: string | null;
  birthLatitude?: number | null;
  birthLongitude?: number | null;
  birthPlace?: string | null;
}

/** 充值订单（GET /api/v1/payments/client/wechat/my-orders）。 */
interface RechargeOrder {
  orderId: string;
  channel: "wechat_pay" | "virtual_pay" | string;
  productId?: string;
  credits: number;
  priceFen: number;
  status: string;
  createdAt?: string;
  paidAt?: string | null;
}

/** 时间套餐（GET /api/v1/plans/mine）。 */
interface MyPlan {
  planId: number;
  planCode: string;
  planNameZh: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  status: string;
  active: boolean;
}

/** 起名畅享权益（GET /api/v1/naming/pass/status）。 */
interface PassStatusLite {
  active?: boolean;
  passType?: string;
  expiresAtEpochMs?: number;
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "处理中", cls: "bg-amber-100 text-amber-800" },
  PAID: { label: "已到账", cls: "bg-emerald-100 text-emerald-800" },
  SUCCESS: { label: "已到账", cls: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "已关闭", cls: "bg-paper-3 text-ink-soft" },
  REFUNDED: { label: "已退款", cls: "bg-rose-100 text-rose-800" },
};

const CHANNEL_LABEL: Record<string, string> = {
  wechat_pay: "微信支付",
  virtual_pay: "小程序虚拟支付",
};

function MePage() {
  const navigate = useNavigate();
  const { loggedIn, user } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [err, setErr] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingBirth, setEditingBirth] = useState(false);
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("10:00");
  const [bLat, setBLat] = useState(39.9);
  const [bLng, setBLng] = useState(116.4);
  const [bPlace, setBPlace] = useState("");
  const [savingBirth, setSavingBirth] = useState(false);

  // 充值记录
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<RechargeOrder[] | null>(null);
  const [ordersErr, setOrdersErr] = useState("");

  // 我的套餐（时间套餐 + 起名畅享，含到期情况）
  const [showPlans, setShowPlans] = useState(false);
  const [plans, setPlans] = useState<MyPlan[] | null>(null);
  const [passLine, setPassLine] = useState<{ active: boolean; text: string } | null>(null);
  const [plansErr, setPlansErr] = useState("");

  // 意见反馈
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbContent, setFbContent] = useState("");
  const [fbContact, setFbContact] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [fbErr, setFbErr] = useState("");

  // 联系客服
  const [showService, setShowService] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // 小程序 web-view 内：微信头像昵称只能在原生页用官方弹层获取，这里只做引导
  const [inMp, setInMp] = useState(false);
  const [mpHint, setMpHint] = useState("");

  useEffect(() => {
    let alive = true;
    detectMiniProgramEnv().then((yes) => {
      if (alive && yes) setInMp(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mpHint) return;
    const t = window.setTimeout(() => setMpHint(""), 6000);
    return () => window.clearTimeout(t);
  }, [mpHint]);

  useEffect(() => {
    if (!loggedIn) {
      navigate({ to: "/login", search: { redirect: "/me" } });
      return;
    }
    get<Profile>(`/api/v1/users/${getAuthUser()?.userId}/profile`)
      .then((p) => {
        setProfile(p);
        updateUser({
          displayName: String(p.displayName || ""),
          avatarUrl: String(p.avatarUrl || ""),
          tokenBalance: Number(p.tokenBalance || 0),
        });
        if (p.localBirthTime) {
          const [d, t] = String(p.localBirthTime).split("T");
          setBDate(d || "");
          setBTime((t || "10:00").slice(0, 5));
        }
        if (p.birthLatitude != null) setBLat(p.birthLatitude);
        if (p.birthLongitude != null) setBLng(p.birthLongitude);
        setBPlace(p.birthPlace || "");
      })
      .catch(() => {});
  }, [loggedIn, navigate]);

  const savePersona = async () => {
    if (!name.trim()) return setErr("请填写昵称");
    setSavingName(true);
    setErr("");
    try {
      const res = await patch<{ displayName?: string }>(`/api/v1/users/${getAuthUser()?.userId}/persona`, {
        displayName: name.trim(),
      });
      updateUser({ displayName: res?.displayName || name.trim() });
      setEditingName(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingName(false);
    }
  };

  const saveBirth = async () => {
    if (!bDate) return setErr("请选择出生日期");
    setSavingBirth(true);
    setErr("");
    try {
      await api(`/api/v1/users/${getAuthUser()?.userId}/profile`, {
        method: "PUT",
        data: {
          displayName: user?.displayName || undefined,
          birthPlace: bPlace.trim() || undefined,
          localBirthTime: `${bDate}T${bTime}:00`,
          birthLatitude: bLat,
          birthLongitude: bLng,
        },
      });
      setProfile((p) => ({
        ...p,
        localBirthTime: `${bDate}T${bTime}:00`,
        birthLatitude: bLat,
        birthLongitude: bLng,
        birthPlace: bPlace,
      }));
      setEditingBirth(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingBirth(false);
    }
  };

  const logout = () => {
    if (!confirm("确定退出当前账号？")) return;
    clearAuth();
    navigate({ to: "/" });
  };

  const loadOrders = () => {
    setOrdersErr("");
    if (orders) return;
    get<RechargeOrder[]>("/api/v1/payments/client/wechat/my-orders")
      .then((list) => setOrders(list || []))
      .catch((e) => setOrdersErr(e instanceof Error ? e.message : "加载失败"));
  };

  const fmtDate = (iso?: string | number | null) => {
    if (iso == null) return "-";
    const d = typeof iso === "number" ? new Date(iso) : new Date(String(iso).replace(" ", "T"));
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
  };

  const loadPlans = () => {
    setPlansErr("");
    if (plans && passLine) return;
    const userId = getAuthUser()?.userId;
    Promise.all([
      get<{ plans: MyPlan[]; activeCount: number }>("/api/v1/plans/mine"),
      get<PassStatusLite>("/api/v1/naming/pass/status"),
    ])
      .then(([mine, pass]) => {
        setPlans(mine?.plans || []);
        if (pass?.active) {
          const label = pass.passType === "MONTH" ? "包月畅享" : "24 小时畅享";
          setPassLine({ active: true, text: `${label} · 至 ${fmtDate(pass.expiresAtEpochMs)}` });
        } else {
          setPassLine({ active: false, text: "未开通（取名页升级弹窗可用点数开通）" });
        }
      })
      .catch((e) => setPlansErr(e instanceof Error ? e.message : "加载失败"));
  };

  const submitFeedback = async () => {
    if (fbContent.trim().length < 2) return setFbErr("请填写反馈内容（至少 2 个字）");
    setFbSending(true);
    setFbErr("");
    try {
      await post("/api/v1/feedback", {
        content: fbContent.trim(),
        ...(fbContact.trim() ? { contact: fbContact.trim() } : {}),
        page: "/me",
        client: "web",
      });
      setFbDone(true);
      setFbContent("");
      setFbContact("");
    } catch (e) {
      setFbErr(e instanceof Error ? e.message : "提交失败");
    } finally {
      setFbSending(false);
    }
  };

  const copyWechat = async () => {
    try {
      await navigator.clipboard.writeText("duimaikefu");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时忽略（微信号已可见，可手动复制）
    }
  };

  const copyShortId = async () => {
    if (!profile?.shortId) return;
    try {
      await navigator.clipboard.writeText(String(profile.shortId));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch {
      // 剪贴板不可用时忽略（短号仍可见，可手动记下）
    }
  };

  const birthText = profile?.localBirthTime
    ? profile.localBirthTime.replace("T", " ").slice(0, 16) + (profile.birthPlace ? " · " + profile.birthPlace : "")
    : "";

  return (
    <AppShell>
      <PageHeader eyebrow="账号" title="我的" desc="昵称、出生信息与登录状态管理。" />

      {/* 资料卡 */}
      <section className="ink-in d1 mt-7 overflow-hidden rounded-2xl bg-white transition-colors hover:bg-vermilion-wash">
        <div className="flex items-center gap-4 p-5">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="头像" className="size-14 rounded-full object-cover" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-paper-3 font-seal text-xl text-ink">
            {(user?.displayName || "客")[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{user?.displayName || "未命名用户"}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {profile?.phone ? "手机 " + profile.phone : "余额 " + (user?.tokenBalance ?? 0) + " 点"}
          </p>
        </div>
        <button
          onClick={() => {
            setName(user?.displayName || "");
            setEditingName(true);
          }}
          className="shrink-0 rounded-full bg-paper-3 px-4 py-1.5 text-xs font-medium text-ink-soft"
        >
          编辑
        </button>
        </div>
        {/* 小程序内且还没有微信头像时：去小程序「我的」页一键设置（微信头像昵称须在原生页获取） */}
        {inMp && !user?.avatarUrl ? (
          <div className="flex items-center justify-between gap-3 px-5 py-2.5">
            <p className="text-xs text-ink-faint">
              {mpHint || "微信头像与昵称可在小程序内一键设置"}
            </p>
            <button
              onClick={async () => {
                if (!(await openMpProfilePage())) {
                  setMpHint("小程序版本较旧：请在小程序「我的」页顶部一键设置");
                }
              }}
              className="shrink-0 rounded-full bg-vermilion-wash px-3.5 py-1.5 text-xs font-medium text-vermilion-deep"
            >
              去设置
            </button>
          </div>
        ) : null}
        {profile?.shortId != null ? (
          <div className="flex items-center justify-between px-5 py-2.5">
            <p className="text-xs text-ink-faint">用户 ID（客服报号用）</p>
            <button
              onClick={copyShortId}
              className="flex items-center gap-1.5 rounded-full bg-paper-3 px-2.5 py-1 font-mono text-xs font-medium text-ink"
              title="点击复制"
            >
              {profile.shortId}
              {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-ink-faint" />}
            </button>
          </div>
        ) : null}
      </section>

      {editingName ? (
        <section className="ink-in mt-4 space-y-3 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
          <Field label="昵称">
            <input className={inputCls} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {err && editingName ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
          <div className="flex gap-3">
            <button onClick={() => setEditingName(false)} className="flex-1 rounded-xl bg-paper-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermilion-wash">
              取消
            </button>
            <button disabled={savingName} onClick={savePersona} className="flex-1 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper disabled:opacity-60">
              {savingName ? "保存中…" : "保存"}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">头像请在「对脉名鉴」小程序里设置（微信头像一键选取）</p>
        </section>
      ) : null}

      {/* 解析记录：原页头的入口迁入这里（页头只留身份，点数余额见下方「点数余额」） */}
      <Link
        to="/records"
        className="ink-in d2 mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-4 transition-colors hover:bg-vermilion-wash"
      >
        <span className="text-sm font-medium">解析记录</span>
        <span className="text-xs text-ink-faint">历史起名与解析报告</span>
      </Link>

      {/* 出生信息 */}
      <section className="ink-in d2 mt-4 rounded-2xl bg-white transition-colors hover:bg-vermilion-wash">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium">我的出生信息</p>
            <p className="mt-0.5 text-xs text-ink-faint">{birthText || "用于契合类报告的本人八字"}</p>
          </div>
          <button
            onClick={() => setEditingBirth(!editingBirth)}
            className="shrink-0 rounded-full bg-paper-3 px-4 py-1.5 text-xs font-medium text-ink-soft"
          >
            {editingBirth ? "收起" : birthText ? "修改" : "去填写"}
          </button>
        </div>
        {editingBirth ? (
          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="出生日期">
                <input className={inputCls} type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} />
              </Field>
              <Field label="出生时间">
                <input className={inputCls} type="time" value={bTime} onChange={(e) => setBTime(e.target.value)} />
              </Field>
            </div>
            <Field label="出生地（搜索选择）">
              <BirthplaceInput
                lat={bLat}
                lng={bLng}
                place={bPlace}
                onPick={(v) => {
                  setBLat(v.lat);
                  setBLng(v.lng);
                  setBPlace(v.place.slice(0, 24));
                }}
              />
            </Field>
            {err && !editingName ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
            <button
              disabled={savingBirth}
              onClick={saveBirth}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {savingBirth ? "保存中…" : "保存出生信息"}
            </button>
          </div>
        ) : null}
      </section>

      {/* 余额与支付 */}
      <section className="ink-in d3 mt-4 overflow-hidden rounded-2xl bg-white transition-colors hover:bg-vermilion-wash">
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-medium">点数余额</p>
          <p className="text-sm font-semibold tabular-nums text-vermilion-deep">{user?.tokenBalance ?? 0} 点</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-medium">充值与解锁</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            选择套餐后微信扫码支付，点数/畅享直接充入当前账号，到账后自动提示。
          </p>
          <div className="mt-3">
            <ScanBuyPanel trackWhere="me" />
          </div>
        </div>
        <button
          onClick={() => {
            const next = !showPlans;
            setShowPlans(next);
            if (next) loadPlans();
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium">我的套餐与畅享</span>
          <span className="text-xs text-ink-faint">{showPlans ? "收起" : "查看"}</span>
        </button>
        {showPlans ? (
          <div className="px-5 py-4">
            {plansErr ? <p className="text-xs text-vermilion-deep">{plansErr}</p> : null}
            {!plans && !plansErr ? <p className="text-xs text-ink-faint">加载中…</p> : null}
            {plans ? (
              <>
                {(() => {
                  const active = plans.filter((p) => p.active);
                  const history = plans.filter((p) => !p.active);
                  return (
                    <>
                      <p className="text-[11px] font-medium text-ink">有效套餐</p>
                      {active.length === 0 ? (
                        <p className="mt-1 text-xs text-ink-faint">暂无有效套餐</p>
                      ) : (
                        <ul className="mt-1">
                          {active.map((p) => {
                            const days = p.expiresAt
                              ? Math.max(0, Math.ceil((new Date(p.expiresAt.replace(" ", "T")).getTime() - Date.now()) / 86400000))
                              : null;
                            return (
                              <li key={p.planId} className="flex items-center gap-3 py-2 first:pt-0">
                                <p className="min-w-0 flex-1 text-xs font-medium text-ink">
                                  {p.planNameZh}
                                  <span className="ml-2 font-normal text-ink-faint">
                                    至 {fmtDate(p.expiresAt)}
                                    {days != null ? ` · 剩余 ${days} 天` : ""}
                                  </span>
                                </p>
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  生效中
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <p className="mt-3 text-[11px] font-medium text-ink">起名畅享</p>
                      <p className="mt-1 text-xs text-ink-faint">{passLine?.text ?? "未开通"}</p>
                      {history.length ? (
                        <>
                          <p className="mt-3 text-[11px] font-medium text-ink">历史</p>
                          <ul className="mt-1">
                            {history.map((p) => (
                              <li key={p.planId} className="flex items-center gap-3 py-1.5 first:pt-0">
                                <p className="min-w-0 flex-1 text-xs text-ink-faint">
                                  {p.planNameZh}
                                  <span className="ml-2">至 {fmtDate(p.expiresAt)}</span>
                                </p>
                                <span className="shrink-0 text-[10px] text-ink-faint">
                                  {p.status === "CANCELLED" ? "已取消" : "已到期"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </>
            ) : null}
          </div>
        ) : null}
        <button
          onClick={() => {
            const next = !showOrders;
            setShowOrders(next);
            if (next) loadOrders();
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium">充值记录</span>
          <span className="text-xs text-ink-faint">{showOrders ? "收起" : "查看"}</span>
        </button>
        {showOrders ? (
          <div className="px-5 py-4">
            {ordersErr ? <p className="text-xs text-vermilion-deep">{ordersErr}</p> : null}
            {!orders && !ordersErr ? <p className="text-xs text-ink-faint">加载中…</p> : null}
            {orders?.length === 0 ? (
              <p className="text-xs text-ink-faint">暂无充值记录</p>
            ) : null}
            {orders?.length ? (
              <ul>
                {orders.map((o) => {
                  const st = ORDER_STATUS[o.status] || { label: o.status, cls: "bg-paper-3 text-ink-soft" };
                  return (
                    <li key={o.orderId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">
                          +{o.credits} 点
                          <span className="ml-2 font-normal text-ink-faint">{CHANNEL_LABEL[o.channel] || o.channel}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {(o.createdAt || "").replace("T", " ").slice(0, 16)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-ink">¥{(o.priceFen / 100).toFixed(2)}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
        <button onClick={logout} className="w-full px-5 py-4 text-left text-sm font-medium text-vermilion-deep">
          退出登录
        </button>
      </section>

      {/* 反馈与客服 */}
      <section className="ink-in d3 mt-4 overflow-hidden rounded-2xl bg-white transition-colors hover:bg-vermilion-wash">
        <button
          onClick={() => {
            setShowFeedback(!showFeedback);
            setShowService(false);
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium">意见反馈</span>
          <span className="text-xs text-ink-faint">{showFeedback ? "收起" : "建议或问题"}</span>
        </button>
        {showFeedback ? (
          <div className="space-y-3 px-5 py-4">
            {fbDone ? (
              <p className="text-xs text-emerald-700">已收到你的反馈，感谢支持！我们会尽快跟进。</p>
            ) : null}
            <Field label="反馈内容">
              <textarea
                className={`${inputCls} min-h-24 resize-y`}
                maxLength={1000}
                placeholder="说说你遇到的问题或建议…"
                value={fbContent}
                onChange={(e) => setFbContent(e.target.value)}
              />
            </Field>
            <Field label="联系方式（选填）">
              <input
                className={inputCls}
                maxLength={100}
                placeholder="微信 / 邮箱 / 手机号"
                value={fbContact}
                onChange={(e) => setFbContact(e.target.value)}
              />
            </Field>
            {fbErr ? <p className="text-xs text-vermilion-deep">{fbErr}</p> : null}
            <button
              disabled={fbSending}
              onClick={submitFeedback}
              className="w-full rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {fbSending ? "提交中…" : "提交反馈"}
            </button>
          </div>
        ) : null}
        <button
          onClick={() => {
            setShowService(!showService);
            setShowFeedback(false);
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium">联系客服</span>
          <span className="text-xs text-ink-faint">{showService ? "收起" : "微信 / 邮箱"}</span>
        </button>
        {showService ? (
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink">客服微信：duimaikefu</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">工作日 9:00–18:00</p>
              </div>
              <button onClick={copyWechat} className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper">
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <p className="text-xs text-ink-soft">
              邮箱：
              <a className="font-medium text-vermilion-deep underline underline-offset-2" href="mailto:support@duimai.net">
                support@duimai.net
              </a>
            </p>
            <p className="text-[11px] text-ink-faint">也可在微信小程序「对脉名鉴」内使用联系客服入口。</p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
