import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { BirthplaceInput } from "@/components/birthplace-input";
import { BaziPreviewPanel } from "@/components/bazi-preview-panel";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, PaywallCard } from "@/components/report-flow";
import { getAuthUser } from "@/lib/auth";
import { useFeaturePrice } from "@/lib/use-feature-price";

export const Route = createFileRoute("/marriage")({
  component: Marriage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/marriage" },
    ],
    meta: [
      { title: "八字合婚 · 对脉名鉴" },
      { name: "keywords", content: "八字合婚,合婚,夫妻合婚,婚姻匹配,八字配对" },
      { property: "og:url", content: "https://www.oracle.duimai.net/marriage" },
      {
        name: "description",
        content: "十项传统合婚视角看两个人的契合，仅供文化参考与娱乐。",
      },
    ],
  }),
});

function Marriage() {
  const featureEnabled = useFeatureEnabled("MARRIAGE_FIT");
  const price = useFeaturePrice("MARRIAGE_FIT", 19);
  const flow = useReportFlow();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [lat, setLat] = useState(39.9);
  const [lng, setLng] = useState(116.4);
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!date) return setErr("请选择对方出生日期");
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "MARRIAGE_FIT",
      partners: [
        {
          name: name.trim() || "对方",
          birthTime: `${date}T${time}:00`,
          latitude: lat,
          longitude: lng,
        },
      ],
    });
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="八字合婚" path="/marriage" />
      {featureEnabled === false ? (
        <FeatureClosed title="八字合婚" />
      ) : (
        <>
      <PageHeader
        eyebrow={`功能四 · 消耗 ${price} 点`}
        title="八字合婚"
        desc="十项传统合婚视角看两个人的契合，仅供文化参考与娱乐。"
      />

      {flow.phase === "form" ? (
        <ReportForm>
          <div className="grid grid-cols-2 gap-3">
            <Field label="对方称呼（选填）">
              <input className={inputCls} maxLength={12} placeholder="如：阿沅" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="对方出生日期">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="出生时间">
              <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="出生地（用于真太阳时校正）">
              <BirthplaceInput
                lat={lat}
                lng={lng}
                onPick={(v) => {
                  setLat(v.lat);
                  setLng(v.lng);
                }}
              />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            需要本人的出生信息（在「我的」页维护）；对方信息仅用于本次分析。
          </p>
          {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
          <button
            onClick={submit}
            className="w-full rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99]"
          >
            开始分析
          </button>
        </ReportForm>
      ) : null}
      {flow.phase === "form" ? (
        <BaziPreviewPanel partnerBirth={{ date, time, lat, lng }} />
      ) : null}
      {flow.phase === "running" ? (
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
          {flow.needPay ? <PaywallCard message={flow.error} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          {flow.markdown ? (
            <section className="ink-in mt-7 max-w-[72ch] rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
          <button onClick={flow.reset} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
            再分析一次
          </button>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}
