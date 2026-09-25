import { get } from "@/lib/api";

/**
 * 生肖取名（年份与取名的关系，公开接口 GET /api/v1/naming/zodiac-guide）。
 *
 * 服务端（/zodiac 三族页面 loader 首屏直出）与客户端共用。三处口径全在服务端：
 * 干支/生肖/立春起止由引擎同款年柱现算（前端零年份硬编码，逐年自动流转），
 * 宜忌部首取自引擎规则表（代码常量），页面文案取自 t_zodiac_guide（运营可改）。
 */

export interface ZodiacInfo {
  /** 地支英文（与引擎 branch 口径一致，如 Wu）。 */
  branch: string;
  /** 地支中文（午）。 */
  branchCn: string;
  /** 生肖（马）。 */
  animal: string;
  /** 拼音 slug（ma），URL 用。 */
  slug: string;
  /** 该生肖年干支（丙午）。 */
  ganzhi: string;
  /** 生肖年起算公历年（立春起，如 2026）。 */
  year: number;
  /** 生肖年起（立春当日，如 2026-02-04）。 */
  termStart: string;
  /** 生肖年止（次年立春前一日，如 2027-02-03）。 */
  termEnd: string;
  /** 立春交节时刻（如 2026-02-04 04:02），立春当天出生以排盘为准。 */
  termStartAt: string;
  /** 年干（丙）与年干/年支五行（火/火）。 */
  stemCn: string;
  stemElement: string;
  branchElement: string;
  /** 该生肖喜用部首（传统取名习俗整理）。 */
  preferredRadicals: string[];
  /** 该生肖忌用部首。 */
  forbiddenRadicals: string[];
  /** 一句话中性说明（合规措辞）。 */
  note: string;
}

export interface ZodiacName {
  word: string;
  pinyin?: string | null;
  gender?: string | null;
  score?: number | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
  elements?: string[] | null;
  /** 名字用字的部首。 */
  radicals?: string[] | null;
  /** 命中的喜用部首。 */
  hits?: string[] | null;
}

export interface ZodiacChar {
  char: string;
  pinyin?: string | null;
  radical: string;
  element?: string | null;
}

export interface ZodiacFaqItem {
  q: string;
  a: string;
}

export interface ZodiacCopy {
  title: string;
  intro: string;
  tips: string[];
  faq: ZodiacFaqItem[];
  seoTitle: string;
  seoDesc: string;
}

/** 同一生肖的年份（每 12 年一轮）。 */
export interface ZodiacRound {
  year: number;
  ganzhi: string;
  termStart: string;
  termEnd: string;
  current: boolean;
}

export interface ZodiacGuideView {
  info: ZodiacInfo;
  /** 是否为当前生肖年（当前生肖年每年立春自动切换）。 */
  current: boolean;
  names: ZodiacName[];
  preferredChars: ZodiacChar[];
  copy: ZodiacCopy;
  /** 近 6 轮（含本轮）年份，按年份降序。 */
  years: ZodiacRound[];
  /** 下一轮年份（+12）。 */
  nextRound: number;
}

export interface ZodiacAnimalEntry {
  branch: string;
  branchCn: string;
  animal: string;
  slug: string;
  /** 是否为当前生肖年。 */
  current: boolean;
  /** 最近一轮生肖年的起算年。 */
  year: number;
}

export interface ZodiacOverview {
  currentYear: number;
  nextYear: number;
  animals: ZodiacAnimalEntry[];
  current: ZodiacGuideView;
  next: ZodiacGuideView;
}

/** 该生肖最近一轮（animal 可传拼音 slug 如 ma，或生肖名如 马）；未知生肖返回 null。 */
export function fetchZodiacGuide(opts: {
  animal?: string;
  year?: number;
  gender?: string;
  limit?: number;
}): Promise<ZodiacGuideView | null> {
  return get<ZodiacGuideView>(
    "/api/v1/naming/zodiac-guide",
    { animal: opts.animal, year: opts.year, gender: opts.gender, limit: opts.limit },
    { auth: false, timeoutMs: 12000 },
  ).catch(() => null);
}

/** 生肖总览（当年 + 次年 + 十二生肖宫格）；失败返回 null（页面走兜底不空白）。 */
export function fetchZodiacOverview(): Promise<ZodiacOverview | null> {
  return get<ZodiacOverview>(
    "/api/v1/naming/zodiac-guide/overview",
    {},
    { auth: false, timeoutMs: 12000 },
  ).catch(() => null);
}

/** 生肖年区间文案（如「2026-02-04 起，2027-02-03 止」）。 */
export function termRange(info: ZodiacInfo): string {
  return `${info.termStart} 起，${info.termEnd} 止`;
}

/** 干支年份短语（如「丙午马年（2026-02-04 立春起）」）。 */
export function ganzhiYearText(info: ZodiacInfo): string {
  return `${info.ganzhi}${info.animal}年（${info.termStart} 立春起）`;
}

/** 生肖页路径（常青页：不带年份）。 */
export function animalPath(slug: string): string {
  return `/zodiac/${slug}`;
}

/** 生肖年份页路径（年份唯一确定生肖，故 slug 取该年的生肖）。 */
export function animalYearPath(slug: string, year: number): string {
  return `/zodiac/${slug}/${year}`;
}

/** 起名页 CTA 的 search 参数（各键显式出现；生肖页不新增起名页搜索键）。 */
export function namingCtaSearch() {
  return {
    prefer: undefined,
    x: undefined,
    src: undefined,
    g: undefined,
    cat: undefined,
    book: undefined,
  };
}
