import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { useFeatureEnabled, useFeaturePrice } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { BirthplaceInput } from "@/components/birthplace-input";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, RechargeModal } from "@/components/report-flow";
import { BaziPreviewPanel, type BaziPreviewData } from "@/components/bazi-preview-panel";
import { BaziResultHero } from "@/components/bazi-result-hero";
import { ReportPosterButtons, type PosterImages } from "@/components/report-poster";
import {
  ACCENT, ACCENT_LINE, FONT_KAI, FONT_SANS, INK, INK_FAINT, INK_SOFT, PAPER,
  createPosterCanvas, drawInnerFrame, drawPaper, drawPosterFooter, drawPosterHeader,
  drawWuxingPanel, exportPoster, wrapText, wuxingFitFrom, wuxingFitRows,
} from "@/lib/poster-kit";
import { PenLine, Lock } from "lucide-react";
import { getAuthUser, useAuth } from "@/lib/auth";
import { post } from "@/lib/api";
import { refreshBalance } from "@/lib/balance";

export const Route = createFileRoute("/marriage")({
  component: Marriage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://name.duimai.net/marriage" },
    ],
    meta: [
      { title: "八字合婚 · 对脉名鉴" },
      { name: "keywords", content: "八字合婚,合婚,夫妻合婚,婚姻匹配,八字配对,合婚十项,日主契合,五行互补" },
      { property: "og:url", content: "https://name.duimai.net/marriage" },
      {
        name: "description",
        content:
          "输入男方女方八字与出生地，免费排盘生成十项传统合婚维度：缘分、五行互补、天干地支、夫妻宫、配偶星等，AI 深度解读契合度与相处建议，仅供文化参考与娱乐。",
      },
      { property: "og:title", content: "八字合婚 · 十项合婚维度免费速览 | 对脉名鉴" },
      {
        property: "og:description",
        content:
          "双方出生信息一键排盘，十项传统合婚维度即时评分，AI 逐项解读契合度与相处之道，支持生成合婚海报分享。",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://name.duimai.net/og-card.jpg" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "八字合婚是什么？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "八字合婚是中国传统婚配习俗：将男女双方的出生时间排成八字（四柱），从五行互补、日主关系、夫妻宫、配偶星等维度看两人的契合程度。对脉名鉴按传统十项合婚规则做量化评分，结果仅供文化参考与娱乐，不构成任何决策依据。",
              },
            },
            {
              "@type": "Question",
              name: "如何使用对脉名鉴的八字合婚？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "输入男方与女方的出生日期、出生时间与出生地，系统自动完成真太阳时校正与排盘，免费生成缘分、五行、天干、地支、夫妻宫、配偶星、性格、稳定、财运、子女十项合婚维度评分，并可解锁 AI 深度解读与合婚海报分享。",
              },
            },
            {
              "@type": "Question",
              name: "八字合婚十项包含哪些内容？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "十项维度为：缘分深浅、五行互补、天干五合、地支关系、夫妻宫宜忌、配偶星显现、性格契合、婚姻稳定、财运互补与子女缘分。每项按权重计入综合契合度，评分体系仅作趣味量化。",
              },
            },
          ],
        }),
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

/** 点数不足毛玻璃锁定层：结果已在后台算好，充值到账后回到本页自动清晰展示。 */
function LockedOverlay({ price, balance, loggedIn }: { price: number; balance: number; loggedIn: boolean }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-scrim p-4">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-vermilion-wash text-vermilion-deep">
          <Lock className="size-5" />
        </span>
        {loggedIn ? (
          <>
            <p className="mt-3 text-sm font-semibold text-ink">点数不足，结果已暂存</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              解锁完整结果与 AI 解读需 {price} 点，当前余额 {balance} 点
            </p>
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <img src="/mp-qrcode.jpg" alt="对脉名鉴小程序码" className="size-20 rounded object-contain" />
              <p className="text-[11px] text-ink-faint">微信扫码充值，到账后回到本页解锁</p>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-ink">登录后查看完整结果</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              登录并解锁后可查看完整结果，并使用 AI 对结果进行深度解读
            </p>
            <a
              href="/login?redirect=%2Fmarriage"
              className="mt-4 inline-block w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
            >
              去登录
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function Marriage() {
  const featureEnabled = useFeatureEnabled("MARRIAGE_FIT");
  const price = useFeaturePrice("MARRIAGE_FIT", 19);
  const flow = useReportFlow();
  const { user } = useAuth();
  const balance = user?.tokenBalance ?? 0;
  const insufficient = balance < price;
  const [male, setMale] = useState<Party>(MALE);
  const [female, setFemale] = useState<Party>(FEMALE);
  const [preview, setPreview] = useState<BaziPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  useEffect(() => {
    if (flow.needPay) setShowPaywall(true);
  }, [flow.needPay]);

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
      .then((d) => {
        setPreview(d);
        // 充值后回到本页即可解锁：预览就绪时同步一次最新余额
        refreshBalance();
      })
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
            <div className="relative">
              <div className={insufficient ? "pointer-events-none select-none blur-[7px]" : ""}>
                <BaziPreviewPanel data={preview} price={price} onBuy={buyReport} buying={loading} />
              </div>
              {insufficient ? <LockedOverlay price={price} balance={balance} loggedIn={!!user} /> : null}
            </div>
          ) : null}
        </>
      ) : flow.phase === "running" ? (
        <>
          {preview ? <BaziPreviewPanel data={preview} embedded /> : null}
          <ReportRunning error={flow.error} />
          {flow.markdown ? (
            <section className="mt-4 rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash">
              <MiniMarkdown text={flow.markdown} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {preview ? (
            <div className="relative">
              {/* 购买失败（点数不足等）时毛玻璃遮住结果，扣费完成后自动清晰展示 */}
              <div className={flow.needPay ? "pointer-events-none select-none blur-[7px]" : ""}>
                <BaziResultHero data={preview} persons={preview.persons} />
                <BaziPreviewPanel data={preview} embedded />
              </div>
              {flow.needPay ? <LockedOverlay price={price} balance={balance} loggedIn={!!user} /> : null}
            </div>
          ) : null}
          {showPaywall ? <RechargeModal message={flow.error} onClose={() => setShowPaywall(false)} /> : null}
          {!flow.needPay && flow.error ? (
            <section className="mt-7 rounded-2xl bg-white p-5 text-center transition-colors hover:bg-vermilion-wash">
              <p className="text-sm text-vermilion-deep">{flow.error}</p>
            </section>
          ) : null}
          {flow.markdown ? (
            <section className="bazi-report ink-in relative mt-5 overflow-hidden rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash [&_h2]:mt-7 [&_h3]:mt-6">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-faint">
                <PenLine className="size-3.5" />
                AI 深度解读
              </div>
              <MiniMarkdown text={splitDisclaimer(flow.markdown).body} />
              {splitDisclaimer(flow.markdown).disclaimer ? (
                <p className="mt-5 pt-3 text-[11px] leading-relaxed text-ink-faint">
                  {splitDisclaimer(flow.markdown).disclaimer}
                </p>
              ) : null}
            </section>
          ) : null}
          {/* 海报：下载 PNG / 分享 JPEG（共用 ReportPosterButtons） */}
          {preview ? (
            <ReportPosterButtons
              fileName="八字合婚海报"
              trackKey="marriage_poster"
              build={() => buildMarriagePoster(preview)}
            />
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

const LEVEL_HEX: Record<string, string> = {
  极佳: "#047857", 良好: "#047857", 中上: "#1d4ed8",
  一般: "#b45309", 偏低: "#be123c",
};

/** 合婚海报（canvas → PNG/JPEG dataURL，含五行块与 Web 推广二维码） */
async function buildMarriagePoster(data: BaziPreviewData): Promise<PosterImages> {
  const W = 720, H = 1280;
  const { cv, g } = createPosterCanvas(W, H);
  const ringHex = LEVEL_HEX[data.level] ?? "#d97706";
  await drawPaper(g, W, H);
  drawInnerFrame(g, W, H);
  await drawPosterHeader(g, W, "传统合婚 · 十项评鉴");
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  // 双方四柱
  const drawPerson = (
    person: { name: string; pillars: string[] } | undefined,
    cx: number,
    tag: string,
  ) => {
    g.fillStyle = INK_FAINT;
    g.font = `14px ${FONT_SANS}`;
    g.fillText(tag, cx, 118);
    g.fillStyle = INK;
    g.font = `bold 26px ${FONT_KAI}`;
    g.fillText(person?.name || tag, cx, 152);
    const pillars = (person?.pillars ?? ["—", "—", "—", "—"]).slice(0, 4);
    const bw = 46, gap = 8, total = pillars.length * bw + (pillars.length - 1) * gap;
    let x = cx - total / 2;
    for (const p of pillars) {
      g.strokeStyle = ACCENT_LINE;
      g.lineWidth = 1.5;
      g.strokeRect(x, 166, bw, 70);
      g.fillStyle = INK;
      g.font = `22px ${FONT_KAI}`;
      g.fillText(p.slice(0, 1), x + bw / 2, 196);
      g.fillText(p.slice(1, 2), x + bw / 2, 228);
      x += bw + gap;
    }
  };
  drawPerson(data.persons?.[0], 180, "男方");
  drawPerson(data.persons?.[1], 540, "女方");
  g.fillStyle = ACCENT;
  g.font = `bold 30px ${FONT_KAI}`;
  g.fillText("合", W / 2, 210);
  // 综合指数圆环
  const cx = W / 2, cy = 320, r = 68;
  g.lineWidth = 13;
  g.strokeStyle = "rgba(43,36,23,.08)";
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ringHex; g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (data.total / 100)); g.stroke();
  g.fillStyle = INK;
  g.font = `bold 74px ${FONT_SANS}`;
  g.fillText(String(data.total), cx, cy + 18);
  g.fillStyle = INK_FAINT;
  g.font = `16px ${FONT_SANS}`;
  g.fillText("综合合婚指数", cx, cy + r + 24);
  // 等级徽章 + 总评
  const bw2 = 96, bh2 = 32, bx = cx - bw2 / 2, by = 424;
  g.fillStyle = ringHex;
  g.beginPath(); g.roundRect(bx, by, bw2, bh2, 16); g.fill();
  g.fillStyle = PAPER;
  g.font = `bold 20px ${FONT_SANS}`;
  g.fillText(data.level, cx, by + 23);
  g.fillStyle = INK_SOFT;
  g.font = `18px ${FONT_SANS}`;
  wrapText(g, data.summary, W - 120).slice(0, 2).forEach((line, i) => {
    g.fillText(line, cx, 484 + i * 24);
  });
  // 五行块（引擎十项里的「五行契合」+ 双方日主）
  const fitRows = wuxingFitRows(wuxingFitFrom(data.persons, data.items), { scoreLabel: "十项之一 · 权重 15" });
  const panelH = fitRows.length ? drawWuxingPanel(g, 48, 526, W - 96, fitRows, { noteLines: 2 }) : 0;
  // 十项评鉴
  const y = panelH ? 526 + panelH + 34 : 566;
  g.textAlign = "left";
  g.fillStyle = ACCENT;
  g.font = `bold 15px ${FONT_SANS}`;
  g.fillText("十 项 评 鉴", 48, y - 22);
  g.strokeStyle = ACCENT_LINE;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(134, y - 26);
  g.lineTo(164, y - 26);
  g.stroke();
  for (const [i, it] of data.items.entries()) {
    if (!it) continue;
    const rowY = y + i * 32;
    g.textAlign = "left";
    g.fillStyle = INK_FAINT;
    g.font = `15px ${FONT_SANS}`;
    g.fillText(String(i + 1).padStart(2, "0"), 56, rowY + 5);
    g.fillStyle = INK;
    g.font = `19px ${FONT_KAI}`;
    g.fillText(it.label, 92, rowY + 5);
    const bx1 = 240, bx2 = 540, byy = rowY - 6;
    g.fillStyle = "rgba(43,36,23,.1)";
    g.beginPath(); g.roundRect(bx1, byy, bx2 - bx1, 12, 6); g.fill();
    const hex = it.score >= 80 ? "#047857" : it.score >= 70 ? "#1d4ed8" : it.score >= 60 ? "#b45309" : "#be123c";
    g.fillStyle = hex;
    g.beginPath(); g.roundRect(bx1, byy, Math.max(12, (bx2 - bx1) * it.score / 100), 12, 6); g.fill();
    g.textAlign = "right";
    g.fillStyle = INK;
    g.font = `bold 21px ${FONT_SANS}`;
    g.fillText(String(it.score), 660, rowY + 6);
  }
  g.textAlign = "center";
  await drawPosterFooter(g, W, H, {
    qrPath: "/marriage",
    brand: "对脉名鉴 · 八字合婚",
    hint: "扫码打开网页版，为两个人合一次婚",
    note: "十项传统合婚维度 · 评分仅供文化参考与娱乐",
  });
  return exportPoster(cv);
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
