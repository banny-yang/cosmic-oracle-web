import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, Field, inputCls, BreadcrumbJsonLd } from "@/components/app-shell";
import { useFeatureEnabled, useFeaturePrice } from "@/lib/use-feature-price";
import { FeatureClosed } from "@/components/feature-closed";
import { BirthplaceInput } from "@/components/birthplace-input";
import { useReportFlow, ReportForm, MiniMarkdown, ReportRunning, PaywallCard } from "@/components/report-flow";
import { BaziPreviewPanel, type BaziPreviewData } from "@/components/bazi-preview-panel";
import { BaziResultHero } from "@/components/bazi-result-hero";
import { PenLine, X, ImageDown, Share2, Loader2, Lock } from "lucide-react";
import QRCode from "qrcode";
import { track } from "@/lib/track";
import { getAuthUser, useAuth } from "@/lib/auth";
import { post } from "@/lib/api";
import { refreshBalance } from "@/lib/balance";

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

/** 点数不足毛玻璃锁定层：结果已在后台算好，充值到账后回到本页自动清晰展示。 */
function LockedOverlay({ price, balance, loggedIn }: { price: number; balance: number; loggedIn: boolean }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-paper/45 p-4">
      <div className="w-full max-w-xs rounded-2xl bg-paper-2/95 p-5 text-center shadow-xl ring-1 ring-ink/10">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-vermilion/12 text-vermilion-deep">
          <Lock className="size-5" />
        </span>
        {loggedIn ? (
          <>
            <p className="mt-3 text-sm font-semibold text-ink">点数不足，结果已暂存</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              解锁完整结果与 AI 解读需 {price} 点，当前余额 {balance} 点
            </p>
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <img src="/mp-qrcode.jpg" alt="对脉名鉴小程序码" className="size-20 rounded object-contain ring-1 ring-ink/10" />
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
  const [poster, setPoster] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
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
            <section className="mt-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
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
          {/* 海报：下载与分享 */}
          {preview ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  if (!preview || posterBusy) return;
                  setPosterBusy(true);
                  try {
                    const url = await buildMarriagePoster(preview);
                    setPoster(url);
                    track("marriage_poster_open");
                  } catch { setErr("海报生成失败，请重试"); }
                  finally { setPosterBusy(false); }
                }}
                disabled={posterBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-60"
              >
                {posterBusy ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
                生成合婚海报
              </button>
              <button
                onClick={async () => {
                  if (!preview || posterBusy) return;
                  setPosterBusy(true);
                  try {
                    const url = await buildMarriagePoster(preview);
                    setPoster(url);
                    track("marriage_poster_open");
                    const blob = await (await fetch(url)).blob();
                    const file = new File([blob], "八字合婚海报.png", { type: "image/png" });
                    if (navigator.canShare?.({ files: [file] })) {
                      await navigator.share({ files: [file], title: "八字合婚" });
                    } else {
                      const a = document.createElement("a");
                      a.download = "八字合婚海报.png";
                      a.href = url;
                      a.click();
                    }
                    track("marriage_poster_share");
                  } catch { /* 用户取消或浏览器不支持 */ }
                  finally { setPosterBusy(false); }
                }}
                disabled={posterBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper disabled:opacity-60"
              >
                <Share2 className="size-4" />
                分享结果
              </button>
            </div>
          ) : null}
          {poster ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
              onClick={() => setPoster(null)}
            >
              <div
                className="ink-in max-h-[92vh] w-full max-w-sm overflow-hidden rounded-2xl bg-paper p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">合婚海报</p>
                  <button onClick={() => setPoster(null)} className="text-ink/50 hover:text-ink" title="关闭">
                    <X className="size-4" />
                  </button>
                </div>
                <img src={poster} alt="八字合婚海报" className="mt-3 max-h-[64vh] w-full rounded-xl object-contain" />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (!poster) return;
                      const a = document.createElement("a");
                      a.download = "八字合婚海报.png";
                      a.href = poster;
                      a.click();
                      track("marriage_poster_download");
                    }}
                    className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
                  >
                    下载图片
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator ? (
                    <button
                      onClick={async () => {
                        if (!poster) return;
                        track("marriage_poster_share");
                        try {
                          const blob = await (await fetch(poster)).blob();
                          const file = new File([blob], "八字合婚海报.png", { type: "image/png" });
                          if (navigator.canShare?.({ files: [file] })) {
                            await navigator.share({ files: [file], title: "八字合婚" });
                          } else {
                            await navigator.share({ title: "八字合婚", text: "我们的八字合婚结果", url: "https://www.oracle.duimai.net/marriage" });
                          }
                        } catch { /* 用户取消 */ }
                      }}
                      className="flex-1 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper"
                    >
                      分享
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-center text-[11px] text-ink/45">长按图片也可保存或转发（手机端）</p>
              </div>
            </div>
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

/** 合婚海报（canvas → PNG dataURL，含 Web 推广二维码） */
async function buildMarriagePoster(data: BaziPreviewData): Promise<string> {
  const W = 720, H = 1280;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas unavailable");
  const ink = "#2B2417", accent = "#9E2B25";
  const ringHex = LEVEL_HEX[data.level] ?? "#d97706";
  g.fillStyle = "#F6EFE3"; g.fillRect(0, 0, W, H);
  // header
  g.textAlign = "left"; g.fillStyle = "rgba(43,36,23,.55)"; g.font = "18px sans-serif";
  g.fillText("对 脉 名 鉴", 48, 64);
  g.textAlign = "right"; g.fillStyle = accent; g.font = "16px sans-serif";
  g.fillText("传统合婚 · 十项评鉴", W - 48, 64);
  g.textAlign = "center";
  // 双方四柱
  const drawPerson = (person: { name: string; pillars: string[] } | undefined, cx: number, tag: string) => {
    g.fillStyle = "rgba(43,36,23,.5)"; g.font = "14px sans-serif";
    g.fillText(tag, cx, 108);
    g.fillStyle = ink; g.font = "bold 26px sans-serif";
    g.fillText(person?.name || tag, cx, 142);
    const pillars = (person?.pillars ?? ["—", "—", "—", "—"]).slice(0, 4);
    const bw = 46, gap = 8, total = pillars.length * bw + (pillars.length - 1) * gap;
    let x = cx - total / 2;
    for (const p of pillars) {
      g.strokeStyle = "rgba(158,43,37,.35)"; g.strokeRect(x, 160, bw, 66);
      g.fillStyle = ink; g.font = "22px serif";
      g.fillText(p.slice(0, 1), x + bw / 2, 188);
      g.fillText(p.slice(1, 2), x + bw / 2, 218);
      x += bw + gap;
    }
  };
  drawPerson(data.persons?.[0], 180, "男方");
  drawPerson(data.persons?.[1], 540, "女方");
  g.fillStyle = accent; g.font = 'bold 30px "STKaiti","KaiTi",serif';
  g.fillText("合", 360, 205);
  // 综合指数圆环
  const cx = W / 2, cy = 372, r = 84;
  g.lineWidth = 13;
  g.strokeStyle = "rgba(43,36,23,.08)";
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ringHex; g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (data.total / 100)); g.stroke();
  g.fillStyle = ink; g.font = "bold 74px sans-serif";
  g.fillText(String(data.total), cx, cy + 14);
  g.fillStyle = "rgba(43,36,23,.45)"; g.font = "16px sans-serif";
  g.fillText("综合合婚指数", cx, cy + 46);
  // 等级徽章 + 总评
  const bw2 = 96, bh2 = 34, bx = cx - bw2 / 2, by = 478;
  g.fillStyle = ringHex;
  g.beginPath(); g.roundRect(bx, by, bw2, bh2, 17); g.fill();
  g.fillStyle = "#F6EFE3"; g.font = "bold 20px sans-serif";
  g.fillText(data.level, cx, by + 24);
  g.fillStyle = "rgba(43,36,23,.7)"; g.font = "18px sans-serif";
  const sum = data.summary.length > 34 ? data.summary.slice(0, 34) + "…" : data.summary;
  g.fillText(sum, cx, 548);
  // 十项列表
  let y = 592;
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    g.textAlign = "left";
    g.fillStyle = "rgba(43,36,23,.4)"; g.font = "15px sans-serif";
    g.fillText(String(i + 1).padStart(2, "0"), 56, y + 6);
    g.fillStyle = ink; g.font = "19px sans-serif";
    g.fillText(it.label, 92, y + 6);
    const bx1 = 240, bx2 = 540, byy = y - 6;
    g.fillStyle = "rgba(43,36,23,.1)";
    g.beginPath(); g.roundRect(bx1, byy, bx2 - bx1, 12, 6); g.fill();
    const hex = it.score >= 80 ? "#047857" : it.score >= 70 ? "#1d4ed8" : it.score >= 60 ? "#b45309" : "#be123c";
    g.fillStyle = hex;
    g.beginPath(); g.roundRect(bx1, byy, Math.max(12, (bx2 - bx1) * it.score / 100), 12, 6); g.fill();
    g.textAlign = "right"; g.fillStyle = ink; g.font = "bold 21px sans-serif";
    g.fillText(String(it.score), 660, y + 7);
    g.textAlign = "center";
    y += 41;
  }
  // footer 二维码 + 引导
  let qrOk = false;
  try {
    const qrUrl = await QRCode.toDataURL("https://www.oracle.duimai.net/marriage", { margin: 1, width: 320, color: { dark: "#2B2417", light: "#F6EFE3" } });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = qrUrl;
    });
    const qrSize = 150;
    g.drawImage(img, W - 48 - qrSize, H - 48 - qrSize - 14, qrSize, qrSize);
    qrOk = true;
  } catch { /* 二维码失败不阻断海报 */ }
  g.textAlign = "left";
  g.fillStyle = "rgba(43,36,23,.8)"; g.font = "bold 22px sans-serif";
  g.fillText("对脉名鉴 · 八字合婚", 48, H - 132);
  g.fillStyle = "rgba(43,36,23,.55)"; g.font = "17px sans-serif";
  g.fillText(qrOk ? "扫码打开网页版，为两个人合一次婚" : "www.oracle.duimai.net/marriage", 48, H - 102);
  g.fillStyle = "rgba(43,36,23,.4)"; g.font = "15px sans-serif";
  g.fillText("十项传统合婚维度 · 评分仅供文化参考与娱乐", 48, H - 72);
  return cv.toDataURL("image/png");
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
