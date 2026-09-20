import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { MiniMarkdown, RechargeModal } from "@/components/report-flow";
import { ThinkAnswerBox } from "@/components/think-stream";
import { useThinkStream } from "@/lib/use-think-stream";
import { FeatureClosed } from "@/components/feature-closed";
import {
  QimenPalaceGrid,
  QimenPlateHeader,
  isQimenPlate,
  type QimenPlate,
} from "@/components/qimen-palace-grid";
import {
  QimenJudgeCard,
  QimenYingQiCard,
  isQimenJudgeData,
  type QimenJudgeData,
  type QimenYingQi,
} from "@/components/qimen-judge-card";
import { get, post } from "@/lib/api";
import { getAuthUser, useAuth } from "@/lib/auth";
import { streamPost } from "@/lib/sse";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { track } from "@/lib/track";

export const Route = createFileRoute("/qimen")({
  component: Qimen,
  head: () => ({
    links: [{ rel: "canonical", href: "https://name.duimai.net/qimen" }],
    meta: [
      { title: "奇门遁甲断局 · 对脉名鉴" },
      { name: "keywords", content: "奇门遁甲,奇门断局,排盘,九宫格,代占,应期" },
      { property: "og:url", content: "https://name.duimai.net/qimen" },
      {
        name: "description",
        content:
          "输入所问之事即刻排盘断局：九宫格局、吉凶格局、主客分析与应期推断，支持为他人代占并按人查看断局记录。",
      },
    ],
  }),
});

interface ScenePreset {
  scene_code?: string;
  scene_name?: string;
  title?: string;
  placeholder?: string;
  example_query?: string;
  is_hot?: boolean;
}

interface Subject {
  id: number;
  name: string;
  gender?: string | null;
  birth?: string | null;
  relation?: string | null;
}

interface JudgeRecord {
  logId: string;
  scenario?: string;
  situationText?: string;
  verdict?: string;
  aiReadingPreview?: string;
  aiReading?: string;
  plateDataJson?: string;
  judgeDataJson?: string;
  subjectId?: number | null;
  subjectName?: string | null;
  subjectGender?: string | null;
  subjectBirth?: string | null;
  createdAt?: string;
}

type Phase = "form" | "running" | "done";

const GENDER_ZH: Record<string, string> = { M: "男", F: "女", U: "" };

function Qimen() {
  const price = useFeaturePrice("QIMEN_JUDGE", 5);
  const featureEnabled = useFeatureEnabled("QIMEN_JUDGE");
  const { loggedIn } = useAuth();

  const [phase, setPhase] = useState<Phase>("form");
  const [presets, setPresets] = useState<ScenePreset[]>([]);
  const [sceneCode, setSceneCode] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [err, setErr] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  // 代占（大师版）：self=为自己问；new=新建求测人；数字=既有求测人 id
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectSel, setSubjectSel] = useState<string>("self");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("M");
  const [newBirth, setNewBirth] = useState("");
  const [newRelation, setNewRelation] = useState("");

  // SSE 渐进结果
  const [intent, setIntent] = useState<{
    scene_name?: string | undefined;
    yongshen?: string[] | undefined;
  } | null>(null);
  const [plate, setPlate] = useState<QimenPlate | null>(null);
  const [yingqi, setYingqi] = useState<QimenYingQi | null>(null);
  const [judge, setJudge] = useState<QimenJudgeData | null>(null);
  // 断语流（共享 think 解析）：answer 增量里的 <think> 段落首行显示、结束隐藏，正文 markdown
  const answerStream = useThinkStream();
  const streamRef = useRef<{ abort: () => void } | null>(null);

  // 断局记录
  const [records, setRecords] = useState<JudgeRecord[] | null>(null);
  const [openRec, setOpenRec] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<JudgeRecord | null>(null);

  useEffect(() => () => streamRef.current?.abort(), []);

  // 场景预设（登录后加载，失败静默——纯文本慢路仍可用）
  useEffect(() => {
    if (!loggedIn || phase !== "form") return;
    get<ScenePreset[]>("/api/v1/qimen/scenes/presets")
      .then((list) => setPresets(Array.isArray(list) ? list : []))
      .catch(() => setPresets([]));
  }, [loggedIn, phase]);

  const loadSubjects = () => {
    const uid = getAuthUser()?.userId;
    if (!uid) return;
    get<Subject[]>("/api/v1/qimen/subjects", { user_id: uid })
      .then((list) => setSubjects(Array.isArray(list) ? list : []))
      .catch(() => setSubjects([]));
  };

  const loadRecords = () => {
    const uid = getAuthUser()?.userId;
    if (!uid) return;
    get<JudgeRecord[]>("/api/v1/qimen/judge/my-judges", { user_id: uid })
      .then((list) => setRecords(Array.isArray(list) ? list : []))
      .catch(() => setRecords([]));
  };

  const ensureSubjects = () => {
    if (subjects === null) loadSubjects();
  };

  const createSubject = async (): Promise<Subject | null> => {
    const uid = getAuthUser()?.userId;
    const name = newName.trim();
    if (!uid || !name) return null;
    return post<Subject>("/api/v1/qimen/subjects", {
      userId: uid,
      name,
      gender: newGender,
      birth: newBirth.trim() || undefined,
      relation: newRelation.trim() || undefined,
    });
  };

  const submit = async () => {
    setErr("");
    const uid = getAuthUser()?.userId;
    if (!uid) {
      window.location.href = "/login?redirect=" + encodeURIComponent("/qimen");
      return;
    }
    const q = question.trim();
    if (!q) return setErr("请写下要断的事（可代他人问，信息越具体越准）");
    track("qimen_judge_start", { scene: sceneCode || "auto", subject: subjectSel !== "self" });

    setPhase("running");
    setIntent(null);
    setPlate(null);
    setYingqi(null);
    setJudge(null);
    answerStream.reset();
    try {
      // ① 求测人（新建则先建档）
      let subjectBody: Record<string, unknown> = {};
      if (subjectSel === "new") {
        const created = await createSubject();
        if (!created) throw new Error("请填写求测人姓名");
        setSubjects((prev) => (prev ? [created, ...prev] : [created]));
        setSubjectSel(String(created.id));
        subjectBody = {
          subject_id: created.id,
          subject_name: created.name,
          subject_gender: created.gender,
          subject_birth: created.birth,
        };
      } else if (subjectSel !== "self") {
        const s = subjects?.find((x) => String(x.id) === subjectSel);
        if (s)
          subjectBody = {
            subject_id: s.id,
            subject_name: s.name,
            subject_gender: s.gender,
            subject_birth: s.birth,
          };
      }

      // ② 预扣 5 点（失败退款凭证 consume_tx_id）
      let consumeTxId: string | undefined;
      try {
        const consume = await post<{ transactionId?: string; deducted?: number }>(
          "/api/v1/plans/consume",
          {
            userId: uid,
            featureCode: "QIMEN_JUDGE",
          },
        );
        consumeTxId = consume?.transactionId;
      } catch (e) {
        setPhase("form");
        setErr(e instanceof Error ? e.message : "扣费失败，请稍后再试");
        setShowPaywall(true);
        return;
      }

      // ③ SSE 断局流（answer 增量经共享 think 解析：首行显示思考、结束隐藏、正文 markdown）
      let gotAnswer = false;
      streamRef.current = streamPost({
        path: "/api/v1/chat/submit",
        data: {
          scene_code: sceneCode || null,
          user_query: q,
          user_id: uid,
          lang: "zh_CN",
          consume_tx_id: consumeTxId,
          ...subjectBody,
        },
        idleTimeoutMs: 300_000,
        onEvent: (obj) => {
          const step = typeof obj["step"] === "string" ? obj["step"] : "";
          if (step === "intent") {
            setIntent({
              scene_name: typeof obj["scene_name"] === "string" ? obj["scene_name"] : undefined,
              yongshen: Array.isArray(obj["yongshen"]) ? obj["yongshen"].map(String) : undefined,
            });
          } else if (step === "plate") {
            if (isQimenPlate(obj["data"])) setPlate(obj["data"]);
          } else if (step === "yingqi") {
            setYingqi(obj as QimenYingQi);
          } else if (step === "judge") {
            if (isQimenJudgeData(obj["data"])) setJudge(obj["data"]);
          } else if (step === "forbidden") {
            setErr(typeof obj["message"] === "string" ? obj["message"] : "该问题超出服务范围");
          } else if (step === "close") {
            setPhase("done");
          } else if (typeof obj["answer"] === "string") {
            answerStream.push(null, obj["answer"]);
            gotAnswer = true;
          } else if (typeof obj["error"] === "string" && obj["error"]) {
            setErr(obj["error"]);
          }
        },
        onDone: () => setPhase("done"),
        onError: (e) => {
          setErr(e.message);
          if (gotAnswer) setPhase("done");
          else setPhase("form");
        },
      });
    } catch (e) {
      setPhase("form");
      setErr(e instanceof Error ? e.message : "断局失败，请稍后再试");
    }
  };

  const openRecord = (r: JudgeRecord) => {
    if (openRec === r.logId) {
      setOpenRec(null);
      return;
    }
    setOpenRec(r.logId);
    setOpenDetail(r);
    if (!r.aiReading || !r.plateDataJson) {
      get<JudgeRecord>(`/api/v1/qimen/judge/${r.logId}/detail`)
        .then((d) => setOpenDetail({ ...r, ...d }))
        .catch(() => {});
    }
  };

  const reset = () => {
    streamRef.current?.abort();
    setPhase("form");
    setIntent(null);
    setPlate(null);
    setYingqi(null);
    setJudge(null);
    answerStream.reset();
    setErr("");
  };

  const voidPalaces = [
    ...(judge?.global_assessment?.void_palaces ?? []),
    ...(judge?.global_assessment?.day_void_palaces ?? []),
  ];

  const grouped: { key: string; label: string; items: JudgeRecord[] }[] = [];
  for (const r of records ?? []) {
    const key = r.subjectName ?? "";
    const label = r.subjectName ?? "为自己";
    const found = grouped.find((g) => g.key === key);
    if (found) found.items.push(r);
    else grouped.push({ key, label, items: [r] });
  }

  return (
    <AppShell>
      <BreadcrumbJsonLd name="奇门遁甲断局" path="/qimen" />
      {featureEnabled === false ? (
        <FeatureClosed title="奇门遁甲断局" />
      ) : (
        <>
          <PageHeader
            eyebrow={`消耗 ${price} 点`}
            title="奇门遁甲断局"
            desc="一事一局：即刻排盘，九宫格局、主客盛衰、应期窗口，AI 断语逐字推演。支持为他人代占。"
          />

          {phase === "form" ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              {presets.length > 0 ? (
                <Field label="问题类别（可不选，由 AI 识别）">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSceneCode("")}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                        sceneCode === ""
                          ? "bg-vermilion text-paper ring-vermilion"
                          : "bg-paper-3 text-ink-soft ring-ink/10",
                      ].join(" ")}
                    >
                      自动识别
                    </button>
                    {presets.map((p) => (
                      <button
                        key={p.scene_code}
                        onClick={() => {
                          setSceneCode(p.scene_code ?? "");
                          if (p.placeholder && !question.trim()) setQuestion(p.example_query ?? "");
                        }}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                          sceneCode === p.scene_code
                            ? "bg-vermilion text-paper ring-vermilion"
                            : "bg-paper-3 text-ink-soft ring-ink/10",
                        ].join(" ")}
                      >
                        {p.scene_name ?? p.title}
                        {p.is_hot ? " 🔥" : ""}
                      </button>
                    ))}
                  </div>
                </Field>
              ) : null}

              <Field label="所断之事" required>
                <textarea
                  className={inputCls + " min-h-28 resize-none"}
                  maxLength={300}
                  placeholder="如：这个项目下个月能签下来吗？对方是客户张先生，1990 年生。"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </Field>

              {loggedIn ? (
                <Field label="为谁而断（代占）">
                  <select
                    className={inputCls}
                    value={subjectSel}
                    onChange={(e) => {
                      setSubjectSel(e.target.value);
                      if (e.target.value !== "self") ensureSubjects();
                    }}
                    onFocus={ensureSubjects}
                  >
                    <option value="self">为自己问</option>
                    {(subjects ?? []).map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                        {s.relation ? `（${s.relation}）` : ""}
                        {s.birth ? ` · ${s.birth}` : ""}
                      </option>
                    ))}
                    <option value="new">＋ 新建求测人…</option>
                  </select>
                  {subjectSel === "new" ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-paper-3 p-3 md:grid-cols-4">
                      <input
                        className={inputCls}
                        maxLength={50}
                        placeholder="姓名 *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <select
                        className={inputCls}
                        value={newGender}
                        onChange={(e) => setNewGender(e.target.value)}
                      >
                        <option value="M">男</option>
                        <option value="F">女</option>
                        <option value="U">不详</option>
                      </select>
                      <input
                        className={inputCls}
                        maxLength={30}
                        placeholder="生辰（选填，如 1990-05 午时）"
                        value={newBirth}
                        onChange={(e) => setNewBirth(e.target.value)}
                      />
                      <input
                        className={inputCls}
                        maxLength={20}
                        placeholder="关系（选填，如 客户）"
                        value={newRelation}
                        onChange={(e) => setNewRelation(e.target.value)}
                      />
                    </div>
                  ) : null}
                </Field>
              ) : null}

              {err ? <p className="mt-2 text-xs text-vermilion-deep">{err}</p> : null}
              {loggedIn ? null : (
                <p className="mt-2 text-[11px] text-ink-faint">
                  登录后可代他人断局并保留断局记录。
                </p>
              )}
              <button
                onClick={submit}
                className="mt-4 w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
              >
                开始断局（{price} 点）
              </button>
            </section>
          ) : (
            <section className="mt-7 space-y-4">
              {intent ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 p-4 ring-1 ring-ink/5">
                  <span className="rounded-full bg-vermilion/10 px-2.5 py-1 text-xs font-semibold text-vermilion-deep">
                    {intent.scene_name ?? "断局"}
                  </span>
                  {(intent.yongshen ?? []).map((y) => (
                    <span
                      key={y}
                      className="rounded-full bg-ink/8 px-2.5 py-1 text-[11px] text-ink-soft"
                    >
                      用神 · {y}
                    </span>
                  ))}
                  {phase === "running" ? (
                    <span className="ml-auto size-2 animate-pulse rounded-full bg-vermilion" />
                  ) : null}
                </div>
              ) : phase === "running" ? (
                <div className="flex items-center gap-3 rounded-xl bg-paper-2 p-4 ring-1 ring-ink/5">
                  <span className="size-2 animate-pulse rounded-full bg-vermilion" />
                  <p className="text-sm font-medium">正在起局推演…</p>
                </div>
              ) : null}

              {plate ? (
                <div className="rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
                  <QimenPlateHeader plate={plate} />
                  <div className="mt-4">
                    <QimenPalaceGrid
                      plate={plate}
                      voidPalaces={voidPalaces}
                      maPalace={judge?.global_assessment?.ma_star_palace ?? -1}
                      yongShenPalace={judge?.yong_shen_palace?.palace_index ?? -1}
                      subjectPalace={judge?.subject_palace?.palace_index ?? -1}
                      objectPalace={judge?.object_palace?.palace_index ?? -1}
                    />
                  </div>
                </div>
              ) : null}

              {judge ? <QimenJudgeCard judge={judge} /> : null}
              {yingqi ? <QimenYingQiCard yingqi={yingqi} /> : null}

              <ThinkAnswerBox
                think={answerStream.think}
                thinkLive={answerStream.thinkLive}
                visible={answerStream.visible}
                placeholder="正在推演断语…"
              />
              {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
              {phase === "done" ? (
                <button
                  onClick={reset}
                  className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper"
                >
                  再断一局
                </button>
              ) : null}
            </section>
          )}

          {loggedIn ? (
            <section className="mt-10">
              <button
                onClick={() => (records === null ? loadRecords() : setRecords(null))}
                className="text-sm font-semibold text-ink"
              >
                {records === null ? "▸ 我的断局记录" : "▾ 我的断局记录"}
              </button>
              {records !== null ? (
                records.length === 0 ? (
                  <p className="mt-3 rounded-2xl bg-paper-2 p-5 text-center text-xs text-ink-faint ring-1 ring-ink/5">
                    还没有断局记录。
                  </p>
                ) : (
                  <div className="mt-3 space-y-5">
                    {grouped.map((g) => (
                      <div key={g.key || "self"}>
                        <p className="mb-2 text-xs font-semibold text-vermilion-deep">
                          {g.label === "为自己" ? "为自己" : `为 ${g.label}`}
                          <span className="ml-1 font-normal text-ink-faint">
                            （{g.items.length}）
                          </span>
                        </p>
                        <div className="space-y-2">
                          {g.items.map((r) => (
                            <div key={r.logId} className="rounded-2xl bg-paper-2 ring-1 ring-ink/5">
                              <button
                                onClick={() => openRecord(r)}
                                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-ink">{r.situationText}</p>
                                  <p className="mt-0.5 text-[11px] text-ink-faint">
                                    {r.verdict ?? r.scenario}
                                    {r.createdAt
                                      ? ` · ${new Date(r.createdAt).toLocaleString("zh-CN")}`
                                      : ""}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs text-ink-faint">
                                  {openRec === r.logId ? "收起" : "展开"}
                                </span>
                              </button>
                              {openRec === r.logId && openDetail ? (
                                <div className="space-y-4 border-t border-ink/5 p-4">
                                  {openDetail.subjectName ? (
                                    <p className="text-[11px] text-ink-faint">
                                      代占：{openDetail.subjectName}
                                      {openDetail.subjectGender &&
                                      GENDER_ZH[openDetail.subjectGender]
                                        ? ` · ${GENDER_ZH[openDetail.subjectGender]}`
                                        : ""}
                                      {openDetail.subjectBirth
                                        ? ` · ${openDetail.subjectBirth}`
                                        : ""}
                                    </p>
                                  ) : null}
                                  {(() => {
                                    try {
                                      const p = openDetail.plateDataJson
                                        ? JSON.parse(openDetail.plateDataJson)
                                        : null;
                                      const j = openDetail.judgeDataJson
                                        ? JSON.parse(openDetail.judgeDataJson)
                                        : null;
                                      return (
                                        <>
                                          {isQimenPlate(p) ? (
                                            <div>
                                              <QimenPlateHeader plate={p} />
                                              <div className="mt-3">
                                                <QimenPalaceGrid
                                                  plate={p}
                                                  voidPalaces={
                                                    j?.global_assessment?.void_palaces ?? []
                                                  }
                                                  maPalace={
                                                    j?.global_assessment?.ma_star_palace ?? -1
                                                  }
                                                  yongShenPalace={
                                                    j?.yong_shen_palace?.palace_index ?? -1
                                                  }
                                                  subjectPalace={
                                                    j?.subject_palace?.palace_index ?? -1
                                                  }
                                                  objectPalace={
                                                    j?.object_palace?.palace_index ?? -1
                                                  }
                                                />
                                              </div>
                                            </div>
                                          ) : null}
                                          {isQimenJudgeData(j) ? (
                                            <QimenJudgeCard judge={j} />
                                          ) : null}
                                        </>
                                      );
                                    } catch {
                                      return null;
                                    }
                                  })()}
                                  <MiniMarkdown
                                    text={
                                      openDetail.aiReading ||
                                      openDetail.aiReadingPreview ||
                                      "（暂无断语）"
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </section>
          ) : null}
        </>
      )}
      {showPaywall ? <RechargeModal message={err} onClose={() => setShowPaywall(false)} /> : null}
    </AppShell>
  );
}
