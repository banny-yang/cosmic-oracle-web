import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ImageDown, Share2, Loader2 } from "lucide-react";
import { post } from "@/lib/api";
import { track } from "@/lib/track";
import {
  ACCENT,
  ACCENT_LINE,
  ELEMENT_ORDER,
  FONT_KAI,
  FONT_SANS,
  FONT_SEAL,
  INK,
  INK_FAINT,
  INK_SOFT,
  createPosterCanvas,
  dayMasterInfo,
  drawInnerFrame,
  drawPaper,
  drawPosterFooter,
  drawPosterHeader,
  drawWuxingPanel,
  elementZh,
  ensurePosterFonts,
  exportPoster,
  fitFontSize,
  normElement,
  normElements,
  wrapText,
  wuxingFitRows,
  wuxingFitFrom,
  type WuxingFit,
  type WuxingRow,
  type WuxingSeg,
} from "@/lib/poster-kit";

/** 双规格出图：PNG 供下载（无损），JPEG 供分享（体积友好） */
export type PosterImages = { png: string; jpg: string };

/** 报告海报底座（720×1280，2x 出图）：纸底 + 页头 + 中部绘制 + 页脚二维码 */
async function drawPosterBase(opts: {
  subtitle: string;
  draw: (g: CanvasRenderingContext2D, W: number) => void;
  qrPath: string;
  qrHint: string;
  footerLine: string;
}): Promise<PosterImages> {
  const W = 720,
    H = 1280;
  await ensurePosterFonts();
  const { cv, g } = createPosterCanvas(W, H);
  await drawPaper(g, W, H);
  drawInnerFrame(g, W, H);
  await drawPosterHeader(g, W, opts.subtitle);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  opts.draw(g, W);
  await drawPosterFooter(g, W, H, {
    qrPath: opts.qrPath,
    brand: opts.footerLine,
    hint: opts.qrHint,
    note: "内容由算法基于传统文化与统计模型生成 · 仅供文化参考与娱乐",
  });
  return exportPoster(cv);
}

/** 双方称呼一行：甲 × 乙（毛笔体，按最长名自适应字号，居中排布） */
function drawPairNames(
  g: CanvasRenderingContext2D,
  W: number,
  a: string,
  b: string,
  y: number,
): void {
  const size = fitFontSize(g, `${a} × ${b}`, (px) => `${px}px ${FONT_SEAL}`, 46, W - 150, 22);
  const xFont = `bold ${Math.max(18, Math.round(size * 0.58))}px ${FONT_SANS}`;
  const nameFont = `${size}px ${FONT_SEAL}`;
  g.font = nameFont;
  const wa = g.measureText(a).width;
  const wb = g.measureText(b).width;
  g.font = xFont;
  const wx = g.measureText("×").width;
  const gap = 24;
  let x = (W - (wa + gap + wx + gap + wb)) / 2;
  g.textAlign = "left";
  g.fillStyle = INK;
  g.font = nameFont;
  g.fillText(a, x, y);
  x += wa + gap;
  g.fillStyle = ACCENT;
  g.font = xFont;
  g.fillText("×", x, y - 2);
  x += wx + gap;
  g.fillStyle = INK;
  g.font = nameFont;
  g.fillText(b, x, y);
}

/** 契合度圆环 + 分数（报告海报共用） */
function drawScoreRing(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  score: number,
  label: string,
): void {
  const ringHex = (s: number) => (s >= 85 ? "#047857" : s >= 65 ? "#1d4ed8" : "#b45309");
  g.save();
  g.lineWidth = 14;
  g.strokeStyle = "rgba(43,36,23,.08)";
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = ringHex(score);
  g.lineCap = "round";
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (Math.min(100, score) / 100));
  g.stroke();
  g.fillStyle = INK;
  g.font = `bold 84px ${FONT_SANS}`;
  g.textAlign = "center";
  g.fillText(String(score), cx, cy + 18);
  g.fillStyle = INK_FAINT;
  g.font = `17px ${FONT_SANS}`;
  g.fillText(label, cx, cy + 54);
  g.restore();
}

/** 姓名共振海报的五行数据（来自报告元数据 reportMetadataJson） */
export type NameWuxing = {
  dayMaster: string | null;
  favorable: string | null;
  threeTalents: string | null;
  attribute: Record<string, string> | null;
  remedyRate: string | null;
};

const STRENGTH_ZH: Record<string, string> = { strong: "强", medium: "中", weak: "弱" };

/** 姓名共振五行行：日主 / 喜用 / 三才 / 用字五行画像 / 八字补缺（缺键整行不画） */
function nameWuxingRows(wx: NameWuxing | null): WuxingRow[] {
  if (!wx) return [];
  const rows: WuxingRow[] = [];
  const dm = dayMasterInfo(wx.dayMaster);
  if (dm.zh) rows.push({ label: "日主", segs: [{ text: dm.zh, el: dm.element, dot: true }] });
  const fav = normElements(wx.favorable);
  if (fav.length) {
    const segs: WuxingSeg[] = [];
    fav.forEach((el, i) => {
      if (i) segs.push({ text: " · ", soft: true });
      segs.push({ text: elementZh(el), el, dot: true });
    });
    rows.push({ label: "喜用", segs });
  }
  const talents = (wx.threeTalents ?? "").split("").filter((ch) => ch.trim());
  if (talents.length) {
    rows.push({ label: "三才", chips: talents.map((ch) => ({ zh: ch })) });
  }
  const attr = new Map<string, string>();
  for (const [k, v] of Object.entries(wx.attribute ?? {})) {
    const el = normElement(k);
    if (el) attr.set(el, v);
  }
  const attrSegs: WuxingSeg[] = [];
  for (const el of ELEMENT_ORDER) {
    const v = attr.get(el);
    if (!v) continue;
    if (attrSegs.length) attrSegs.push({ text: "　", soft: true });
    attrSegs.push({ text: elementZh(el) || el, el, dot: true });
    attrSegs.push({ text: ` ${STRENGTH_ZH[v] ?? v}`, soft: true });
  }
  if (attrSegs.length) rows.push({ label: "用字五行", segs: attrSegs });
  if (wx.remedyRate) {
    rows.push({
      label: "八字补缺",
      segs: [{ text: wx.remedyRate }, { text: " 用字补救率", soft: true }],
    });
  }
  return rows;
}

/** 海报按钮 + 预览弹层（PNG 下载 / JPEG 分享），多报告页复用 */
export function ReportPosterButtons({
  build,
  fileName,
  trackKey,
}: {
  build: () => Promise<PosterImages>;
  fileName: string;
  trackKey: string;
}) {
  const [poster, setPoster] = useState<PosterImages | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.download = name;
    a.href = url;
    a.click();
  };

  const share = async (imgs: PosterImages) => {
    try {
      const blob = await (await fetch(imgs.jpg)).blob();
      const file = new File([blob], `${fileName}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        download(imgs.jpg, `${fileName}.jpg`);
      }
    } catch {
      /* 用户取消 */
    }
  };

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setErr("");
            try {
              const imgs = await build();
              setPoster(imgs);
              track(`${trackKey}_open`);
            } catch {
              setErr("海报生成失败，请重试");
            } finally {
              setBusy(false);
            }
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
            setBusy(true);
            setErr("");
            try {
              const imgs = await build();
              track(`${trackKey}_share`);
              await share(imgs);
            } catch {
              /* 用户取消 */
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-vermilion py-3 text-sm font-semibold text-paper disabled:opacity-60"
        >
          <Share2 className="size-4" />
          分享结果
        </button>
      </div>
      {err ? <p className="mt-2 text-center text-xs text-vermilion-deep">{err}</p> : null}
      {poster
        ? createPortal(
            // 弹层挂到 body：结果页各区块的 ink-in 入场动画会让 transform 常驻（形成堆叠上下文，
            // 并成为 fixed 定位的包含块），留在原位置会被后面的卡片盖住
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
              onClick={() => setPoster(null)}
            >
              <div
                className="ink-in max-h-[92vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{fileName}</p>
                  <button
                    onClick={() => setPoster(null)}
                    className="text-ink-soft hover:text-ink"
                    title="关闭"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <img
                  src={poster.png}
                  alt={`${fileName}海报`}
                  className="mt-3 max-h-[64vh] w-full rounded-xl object-contain"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      download(poster.png, `${fileName}.png`);
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
                <p className="mt-2 text-center text-[11px] text-ink-soft">长按图片也可保存或转发（手机端）</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export { drawPosterBase };

/** 缘分伴侣海报：免费合婚预览接口取双方日主与五行契合（best-effort，失败返回 null 隐藏该块） */
export async function fetchMarriageFitWuxing(
  a: { name: string; birthTime: string; latitude: number; longitude: number },
  b: { name: string; birthTime: string; latitude: number; longitude: number },
): Promise<WuxingFit | null> {
  try {
    const d = await post<{
      persons?: { dayMaster?: string | null }[];
      items?: { key?: string; score?: number; positives?: string[]; concerns?: string[] }[];
    }>(
      "/api/v1/reports/marriage-fit/preview",
      { personA: a, personB: b },
      { auth: false, timeoutMs: 6000 },
    );
    return wuxingFitFrom(d.persons, d.items);
  } catch {
    return null;
  }
}

/** 缘分伴侣匹配海报绘制 */
async function buildCompatibilityPoster(
  nameA: string,
  nameB: string,
  score: number,
  attraction: string,
  friction: string,
  tags: string[],
  mantra: string | null,
  fit: WuxingFit | null,
): Promise<PosterImages> {
  return drawPosterBase({
    subtitle: "缘分伴侣匹配",
    qrPath: "/personality",
    qrHint: "扫码打开网页版，测你们的缘分契合度",
    footerLine: "对脉名鉴 · 缘分伴侣匹配",
    draw: (g, W) => {
      g.textAlign = "center";
      drawPairNames(g, W, nameA || "我 方", nameB || "对 方", 176);
      drawScoreRing(g, W / 2, 396, 96, score, "缘分契合度");
      const lv = (v: string) => (v === "HIGH" ? "高" : v === "MEDIUM" ? "中" : v === "LOW" ? "低" : v);
      g.textAlign = "center";
      g.fillStyle = INK_FAINT;
      g.font = `20px ${FONT_SANS}`;
      g.fillText("吸引力", W / 2 - 150, 570);
      g.fillText("摩擦指数", W / 2 + 150, 570);
      g.fillStyle = INK;
      g.font = `bold 30px ${FONT_SANS}`;
      g.fillText(lv(attraction), W / 2 - 150, 606);
      g.fillText(lv(friction), W / 2 + 150, 606);
      // 相处锦囊
      const tagText = tags.slice(0, 6).join(" · ") || "相 处 锦 囊";
      g.font = `20px ${FONT_SANS}`;
      const tagLines = wrapText(g, tagText, W - 176).slice(0, 2);
      const boxH = 34 + tagLines.length * 30;
      g.save();
      g.beginPath();
      g.roundRect(70, 650, W - 140, boxH, 12);
      g.fillStyle = "rgba(241,231,215,.55)";
      g.fill();
      g.strokeStyle = ACCENT_LINE;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "rgba(43,36,23,.75)";
      g.font = `20px ${FONT_SANS}`;
      tagLines.forEach((line, i) => g.fillText(line, W / 2, 650 + 40 + i * 30));
      g.restore();
      // 五行块
      let y = 650 + boxH + 34;
      const rows = wuxingFitRows(fit);
      if (rows.length) y += drawWuxingPanel(g, 48, y, W - 96, rows) + 30;
      if (mantra) {
        g.fillStyle = ACCENT;
        g.font = `16px ${FONT_SANS}`;
        g.fillText("能量护身符心咒", W / 2, y + 6);
        g.fillStyle = "rgba(43,36,23,.75)";
        g.font = `20px ${FONT_SANS}`;
        wrapText(g, mantra, W - 160)
          .slice(0, 2)
          .forEach((line, i) => g.fillText(line, W / 2, y + 40 + i * 30));
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
  resonance: string | null,
  mantra: string | null,
  wuxing: NameWuxing | null,
): Promise<PosterImages> {
  return drawPosterBase({
    subtitle: "姓名共振",
    qrPath: "/analysis",
    qrHint: "扫码打开网页版，解读你们的名字",
    footerLine: "对脉名鉴 · 姓名共振",
    draw: (g, W) => {
      g.textAlign = "center";
      drawPairNames(g, W, nameA, nameB, 180);
      drawScoreRing(g, W / 2, 400, 96, score, rateLabel || "双人姓名契合度");
      let y = 566;
      const rows = nameWuxingRows(wuxing);
      if (rows.length) {
        y += drawWuxingPanel(g, 48, y, W - 96, rows) + 30;
      } else {
        // 老报告缺五行键：下方区块整体下移，把余白分到上下两侧
        const blocks = (resonance ? 96 : 0) + (mantra ? 100 : 0);
        y += Math.max(0, Math.round((1080 - y - blocks) * 0.45));
      }
      if (resonance) {
        g.fillStyle = INK_FAINT;
        g.font = `20px ${FONT_SANS}`;
        g.fillText("共振类型", W / 2, y + 4);
        g.fillStyle = INK;
        g.font = `bold 30px ${FONT_KAI}`;
        g.fillText(resonance, W / 2, y + 44);
        y += 96;
      }
      if (mantra) {
        g.save();
        g.beginPath();
        g.roundRect(70, y, W - 140, 100, 12);
        g.fillStyle = "rgba(241,231,215,.55)";
        g.fill();
        g.strokeStyle = ACCENT_LINE;
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = ACCENT;
        g.font = `16px ${FONT_SANS}`;
        g.fillText("能量护身符心咒", W / 2, y + 36);
        g.fillStyle = "rgba(43,36,23,.75)";
        g.font = `20px ${FONT_SANS}`;
        wrapText(g, mantra, W - 176)
          .slice(0, 2)
          .forEach((line, i) => g.fillText(line, W / 2, y + 72 + i * 26));
        g.restore();
      }
    },
  });
}

export { buildCompatibilityPoster, buildNamePoster };
