import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, RechargeModal } from "@/components/report-flow";
import { NameSummaryCard, useReportDetail, type ReportDetail } from "@/components/report-summary-cards";
import { ReportPosterButtons, buildNamePoster } from "@/components/report-poster";
import { getAuthUser } from "@/lib/auth";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";

export const Route = createFileRoute("/analysis")({
  component: Analysis,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/analysis" },
    ],
    meta: [
      { title: "姓名共振 · 对脉名鉴" },
      { name: "keywords", content: "姓名共振,名字含义,字义出处,名字音律,姓名文化" },
      { property: "og:url", content: "https://www.oracle.duimai.net/analysis" },
      {
        name: "description",
        content: "逐字拆解字义、音韵与诗句出处，看看一个名字的来路与气质。",
      },
    ],
  }),
});

function Analysis() {
  const price = useFeaturePrice("INSIGHT_NAME", 9);
  const featureEnabled = useFeatureEnabled("INSIGHT_NAME");
  const flow = useReportFlow();
  const [showPaywall, setShowPaywall] = useState(false);
  useEffect(() => {
    if (flow.needPay) setShowPaywall(true);
  }, [flow.needPay]);
  const detail = useReportDetail(flow.reportId, flow.phase === "done" && !flow.error);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!nameA.trim()) return setErr("请输入要解析的姓名");
    if (!nameB.trim()) return setErr("请输入对比姓名（姓名共振为双名对照）");
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "NAME",
      namePairs: [{ personA: nameA.trim(), personB: nameB.trim() }],
    });
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="姓名共振" path="/analysis" />
      {featureEnabled === false ? (
        <FeatureClosed title="姓名共振" />
      ) : (
        <>
      <PageHeader
        eyebrow={`功能二 · 消耗 ${price} 点`}
        title="姓名共振"
        desc="逐字拆解字义与音韵的来路，读出一个名字的气质。"
      />

      {flow.phase === "form" ? (
        <ReportForm>
          <Field label="要解析的姓名">
            <input className={inputCls} maxLength={12} placeholder="如：沈清嘉" value={nameA} onChange={(e) => setNameA(e.target.value)} />
          </Field>
          <Field label="对比姓名">
            <input className={inputCls} maxLength={12} placeholder="如：林知远" value={nameB} onChange={(e) => setNameB(e.target.value)} />
          </Field>
          {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
          <button
            onClick={submit}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
          >
            开始解析
          </button>
        </ReportForm>
      ) : flow.phase === "running" ? (
        <>
          <ReportRunning error={flow.error} />
          {flow.markdown ? (
            <section className="mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {showPaywall ? <RechargeModal message={flow.error} onClose={() => setShowPaywall(false)} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          <NameSummaryCard detail={detail} />
          <ReportPosterButtons
            fileName={`姓名共振_${nameA}×${nameB}`}
            trackKey="name_poster"
            build={async () => {
              const meta = detail?.reportMetadataJson ? JSON.parse(detail.reportMetadataJson) : {};
              const score = Number(meta.pair_resonance_rate ?? meta.resonance_compatibility_rate ?? detail?.riskLevel ?? 75);
              const names = Array.isArray(meta.partner_names) && meta.partner_names.length
                ? meta.partner_names.map(String)[0].split(" · ")
                : [meta.seeker_name ?? nameA, meta.partner_name ?? nameB];
              return buildNamePoster(
                names[0] || nameA, (names[1] ?? nameB) || nameB,
                score,
                Array.isArray(meta.partner_names) && meta.partner_names.length > 1 ? "平均姓名契合度" : "双人姓名契合度",
                typeof meta.three_talents === "string" ? meta.three_talents : null,
                meta.resonance_type === "harmonic_healing" ? "良性共振" : meta.resonance_type === "neutral_balance" ? "中性平衡" : meta.resonance_type === "malignant_excitation" ? "恶性亢奋" : null,
                typeof meta.energy_mantra === "string" ? meta.energy_mantra : detail?.annualMantra ?? null,
              );
            }}
          />
          {flow.markdown ? (
            <section className="ink-in mt-5 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
          <button onClick={flow.reset} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
            再解析一个
          </button>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}
