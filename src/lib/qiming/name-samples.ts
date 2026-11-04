/**
 * 地名页的名字参考：复用名字灵感库接口，按地名 adcode 轮换页码。
 *
 * - 服务端 3s 超时，两个性别并行，任一失败只隐藏该性别；接口整体不可用时整块隐藏，
 *   页面主体照常 200（不因样本失败加 noindex）。
 * - 10 分钟内存缓存，只缓存非空结果：空页可能是筛选组合暂时无数据，下次请求重试。
 * - 同一地名的页码固定（adcode % 12），保证同一 URL 每次 SSR 出同一批名字；
 *   越界空页回退第 0 页，避免过滤后总页数不足时整块消失。
 */
import { get } from "@/lib/api";
import { currentZodiacSlug } from "@/lib/surnames";
import type { ZodiacName } from "@/lib/zodiac-guide";

interface GalleryRow {
  word: string;
  pinyin?: string | null;
  gender?: string | null;
  score?: number | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
  elements?: string[] | string | null;
}

interface GalleryPage {
  items?: GalleryRow[] | null;
}

const SAMPLE_SIZE = 8;
const MAX_PAGE = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; items: ZodiacName[] }>();

function toName(row: GalleryRow): ZodiacName {
  const elements = Array.isArray(row.elements)
    ? row.elements
    : typeof row.elements === "string" && row.elements
      ? row.elements.split(",")
      : [];
  return {
    word: row.word,
    pinyin: row.pinyin ?? null,
    gender: row.gender ?? null,
    score: row.score ?? null,
    source: row.source ?? null,
    text: row.text ?? null,
    meaning: row.meaning ?? null,
    elements,
  };
}

function request(adcode: string, gender: "M" | "F", page: number): Promise<ZodiacName[]> {
  return get<GalleryPage>(
    "/api/v1/naming/name-gallery",
    { page, size: SAMPLE_SIZE, gender, zodiac: currentZodiacSlug() },
    { auth: false, timeoutMs: 3000 },
  ).then((res) => (res.items ?? []).map(toName));
}

async function fetchGenderNames(adcode: string, gender: "M" | "F"): Promise<ZodiacName[]> {
  const key = `${adcode}:${gender}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

  const page = Number(adcode) % MAX_PAGE;
  let items = await request(adcode, gender, page);
  if (items.length === 0 && page !== 0) items = await request(adcode, gender, 0);
  if (items.length > 0) cache.set(key, { at: Date.now(), items });
  return items;
}

export interface PlaceNameSamples {
  male: ZodiacName[];
  female: ZodiacName[];
}

export async function fetchPlaceNameSamples(adcode: string): Promise<PlaceNameSamples> {
  const [male, female] = await Promise.allSettled([
    fetchGenderNames(adcode, "M"),
    fetchGenderNames(adcode, "F"),
  ]);
  return {
    male: male.status === "fulfilled" ? male.value : [],
    female: female.status === "fulfilled" ? female.value : [],
  };
}
