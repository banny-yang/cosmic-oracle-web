import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { BirthplaceInput } from "@/components/birthplace-input";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, PaywallCard } from "@/components/report-flow";
import { getAuthUser } from "@/lib/auth";
import { useFeaturePrice, useFeatureEnabled } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";

export const Route = createFileRoute("/personality")({
  component: Personality,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/personality" },
    ],
    meta: [
      { title: "性格契合测评 · 对脉名鉴" },
      { name: "keywords", content: "性格契合,两人性格测评,相处建议,性格互补" },
      { property: "og:url", content: "https://www.oracle.duimai.net/personality" },
      {
        name: "description",
        content: "以传统性格倾向视角看两个人相处的分寸，仅供文化参考。",
      },
    ],
  }),
});

const relations = [
  { value: "ROMANTIC", label: "恋人 / 伴侣" },
  { value: "BUSINESS", label: "事业伙伴" },
  { value: "PARENT_CHILD", label: "亲子" },
  { value: "CAREER_MENTOR", label: "师长" },
];

function Personality() {
  const price = useFeaturePrice("INSIGHT_PAIR", 9);
  const featureEnabled = useFeatureEnabled("INSIGHT_PAIR");
  const flow = useReportFlow();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [lat, setLat] = useState(39.9);
  const [lng, setLng] = useState(116.4);
  const [relation, setRelation] = useState("ROMANTIC");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!name.trim()) return setErr("请输入对方姓名");
    if (!date) return setErr("请选择对方出生日期");
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "COMPATIBILITY",
      partners: [
        {
          name: name.trim(),
          birthTime: `${date}T${time}:00`,
          latitude: lat,
          longitude: lng,
          relationshipType: relation,
        },
      ],
    });
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="性格契合测评" path="/personality" />
      {featureEnabled === false ? (
        <FeatureClosed title="性格契合测评" />
      ) : (
        <>
      <PageHeader
        eyebrow={`功能三 · 消耗 ${price} 点`}
        title="性格契合测评"
        desc="以性格倾向看两个人相处的分寸，仅供文化参考。"
      />

      {flow.phase === "form" ? (
        <ReportForm>
          <div className="grid grid-cols-2 gap-3">
            <Field label="对方姓名">
              <input className={inputCls} maxLength={12} placeholder="如：林之遥" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="关系">
              <select className={inputCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
                {relations.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            <Field label="对方出生日期">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="出生时间">
              <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
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
          <p className="text-[11px] leading-relaxed text-ink-faint">
            需要本人的出生信息（在「我的」页维护）；对方信息仅用于本次测评。
          </p>
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
            再测一次
          </button>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}
