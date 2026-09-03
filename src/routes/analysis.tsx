import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, Field, inputCls } from "@/components/app-shell";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, PaywallCard } from "@/components/report-flow";
import { getAuthUser } from "@/lib/auth";

export const Route = createFileRoute("/analysis")({
  component: Analysis,
  head: () => ({
    meta: [
      { title: "姓名解析 · 对脉名鉴" },
      {
        name: "description",
        content: "逐字拆解字义、音韵与诗句出处，看看一个名字的来路与气质。",
      },
    ],
  }),
});

function Analysis() {
  const flow = useReportFlow();
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!nameA.trim()) return setErr("请输入要解析的姓名");
    if (!nameB.trim()) return setErr("请输入对比姓名（姓名解析为双名对照）");
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "NAME",
      fullLegalName: nameA.trim(),
      matchPartnerName: nameB.trim(),
    });
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="功能二 · 消耗 3 点"
        title="姓名解析"
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
          {flow.needPay ? <PaywallCard message={flow.error} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          {flow.markdown ? (
            <section className="ink-in mt-7 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
          <button onClick={flow.reset} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
            再解析一个
          </button>
        </>
      )}
    </AppShell>
  );
}
