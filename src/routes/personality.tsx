import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, RechargeModal } from "@/components/report-flow";
import { CompatibilitySummaryCard, useReportDetail } from "@/components/report-summary-cards";
import { ReportPosterButtons, buildCompatibilityPoster, fetchMarriageFitWuxing } from "@/components/report-poster";
import { getAuthUser } from "@/lib/auth";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";

export const Route = createFileRoute("/personality")({
  component: Personality,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://name.duimai.net/personality" },
    ],
    meta: [
      { title: "缘分伴侣匹配 · 对脉名鉴" },
      { name: "keywords", content: "缘分伴侣匹配,恋爱伴侣,创业合伙,亲子教育,职场助力,契合度测评" },
      { property: "og:url", content: "https://name.duimai.net/personality" },
      {
        name: "description",
        content: "以传统性格倾向视角看两个人相处的分寸，仅供文化参考。",
      },
    ],
  }),
});

const relations = [
  { value: "ROMANTIC", label: "恋爱伴侣" },
  { value: "BUSINESS", label: "创业合伙" },
  { value: "PARENT_CHILD", label: "亲子教育" },
  { value: "CAREER_MENTOR", label: "职场贵人" },
];

function Personality() {
  const price = useFeaturePrice("INSIGHT_PAIR", 9);
  const featureEnabled = useFeatureEnabled("INSIGHT_PAIR");
  const flow = useReportFlow();
  const [showPaywall, setShowPaywall] = useState(false);
  useEffect(() => {
    if (flow.needPay) setShowPaywall(true);
  }, [flow.needPay]);
  const detail = useReportDetail(flow.reportId, flow.phase === "done" && !flow.error);
  const [nameA, setNameA] = useState("");
  const [dateA, setDateA] = useState("");
  const [timeA, setTimeA] = useState("12:00");
  const [latA, setLatA] = useState(39.9);
  const [lngA, setLngA] = useState(116.4);
  const [nameB, setNameB] = useState("");
  const [dateB, setDateB] = useState("");
  const [timeB, setTimeB] = useState("12:00");
  const [latB, setLatB] = useState(31.2);
  const [lngB, setLngB] = useState(121.5);
  const [relation, setRelation] = useState("ROMANTIC");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!dateA) return setErr("请选择我方出生日期");
    if (!dateB) return setErr("请选择对方出生日期");
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "COMPATIBILITY",
      partners: [
        {
          name: nameA.trim() || "我方",
          birthTime: `${dateA}T${timeA}:00`,
          latitude: latA,
          longitude: lngA,
          relationshipType: relation,
        },
        {
          name: nameB.trim() || "对方",
          birthTime: `${dateB}T${timeB}:00`,
          latitude: latB,
          longitude: lngB,
        },
      ],
    });
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="缘分伴侣匹配" path="/personality" />
      {featureEnabled === false ? (
        <FeatureClosed title="缘分伴侣匹配" />
      ) : (
        <>
      <PageHeader
        eyebrow={`功能三 · 消耗 ${price} 点`}
        title="缘分伴侣匹配"
        desc="以性格倾向看两个人相处的分寸，仅供文化参考。"
      />

      {flow.phase === "form" ? (
        <ReportForm>
          <Field label="匹配关系">
            <select className={inputCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
              {relations.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <p className="mt-2 text-sm font-semibold">我方</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="称呼（选填）">
              <input className={inputCls} maxLength={12} placeholder="如：沈知远" value={nameA} onChange={(e) => setNameA(e.target.value)} />
            </Field>
            <Field label="出生日期" required>
              <input className={inputCls} type="date" value={dateA} onChange={(e) => setDateA(e.target.value)} />
            </Field>
            <Field label="出生时间">
              <input className={inputCls} type="time" value={timeA} onChange={(e) => setTimeA(e.target.value)} />
            </Field>
            <Field label="出生地（真太阳时校正）">
              <BirthplaceInput lat={latA} lng={lngA} onPick={(v) => { setLatA(v.lat); setLngA(v.lng); }} />
            </Field>
          </div>
          <p className="mt-4 text-sm font-semibold">对方</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="称呼（选填）">
              <input className={inputCls} maxLength={12} placeholder="如：林之遥" value={nameB} onChange={(e) => setNameB(e.target.value)} />
            </Field>
            <Field label="出生日期" required>
              <input className={inputCls} type="date" value={dateB} onChange={(e) => setDateB(e.target.value)} />
            </Field>
            <Field label="出生时间">
              <input className={inputCls} type="time" value={timeB} onChange={(e) => setTimeB(e.target.value)} />
            </Field>
            <Field label="出生地（真太阳时校正）">
              <BirthplaceInput lat={latB} lng={lngB} onPick={(v) => { setLatB(v.lat); setLngB(v.lng); }} />
            </Field>
          </div>
          {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
          <button
            onClick={submit}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
          >
            开始测评

          </button>
        </ReportForm>
      ) : flow.phase === "running" ? (
        <>
          <ReportRunning error={flow.error} />
          {flow.markdown ? (
            <section className="mt-4 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {showPaywall ? <RechargeModal message={flow.error} onClose={() => setShowPaywall(false)} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-white p-5 text-center transition-colors hover:bg-vermilion-wash">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          <CompatibilitySummaryCard detail={detail} />
          <ReportPosterButtons
            fileName={`缘分伴侣匹配_${nameA || "我方"}×${nameB || "对方"}`}
            trackKey="compat_poster"
            build={async () => {
              const meta = detail?.reportMetadataJson ? JSON.parse(detail.reportMetadataJson) : {};
              const a = { name: nameA.trim() || "我方", birthTime: `${dateA}T${timeA}:00`, latitude: latA, longitude: lngA };
              const b = { name: nameB.trim() || "对方", birthTime: `${dateB}T${timeB}:00`, latitude: latB, longitude: lngB };
              const fit = await fetchMarriageFitWuxing(a, b);
              return buildCompatibilityPoster(
                a.name,
                b.name,
                Number(meta.overall_harmony_rate ?? detail?.riskLevel ?? 75),
                String(meta.attraction_index ?? "MEDIUM"),
                String(meta.friction_index ?? "MEDIUM"),
                Array.isArray(meta.relational_tags) ? meta.relational_tags.map(String) : [],
                typeof meta.communication_key === "string" ? meta.communication_key : detail?.annualMantra ?? null,
                fit,
              );
            }}
          />
          {flow.markdown ? (
            <section className="ink-in mt-5 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
          <button onClick={flow.reset} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
            再测一次
          </button>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}
