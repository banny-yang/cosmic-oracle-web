/**
 * 长尾页共享的数据层：名字灵感库（name-gallery）按矩阵维度取真实名字、
 * 姓氏谐音提示、五行字库。全部容错——失败返回空值，页面区块自行隐藏，
 * 绝不让数据抖动影响页面 200（与地名页 name-samples.ts 同一口径）。
 */
import { get } from "@/lib/api";
import { currentZodiacSlug } from "@/lib/surnames";
import type { SurnameNoteView } from "@/components/surname-note";

export interface GalleryName {
  word: string;
  pinyin?: string | null;
  gender?: string | null;
  score?: number | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
}

/** 灵感库筛选参数：姓氏页/城市×姓氏页按姓氏、典籍页按出处、五行页按主五行、生肖页按生肖。 */
interface GalleryQuery {
  gender: "M" | "F";
  surname?: string;
  source?: string;
  element?: string;
  /** 生肖 slug（默认当前生肖年，与姓氏×生肖页同口径）。 */
  zodiac?: string;
  page?: number;
  size?: number;
}

function fetchGallery(query: GalleryQuery): Promise<GalleryName[]> {
  return get<{ items?: GalleryName[] | null }>(
    "/api/v1/naming/name-gallery",
    {
      page: query.page ?? 0,
      size: query.size ?? 8,
      gender: query.gender,
      zodiac: query.zodiac ?? currentZodiacSlug(),
      ...(query.surname ? { surname: query.surname } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.element ? { element: query.element } : {}),
    },
    { auth: false, timeoutMs: 10_000 },
  )
    .then((r) => (Array.isArray(r?.items) ? r.items : []))
    .catch(() => []);
}

/** 单性别取名字：生肖性别页整组直出、典籍页按书目合并时用。 */
export const fetchGalleryNames = fetchGallery;

/** 男/女两组并行；任一失败只隐藏该组。 */
export async function fetchGalleryPair(query: Omit<GalleryQuery, "gender">): Promise<{
  boys: GalleryName[];
  girls: GalleryName[];
}> {
  const [boys, girls] = await Promise.all([
    fetchGallery({ ...query, gender: "M" }),
    fetchGallery({ ...query, gender: "F" }),
  ]);
  return { boys, girls };
}

/** 该姓的谐音/连读提示；未收录返回 found=false，页面隐藏该区块。 */
export function fetchSurnameNoteView(surname: string): Promise<SurnameNoteView> {
  return get<SurnameNoteView>(
    "/api/v1/naming/surname-note",
    { surname },
    { auth: false, timeoutMs: 8000 },
  ).catch(() => ({ found: false }));
}

export interface CharRow {
  char: string;
  pinyin: string;
  tone: number;
  strokes: number;
  radical: string | null;
  element: string;
}

/** 五行字库：适名字按语料频次降序（/api/v1/naming/char-index）。 */
export function fetchCharsByElement(element: string, limit = 48): Promise<CharRow[]> {
  return get<{ items?: CharRow[] | null }>(
    "/api/v1/naming/char-index",
    { element, limit },
    { auth: false, timeoutMs: 10_000 },
  )
    .then((r) => (Array.isArray(r?.items) ? r.items : []))
    .catch(() => []);
}
