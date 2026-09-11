import { useState } from "react";
import { X, ImageDown, Share2, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { track } from "@/lib/track";

/** 报告海报（canvas → PNG）：通用头部/底部 + 中部由调用方绘制 */
async function drawPosterBase(opts: {
  subtitle: string;
  draw: (g: CanvasRenderingContext2D, W: number) => void;
  qrPath: string;
  qrHint: string;
  footerLine: string;
}): Promise<string> {
  const W = 720, H = 1120;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas unavailable");
  const ink = "#2B2417", accent = "#9E2B25";
  g.fillStyle = "#F6EFE3"; g.fillRect(0, 0, W, H);
  g.textAlign = "left"; g.fillStyle = "rgba(43,36,23,.55)"; g.font = "18px sans-serif";
  g.fillText("对 脉 名 鉴", 48, 64);
  g.textAlign = "right"; g.fillStyle = accent; g.font = "16px sans-serif";
  g.fillText(opts.subtitle, W - 48, 64);
  g.textAlign = "center";
  opts.draw(g, W);
  let qrOk = false;
  try {
    const qrUrl = await QRCode.toDataURL(`https://www.oracle.duimai.net${opts.qrPath}`, { margin: 1, width: 320, color: { dark: "#2B2417", light: "#F6EFE3" } });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = qrUrl;
    });
    g.drawImage(img, W - 48 - 150, H - 48 - 150 - 14, 150, 150);
    qrOk = true;
  } catch { /* 二维码失败不阻断 */ }
  g.textAlign = "left";
  g.fillStyle = "rgba(43,36,23,.8)"; g.font = "bold 22px sans-serif";
  g.fillText(opts.footerLine, 48, H - 132);
  g.fillStyle = "rgba(43,36,23,.55)"; g.font = "17px sans-serif";
  g.fillText(qrOk ? opts.qrHint : `www.oracle.duimai.net${opts.qrPath}`, 48, H - 102);
  g.fillStyle = "rgba(43,36,23,.4)"; g.font = "15px sans-serif";
  g.fillText("内容由算法基于传统文化与统计模型生成 · 仅供文化参考与娱乐", 48, H - 72);
  return cv.toDataURL("image/png");
}

/** 海报按钮 + 预览弹层（下载/分享），多报告页复用 */
export function ReportPosterButtons({
  build,
  fileName,
  trackKey,
}: {
  build: () => Promise<string>;
  fileName: string;
  trackKey: string;
}) {
  const [poster, setPoster] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const share = async (url: string) => {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        const a = document.createElement("a");
        a.download = `${fileName}.png`;
        a.href = url;
        a.click();
      }
    } catch { /* 用户取消 */ }
  };

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true); setErr("");
            try {
              const url = await build();
              setPoster(url);
              track(`${trackKey}_open`);
            } catch { setErr("海报生成失败，请重试"); }
            finally { setBusy(false); }
          }}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
          生成海报
        </button>
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true); setErr("");
            try {
              const url = await build();
              track(`${trackKey}_share`);
              await share(url);
            } catch { /* 用户取消 */ }
            finally { setBusy(false); }
          }}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper disabled:opacity-60"
        >
          <Share2 className="size-4" />
          分享结果
        </button>
      </div>
      {err ? <p className="mt-2 text-center text-xs text-vermilion-deep">{err}</p> : null}
      {poster ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={() => setPoster(null)}>
          <div className="ink-in max-h-[92vh] w-full max-w-sm overflow-hidden rounded-2xl bg-paper p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{fileName}</p>
              <button onClick={() => setPoster(null)} className="text-ink/50 hover:text-ink" title="关闭">
                <X className="size-4" />
              </button>
            </div>
            <img src={poster} alt={`${fileName}海报`} className="mt-3 max-h-[64vh] w-full rounded-xl object-contain" />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.download = `${fileName}.png`;
                  a.href = poster;
                  a.click();
                  track(`${trackKey}_download`);
                }}
                className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper"
              >
                下载图片
              </button>
              <button
                onClick={() => share(poster)}
                className="flex-1 rounded-xl bg-vermilion py-2.5 text-sm font-semibold text-paper"
              >
                分享
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink/45">长按图片也可保存或转发（手机端）</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export { drawPosterBase };

const ringHex = (score: number) => (score >= 85 ? "#047857" : score >= 65 ? "#1d4ed8" : "#b45309");
const ink = "#2B2417";

/** 缘分伴侣匹配海报绘制 */
async function buildCompatibilityPoster(
  names: string[],
  score: number,
  attraction: string,
  friction: string,
  tags: string[],
  mantra: string | null,
): Promise<string> {
  return drawPosterBase({
    subtitle: "缘分伴侣匹配",
    qrPath: "/personality",
    qrHint: "扫码打开网页版，测你们的缘分契合度",
    footerLine: "对脉名鉴 · 缘分伴侣匹配",
    draw: (g, W) => {
      g.textAlign = "center";
      g.fillStyle = ink; g.font = "bold 30px sans-serif";
      g.fillText(names.join("  ×  ") || "缘 分 伴 侣", W / 2, 150);
      const cx = W / 2, cy = 350, r = 96;
      g.lineWidth = 14;
      g.strokeStyle = "rgba(43,36,23,.08)";
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = ringHex(score); g.lineCap = "round";
      g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (score / 100)); g.stroke();
      g.fillStyle = ink; g.font = "bold 84px sans-serif";
      g.fillText(String(score), cx, cy + 18);
      g.fillStyle = "rgba(43,36,23,.45)"; g.font = "17px sans-serif";
      g.fillText("缘分契合度", cx, cy + 54);
      const lv = (v: string) => (v === "HIGH" ? "高" : v === "MEDIUM" ? "中" : v === "LOW" ? "低" : v);
      g.font = "20px sans-serif";
      g.fillStyle = "rgba(43,36,23,.5)"; g.fillText("吸引力", W / 2 - 150, 540);
      g.fillStyle = ink; g.font = "bold 30px sans-serif"; g.fillText(lv(attraction), W / 2 - 150, 576);
      g.fillStyle = "rgba(43,36,23,.5)"; g.font = "20px sans-serif"; g.fillText("摩擦指数", W / 2 + 150, 540);
      g.fillStyle = ink; g.font = "bold 30px sans-serif"; g.fillText(lv(friction), W / 2 + 150, 576);
      g.strokeStyle = "rgba(158,43,37,.3)"; g.strokeRect(70, 640, W - 140, 96);
      g.fillStyle = "rgba(43,36,23,.75)"; g.font = "20px sans-serif";
      const t = (tags.slice(0, 6).join(" · ") || "相 处 锦 囊").slice(0, 26);
      g.fillText(t, W / 2, 696);
      if (mantra) {
        g.fillStyle = "rgba(43,36,23,.55)"; g.font = "18px sans-serif";
        const m = mantra.length > 32 ? mantra.slice(0, 32) + "…" : mantra;
        g.fillText(m, W / 2, 790);
      }
    },
  });
}

/** 姓名共振海报绘制 */
async function buildNamePoster(
  nameA: string,
  nameB: string,
  score: number,
  rateLabel: string,
  threeTalents: string | null,
  resonance: string | null,
  mantra: string | null,
): Promise<string> {
  return drawPosterBase({
    subtitle: "姓名共振",
    qrPath: "/analysis",
    qrHint: "扫码打开网页版，解读你们的名字",
    footerLine: "对脉名鉴 · 姓名共振",
    draw: (g, W) => {
      g.textAlign = "center";
      g.fillStyle = ink;
      g.font = 'bold 76px "STKaiti","KaiTi",serif';
      g.fillText(nameA, W / 2 - 130, 180);
      g.fillStyle = "#9E2B25"; g.font = "bold 40px sans-serif";
      g.fillText("×", W / 2, 170);
      g.fillStyle = ink; g.font = 'bold 76px "STKaiti","KaiTi",serif';
      g.fillText(nameB, W / 2 + 130, 180);
      const cx = W / 2, cy = 420, r = 96;
      g.lineWidth = 14;
      g.strokeStyle = "rgba(43,36,23,.08)";
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = ringHex(score); g.lineCap = "round";
      g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (score / 100)); g.stroke();
      g.fillStyle = ink; g.font = "bold 84px sans-serif";
      g.fillText(String(score), cx, cy + 18);
      g.fillStyle = "rgba(43,36,23,.45)"; g.font = "17px sans-serif";
      g.fillText(rateLabel, cx, cy + 54);
      let y = 640;
      if (threeTalents) {
        g.fillStyle = "rgba(43,36,23,.5)"; g.font = "20px sans-serif";
        g.fillText("三才配置", W / 2, y);
        g.fillStyle = ink; g.font = 'bold 34px "STKaiti","KaiTi",serif';
        g.fillText(threeTalents, W / 2, y + 46);
        y += 110;
      }
      if (resonance) {
        g.fillStyle = "rgba(43,36,23,.5)"; g.font = "20px sans-serif";
        g.fillText("共振类型", W / 2, y);
        g.fillStyle = ink; g.font = "bold 28px sans-serif";
        g.fillText(resonance, W / 2, y + 42);
        y += 106;
      }
      if (mantra) {
        g.strokeStyle = "rgba(158,43,37,.3)"; g.strokeRect(70, y, W - 140, 100);
        g.fillStyle = "#9E2B25"; g.font = "16px sans-serif";
        g.fillText("能量护身符心咒", W / 2, y + 36);
        g.fillStyle = "rgba(43,36,23,.75)"; g.font = "20px sans-serif";
        const m = mantra.length > 26 ? mantra.slice(0, 26) + "…" : mantra;
        g.fillText(m, W / 2, y + 72);
      }
    },
  });
}


export { buildCompatibilityPoster, buildNamePoster };
