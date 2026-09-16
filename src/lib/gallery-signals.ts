/**
 * 灵感库 → 起名的风格信号（环 1 增强）：出处/性别/分类转成起名页可预填参数。
 * 出处匹配用关键词包含（语料 63 种出处里大量是具体篇名如「苏轼《饮湖上初晴后雨》」），
 * 匹配不上返回 undefined（不带典籍过滤，全量字库）。
 */

/** 出处关键词 → 起名页典籍类目码（与 naming 页 classicGroups 一致）。 */
const SOURCE_KEYWORDS: [string, string][] = [
  ["诗经", "shijing"],
  ["楚辞", "chuci"],
  ["离骚", "chuci"],
  ["唐诗", "tangshi"],
  ["宋词", "songci"],
  ["世说", "weijin"],
  ["文心", "weijin"],
  ["洛神", "weijin"],
  ["周易", "zhouyi"],
  ["论语", "lunyu"],
  ["尚书", "rujia"],
  ["礼记", "rujia"],
  ["孟子", "rujia"],
  ["中庸", "rujia"],
  ["大学", "rujia"],
  ["四书", "rujia"],
  ["道德", "daojia"],
  ["庄子", "daojia"],
  ["史记", "shishi"],
  ["通鉴", "shishi"],
  ["山海", "bowu"],
  ["本草", "bowu"],
  ["水经", "bowu"],
];

/** 灵感库出处 → 典籍类目码；匹配不上返回 undefined。 */
export function sourceToCategory(source?: string | null): string | undefined {
  if (!source) return undefined;
  for (const [kw, code] of SOURCE_KEYWORDS) {
    if (source.includes(kw)) return code;
  }
  return undefined;
}

/** 典籍类目码 → 中文名（起名页 chip 展示用）。 */
export const CATEGORY_LABELS: Record<string, string> = {
  shijing: "诗经",
  chuci: "楚辞",
  tangshi: "唐诗",
  songci: "宋词",
  weijin: "世说文心",
  zhouyi: "周易",
  lunyu: "论语",
  rujia: "尚书礼记",
  daojia: "道德庄子",
  shishi: "史记通鉴",
  bowu: "山海本草",
};

/**
 * 灵感库气质分类 → 家长期望 tag（只做高置信映射，宁可少选不可错选；
 * 五行补益/经典不过时/经典好名无对应 tag，不预选）。
 */
export function categoryToExpectation(category?: string | null): string | undefined {
  switch (category) {
    case "君子风范":
      return "温文尔雅";
    case "清雅涵养":
      return "善良仁爱";
    case "大气格局":
      return "大有可为";
    case "惊艳出众":
      return "才艺出众";
    case "诗词雅韵":
      return "聪慧睿智";
    default:
      return undefined;
  }
}
