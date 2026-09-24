/**
 * 奇门九宫格排盘渲染——完整移植 Flutter 端 QimenPalaceGrid（专业模式）：
 * 宫位索引序 0东南 1正南 2西南 / 3正东 4中宫 5正西 / 6东北 7正北 8西北（洛书排布）。
 * 每宫分层：卦名水印（最底）· 八神（左上，深赭黄）· 空亡○（右上）· 天盘干（右上偏下，朱砂）
 * · 星（黛蓝）/门（绛紫）/驿马（居中纵排）· 洛书宫数·方位·五行（左下）+ 地盘干（右下，墨色）
 * · 主宫/客宫/用神三色描边与顶部标记。中宫转盘无星门时标「寄坤」。
 * 配色取「墨黑 + 朱砂 + 赭黄 + 黛蓝」传统四色，全部加深以保证宣纸底上的对比度。
 * 图例：主宫（朱）/ 客宫（绿）/ 用神（青）/ 空亡（灰）。
 */

export interface QimenPlate {
  yang_dun?: boolean;
  layout?: string;
  ju_number?: number;
  jie_qi?: string;
  yuan?: string;
  year_pillar?: string;
  month_pillar?: string;
  day_pillar?: string;
  time_pillar?: string;
  fu_shou?: string;
  zhi_fu_star?: string;
  zhi_shi_door?: string;
  door_pan?: string[];
  star_pan?: string[];
  god_pan?: string[];
  tian_pan_stems?: string[];
  di_pan_stems?: string[];
}

const PALACE_NAMES = ["东南", "正南", "西南", "正东", "中宫", "正西", "东北", "正北", "西北"];
const PALACE_ELEMENTS = ["木", "火", "土", "木", "土", "金", "土", "水", "金"];
const LUOSHU_NUMBERS = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const TRIGRAM_NAMES = ["巽", "离", "坤", "震", "中", "兑", "艮", "坎", "乾"];

/** 高亮色：主=朱（web 主色）/ 客=绿 / 用神=青（与 App 端三色一致） */
const SUBJECT_COLOR = "#9E2B25";
const OBJECT_COLOR = "#16A34A";
const YONGSHEN_COLOR = "#0891B2";

export function isQimenPlate(v: unknown): v is QimenPlate {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as QimenPlate).door_pan) &&
    Array.isArray((v as QimenPlate).tian_pan_stems)
  );
}

/** 盘面头部：四柱 + 局数/节气/值符值使（中宫信息条） */
export function QimenPlateHeader({ plate }: { plate: QimenPlate }) {
  const items = [
    plate.year_pillar && `年 ${plate.year_pillar}`,
    plate.month_pillar && `月 ${plate.month_pillar}`,
    plate.day_pillar && `日 ${plate.day_pillar}`,
    plate.time_pillar && `时 ${plate.time_pillar}`,
  ].filter(Boolean) as string[];
  const meta = [
    plate.yang_dun === true ? "阳遁" : plate.yang_dun === false ? "阴遁" : "",
    plate.ju_number != null ? `${plate.ju_number} 局` : "",
    `${plate.jie_qi ?? ""}${plate.yuan ? " " + plate.yuan : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const staff = [
    plate.zhi_fu_star && `值符 ${plate.zhi_fu_star}`,
    plate.zhi_shi_door && `值使 ${plate.zhi_shi_door}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
      {items.length > 0 ? <span className="font-semibold text-ink">{items.join("　")}</span> : null}
      {meta ? <span>{meta}</span> : null}
      {staff ? <span>{staff}</span> : null}
    </div>
  );
}

function safeStr(list: string[] | undefined, index: number): string {
  const v = list?.[index];
  return v == null ? "" : String(v);
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-ink-faint">{label}</span>
    </span>
  );
}

export function QimenPalaceGrid({
  plate,
  voidPalaces = [],
  maPalace = -1,
  yongShenPalace = -1,
  subjectPalace = -1,
  objectPalace = -1,
  subjectLabel,
  showLegend = true,
}: {
  plate: QimenPlate;
  voidPalaces?: number[] | undefined;
  maPalace?: number | undefined;
  yongShenPalace?: number | undefined;
  subjectPalace?: number | undefined;
  objectPalace?: number | undefined;
  /** 主宫标记文案（命盘场景可传「本命」），缺省「主宫」 */
  subjectLabel?: string | undefined;
  showLegend?: boolean | undefined;
}) {
  const voidSet = new Set(voidPalaces);
  return (
    <div>
      {showLegend ? (
        <div className="mb-2.5 flex items-center gap-4">
          <span className="text-[13px] font-bold text-vermilion-deep">奇门遁甲 · 排盘</span>
          <span className="ml-auto flex items-center gap-3">
            <LegendDot color={SUBJECT_COLOR} label="主宫" />
            <LegendDot color={OBJECT_COLOR} label="客宫" />
            <LegendDot color={YONGSHEN_COLOR} label="用神" />
            <LegendDot color="#9C948A" label="空亡" />
          </span>
        </div>
      ) : null}
      <div className="grid select-none grid-cols-3 gap-[4px]">
        {PALACE_NAMES.map((_, i) => {
          const isCenter = i === 4;
          const isSubject = i === subjectPalace;
          const isObject = i === objectPalace;
          const isYongShen = i === yongShenPalace;
          const isVoid = voidSet.has(i);
          const isMa = i === maPalace;

          const borderColor = isSubject
            ? SUBJECT_COLOR
            : isObject
              ? OBJECT_COLOR
              : isYongShen
                ? YONGSHEN_COLOR
                : null;
          const highlightLabel = isSubject
            ? (subjectLabel ?? "主宫")
            : isObject
              ? "客宫"
              : isYongShen
                ? "用神"
                : null;

          const door = safeStr(plate.door_pan, i);
          const star = safeStr(plate.star_pan, i);
          const god = safeStr(plate.god_pan, i);
          const tianGan = safeStr(plate.tian_pan_stems, i);
          const diGan = safeStr(plate.di_pan_stems, i);

          // 中五寄坤二：转盘中宫无星门 → 宫名标「寄坤」；飞盘中宫有星则不标
          const lodgeNote = isCenter && !star ? "（寄坤）" : "";
          const palaceLabel = `${LUOSHU_NUMBERS[i]} ${PALACE_NAMES[i]}${lodgeNote}·${PALACE_ELEMENTS[i]}`;
          const showCenterColumn = !isCenter || star !== "" || door !== "";

          return (
            <div
              key={i}
              className={[
                "relative aspect-square overflow-hidden rounded-lg",
                isVoid ? "bg-paper-2" : isCenter ? "bg-vermilion-wash" : "bg-paper-3",
              ].join(" ")}
            >
              {/* 主宫/客宫/用神：顶部实色色条（原描边，扁平化后改用色块编码） */}
              {borderColor ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: borderColor }}
                />
              ) : null}

              {/* 卦名水印（中宫无卦） */}
              {!isCenter ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid place-items-center font-seal text-5xl font-bold leading-none text-ink opacity-10"
                >
                  {TRIGRAM_NAMES[i]}
                </span>
              ) : null}

              {/* 八神 · 左上（右侧留白避让空亡○/天盘干）· 深赭黄 */}
              {god ? (
                <span className="absolute left-1.5 top-1 right-9 truncate text-[10px] font-semibold text-[#8A5A1E]">
                  {god}
                </span>
              ) : null}

              {/* 空亡○ · 右上 */}
              {isVoid ? (
                <span className="absolute right-1.5 top-1 text-[10px] font-bold leading-none text-ink-soft">
                  ○
                </span>
              ) : null}

              {/* 天盘干 · 右上偏下 · 朱砂（主题红，转盘中宫无干） */}
              {tianGan ? (
                <span className="absolute right-1.5 top-[22px] text-sm font-bold leading-none text-vermilion-deep">
                  {tianGan}
                </span>
              ) : null}

              {/* 星（黛蓝）+ 门（绛紫）+ 驿马 · 居中纵排 */}
              {showCenterColumn ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2px] px-6">
                  {star ? (
                    <span className="text-[13px] font-semibold leading-tight text-[#1D5A96]">
                      {star}
                    </span>
                  ) : null}
                  {door ? (
                    <span className="text-[11px] font-semibold leading-tight text-[#7A2E5C]">
                      {door}
                    </span>
                  ) : null}
                  {isMa ? (
                    <span className="mt-[1px] rounded-full bg-paper px-1 text-[9px] font-semibold leading-tight text-ink-soft">
                      驿马
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* 底行：洛书宫数·方位·五行（左） + 地盘干（右，墨色粗体） */}
              <div className="absolute inset-x-1.5 bottom-1 flex items-end justify-between gap-1">
                <span className="whitespace-nowrap text-[9.5px] font-medium leading-none text-ink-soft">
                  {palaceLabel}
                </span>
                {diGan ? (
                  <span className="text-sm font-bold leading-none text-ink">{diGan}</span>
                ) : null}
              </div>

              {/* 主/客/用神标记 · 顶部居中 */}
              {highlightLabel && borderColor ? (
                <span
                  className="absolute inset-x-0 top-0 text-center text-[8px] font-bold leading-tight"
                  style={{ color: borderColor }}
                >
                  {highlightLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
