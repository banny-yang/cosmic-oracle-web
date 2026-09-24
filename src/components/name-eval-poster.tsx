import { drawPosterBase, type PosterImages } from "@/components/report-poster";
import {
  ACCENT,
  ACCENT_LINE,
  FONT_KAI,
  FONT_SANS,
  FONT_SEAL,
  FONT_SONG,
  INK,
  INK_SOFT,
  PAPER,
  fitFontSize,
  wrapText,
} from "@/lib/poster-kit";

/**
 * 名字评测名片（720×1280 逻辑尺寸，2x 出图为 1440×2560）。
 *
 * 只画事实：姓名、总分与等级、五维雷达与条形、判词、典籍原句。不含吉凶、五行缺补等表述。
 * 底座（纸底/页头/页脚二维码）与导出复用 report-poster 的 drawPosterBase。
 */
export type NameEvalPosterData = {
  fullName: string;
  score: number;
  grade: string;
  gradeLabel: string;
  verdict: string;
  /** 五维（轴标签用短名，如「典籍」；weight 为满分权重），顺序即雷达与条形的顺序 */
  dimensions: { label: string; score: number; weight: number }[];
  /** 典籍原句与出处（无出处时为 null，整块省略） */
  sentence?: string | null;
  book?: string | null;
  /** 分享暗号（≥85 分名片展示） */
  shareCode?: string | null;
};

/** 等级胶囊底色：站点主朱红（等于结果页 `bg-vermilion` 的实色胶囊），比海报主色 ACCENT 亮一档。 */
const PILL_VERMILION = "#B6451F";

/** 总分环（与评测结果页同构：14% 透明轨道 + 圆头进度弧 + 环心总分，比例照 ScoreRing）。 */
function drawScoreRing(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  score: number,
) {
  const ratio = Math.min(100, Math.max(0, score)) / 100;
  g.save();
  g.strokeStyle = ACCENT;
  g.lineWidth = Math.round(r * 0.12);
  g.globalAlpha = 0.14;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  g.lineCap = "round";
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ACCENT;
  g.font = `bold ${Math.round(r / 2)}px ${FONT_SANS}`;
  g.fillText(score.toFixed(1), cx, cy - 5);
  g.globalAlpha = 0.55;
  g.font = `12px ${FONT_SANS}`;
  g.fillText("总分", cx, cy + Math.round(r * 0.34));
  g.restore();
}

/** 总分环 + 姓名 + 实色等级胶囊：与结果页同一套表达（左环右名，环心总分，等级为实色块）。 */
function drawScoreHeader(
  g: CanvasRenderingContext2D,
  W: number,
  data: Pick<NameEvalPosterData, "fullName" | "score" | "grade" | "gradeLabel">,
) {
  const r = 70;
  const gap = 26;
  const nameSize = fitFontSize(g, data.fullName, (px) => `${px}px ${FONT_SEAL}`, 46, 300, 26);
  g.font = `${nameSize}px ${FONT_SEAL}`;
  const nameW = g.measureText(data.fullName).width;

  const pillFont = 18;
  const pillPadX = 14;
  const pillH = 32;
  const pillText = `${data.grade} 级 · ${data.gradeLabel}`;
  g.font = `bold ${pillFont}px ${FONT_SANS}`;
  const pillW = Math.ceil(g.measureText(pillText).width) + pillPadX * 2;

  const cy = 172;
  const blockW = Math.max(nameW, pillW);
  const left = (W - (r * 2 + gap + blockW)) / 2;
  const textX = left + r * 2 + gap;
  const blockTop = cy - (nameSize + 10 + pillH) / 2;

  drawScoreRing(g, left + r, cy, r, data.score);

  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `${nameSize}px ${FONT_SEAL}`;
  g.fillText(data.fullName, textX, blockTop + Math.round(nameSize * 0.85));

  const pillTop = blockTop + nameSize + 10;
  g.fillStyle = PILL_VERMILION;
  g.beginPath();
  g.roundRect(textX, pillTop, pillW, pillH, pillH / 2);
  g.fill();
  g.fillStyle = PAPER;
  g.font = `bold ${pillFont}px ${FONT_SANS}`;
  g.textBaseline = "middle";
  g.fillText(pillText, textX + pillPadX, pillTop + pillH / 2 + 1);
}

/** 画布五维雷达（与页面 SVG 版同构：四道同心环 + 五轴 + 分数多边形）。 */
function drawRadar(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  axes: { label: string; score: number; weight: number }[],
) {
  const n = axes.length;
  const at = (i: number, ratio: number): [number, number] => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio];
  };
  const ratioOf = (score: number) => Math.min(100, Math.max(0, score)) / 100;
  g.save();
  g.lineWidth = 1;
  g.strokeStyle = "rgba(43,36,23,.16)";
  for (const k of [0.25, 0.5, 0.75, 1]) {
    g.beginPath();
    axes.forEach((_, i) => {
      const [x, y] = at(i, k);
      if (i === 0) {
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
      }
    });
    g.closePath();
    g.stroke();
  }
  g.strokeStyle = "rgba(43,36,23,.12)";
  axes.forEach((_, i) => {
    const [x, y] = at(i, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.stroke();
  });
  g.beginPath();
  axes.forEach((d, i) => {
    const [x, y] = at(i, ratioOf(d.score));
    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  });
  g.closePath();
  g.fillStyle = ACCENT;
  g.globalAlpha = 0.16;
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = ACCENT;
  g.lineWidth = 2;
  g.stroke();
  g.textBaseline = "middle";
  axes.forEach((d, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const cos = Math.cos(a);
    const [x, y] = at(i, 1.26);
    g.textAlign = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
    g.fillStyle = INK_SOFT;
    g.font = `15px ${FONT_SANS}`;
    g.fillText(d.label, x, y - 9);
    g.fillStyle = INK;
    g.font = `bold 17px ${FONT_SANS}`;
    g.fillText(String(Math.round(d.score)), x, y + 11);
  });
  g.restore();
}

/** 五维条形：标签 + 0-100 分数条 + 分值（右侧留出权重位）。 */
function drawDimBars(
  g: CanvasRenderingContext2D,
  topY: number,
  rows: { label: string; score: number; percent: number }[],
) {
  const labelX = 72;
  const trackX = 176;
  const trackW = 396;
  const scoreX = 600;
  const rowH = 44;
  g.save();
  g.textBaseline = "middle";
  rows.forEach((row, i) => {
    const y = topY + i * rowH;
    g.textAlign = "left";
    g.fillStyle = INK_SOFT;
    g.font = `20px ${FONT_KAI}`;
    g.fillText(row.label, labelX, y);
    g.fillStyle = "rgba(43,36,23,.10)";
    g.fillRect(trackX, y - 6, trackW, 12);
    g.fillStyle = ACCENT;
    g.fillRect(
      trackX,
      y - 6,
      Math.round((trackW * Math.min(100, Math.max(0, row.score))) / 100),
      12,
    );
    g.textAlign = "right";
    g.fillStyle = INK;
    g.font = `bold 20px ${FONT_SANS}`;
    g.fillText(String(Math.round(row.score)), scoreX, y);
    g.textAlign = "left";
    g.fillStyle = "rgba(43,36,23,.45)";
    g.font = `14px ${FONT_SANS}`;
    g.fillText(`· ${row.percent}%`, scoreX + 8, y + 1);
  });
  g.restore();
}

/** 判词卡：细朱红边框 + 圆角，返回卡片底边 y。 */
function drawVerdictCard(
  g: CanvasRenderingContext2D,
  topY: number,
  lines: string[],
  lineH = 34,
): number {
  const x = 72;
  const w = 576;
  const padY = 26;
  const h = padY * 2 + lines.length * lineH;
  g.save();
  g.strokeStyle = ACCENT_LINE;
  g.lineWidth = 1.4;
  g.beginPath();
  g.roundRect(x, topY, w, h, 14);
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `22px ${FONT_KAI}`;
  lines.forEach((line, i) => {
    g.fillText(line, x + w / 2, topY + padY + 24 + i * lineH);
  });
  g.restore();
  return topY + h;
}

export async function buildNameEvalPoster(data: NameEvalPosterData): Promise<PosterImages> {
  return drawPosterBase({
    subtitle: "汉字美学评测名片",
    qrPath: "/name-eval",
    // 页脚三行都不换行，暗号统一用短句，完整暗号在页面与二维码落地上呈现
    qrHint: data.shareCode ? "微信搜索【对脉名鉴】免费测名字" : "扫码测一测你的名字",
    footerLine: "对脉名鉴 · 名字评测",
    draw: (g, W) => {
      const cx = W / 2;
      // 姓名 + 总分环 + 等级胶囊
      drawScoreHeader(g, W, data);

      // 五维雷达
      drawRadar(g, cx, 394, 98, data.dimensions);

      // 五维条形
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = INK_SOFT;
      g.font = `18px ${FONT_KAI}`;
      g.fillText("五 维 拆 解", cx, 536);
      drawDimBars(
        g,
        578,
        data.dimensions.map((d) => ({
          label: d.label,
          score: d.score,
          percent: d.weight,
        })),
      );

      // 判词（wrapText 按当前字体度量，必须先设字号再折行，否则画出来会超出卡框）
      g.font = `22px ${FONT_KAI}`;
      const verdictLines = wrapText(g, data.verdict, 528).slice(0, 3);
      const cardBottom = drawVerdictCard(g, 796, verdictLines.length ? verdictLines : ["—"]);

      // 典籍原句 + 出处
      if (data.sentence) {
        g.textAlign = "center";
        g.fillStyle = INK;
        g.font = `21px ${FONT_SONG}`;
        wrapText(g, `「${data.sentence}」`, 592)
          .slice(0, 2)
          .forEach((line, i) => g.fillText(line, cx, cardBottom + 48 + i * 30));
        if (data.book) {
          g.fillStyle = INK_SOFT;
          g.font = `19px ${FONT_KAI}`;
          g.fillText(`——《${data.book}》`, cx, cardBottom + 48 + 68);
        }
      }
    },
  });
}
