import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { useFeatureEnabled, useFeaturePrice } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { BirthplaceInput } from "@/components/birthplace-input";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, PaywallCard } from "@/components/report-flow";
import { BaziPreviewPanel, type BaziPreviewData } from "@/components/bazi-preview-panel";
import { BaziResultHero } from "@/components/bazi-result-hero";
import { PenLine } from "lucide-react";
import { getAuthUser } from "@/lib/auth";
import { post } from "@/lib/api";

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
        content: "输入男方女方八字与出生地，十项传统合婚维度即时速览，AI 深度解读，仅供文化参考与娱乐。",
      },
    ],
  }),
});

interface Party {
  name: string;
  date: string;
  time: string;
  lat: number;
  lng: number;
}

const MALE: Party = { name: "", date: "", time: "12:00", lat: 39.9, lng: 116.4 };
const FEMALE: Party = { name: "", date: "", time: "12:00", lat: 31.2, lng: 121.5 };

function Marriage() {
  const featureEnabled = useFeatureEnabled("MARRIAGE_FIT");
  const price = useFeaturePrice("MARRIAGE_FIT", 19);
  const flow = useReportFlow();
  const [male, setMale] = useState<Party>(MALE);
  const [female, setFemale] = useState<Party>(FEMALE);
  const [preview, setPreview] = useState<BaziPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const partyPayload = (p: Party, fallbackName: string) => ({
    name: p.name.trim() || fallbackName,
    birthTime: `${p.date}T${p.time}:00`,
    latitude: p.lat,
    longitude: p.lng,
  });

  /** 立即合婚：引擎十项即时输出（免费） */
  const runPreview = () => {
    setErr("");
    if (!male.date) return setErr("请选择男方出生日期");
    if (!female.date) return setErr("请选择女方出生日期");
    setLoading(true);
    setPreview(null);
    post<BaziPreviewData>(
      "/api/v1/reports/marriage-fit/preview",
      { personA: partyPayload(male, "男方"), personB: partyPayload(female, "女方") },
      { auth: false, timeoutMs: 15000 },
    )
      .then(setPreview)
      .catch((e: Error) => setErr(e.message || "合婚失败，请稍后再试"))
      .finally(() => setLoading(false));
  };

  /** AI 深度解读：购买后流式生成（双人出生信息随单提交，引擎按录入两人排盘） */
  const buyReport = () => {
    if (!male.date || !female.date) return runPreview();
    flow.run({
      userId: getAuthUser()?.userId,
      reportType: "MARRIAGE_FIT",
      partners: [partyPayload(male, "男方"), partyPayload(female, "女方")],
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
        desc="输入双方八字与出生地，十项传统合婚维度即时呈现，AI 逐项解读，仅供文化参考与娱乐。"
      />

      {flow.phase === "form" ? (
        <>
          <ReportForm>
            <p className="text-sm font-semibold">男方</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="称呼（选填）">
                <input className={inputCls} maxLength={12} placeholder="如：沈知远" value={male.name} onChange={(e) => setMale({ ...male, name: e.target.value })} />
              </Field>
              <Field label="出生日期" required>
                <input className={inputCls} type="date" value={male.date} onChange={(e) => setMale({ ...male, date: e.target.value })} />
              </Field>
              <Field label="出生时间">
                <input className={inputCls} type="time" value={male.time} onChange={(e) => setMale({ ...male, time: e.target.value })} />
              </Field>
              <Field label="出生地（真太阳时校正）">
                <BirthplaceInput lat={male.lat} lng={male.lng} onPick={(v) => setMale({ ...male, lat: v.lat, lng: v.lng })} />
              </Field>
            </div>
            <p className="mt-4 text-sm font-semibold">女方</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="称呼（选填）">
                <input className={inputCls} maxLength={12} placeholder="如：林知微" value={female.name} onChange={(e) => setFemale({ ...female, name: e.target.value })} />
              </Field>
              <Field label="出生日期" required>
                <input className={inputCls} type="date" value={female.date} onChange={(e) => setFemale({ ...female, date: e.target.value })} />
              </Field>
              <Field label="出生时间">
                <input className={inputCls} type="time" value={female.time} onChange={(e) => setFemale({ ...female, time: e.target.value })} />
              </Field>
              <Field label="出生地（真太阳时校正）">
                <BirthplaceInput lat={female.lat} lng={female.lng} onPick={(v) => setFemale({ ...female, lat: v.lat, lng: v.lng })} />
              </Field>
            </div>
            {err ? <p className="text-xs text-vermilion-deep">{err}</p> : null}
            <button
              onClick={runPreview}
              disabled={loading}
              className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "正在推算十项…" : "立即合婚 · 免费十项速览"}
            </button>
          </ReportForm>
          {preview ? (
            <BaziPreviewPanel data={preview} price={price} onBuy={buyReport} buying={loading} />
          ) : null}
        </>
      ) : flow.phase === "running" ? (
        <>
          {preview ? <BaziPreviewPanel data={preview} embedded /> : null}
          <ReportRunning error={flow.error} />
          {flow.markdown ? (
            <section className="mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {preview ? <BaziResultHero data={preview} persons={preview.persons} /> : null}
          {preview ? (
            <BaziPreviewPanel data={preview} embedded />
          ) : null}
          {flow.needPay ? <PaywallCard message={flow.error} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-paper-2 p-5 text-center ring-1 ring-ink/5">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          {flow.markdown ? (
            <section className="bazi-report ink-in relative mt-5 overflow-hidden rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5 [&_h2]:mt-7 [&_h2]:border-l-2 [&_h2]:border-vermilion [&_h2]:pl-2.5 [&_h3]:mt-6 [&_h3]:border-l-2 [&_h3]:border-vermilion/40 [&_h3]:pl-2.5">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-faint">
                <PenLine className="size-3.5" />
                AI 深度解读
              </div>
              <MiniMarkdown text={splitDisclaimer(flow.markdown).body} />
              {splitDisclaimer(flow.markdown).disclaimer ? (
                <p className="mt-5 border-t border-ink/5 pt-3 text-[11px] leading-relaxed text-ink-faint">
                  {splitDisclaimer(flow.markdown).disclaimer}
                </p>
              ) : null}
            </section>
          ) : null}
          <button onClick={flow.reset} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
            再合一次
          </button>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}

/** 报告尾部免责声明段落分离：命中最末含免责关键词的段落降级为脚注 */
function splitDisclaimer(markdown: string): { body: string; disclaimer: string } {
  const blocks = markdown.split(/\n\n+/);
  const re = /仅供文化参考|不构成任何决策依据|For cultural reference|not a basis for any decision/;
  for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 3); i--) {
    if (re.test(blocks[i])) {
      const disclaimer = blocks[i].replace(/^#+\s*/, "").replace(/^[-*]\s+/gm, "").trim();
      return { body: blocks.slice(0, i).join("\n\n"), disclaimer };
    }
  }
  return { body: markdown, disclaimer: "" };
}
