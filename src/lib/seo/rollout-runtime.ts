/**
 * 长尾矩阵放量配置的运行时读取（与 qiming/rollout-runtime.ts 同一套缓存口径）。
 *
 * 批次由运营后台维护，经公开接口 /api/v1/config/longtail-rollout 一次下发五个矩阵的值；
 * 页面 head、sitemap 与百度推送三处闸门都从这里取。缓存口径：
 * - 成功 30 秒：运营改配置后最多半分钟内生效，又不会每个请求都打后端；
 * - 失败 10 秒：接口抖动时不至于把每个 SSR 请求都拖到超时；
 * - 失败时沿用上次成功值，进程刚启动还没有成功值则按默认批次（fail-safe）。
 *
 * 超时压到 800ms：这是内部读接口，正常在几十毫秒内返回；宁可短暂按旧批次，
 * 也不让 SEO 页面为了一个开关等几秒。
 */
import { get } from "@/lib/api";
import {
  LONGTAIL_DEFAULTS,
  normalizeLongtailStage,
  type LongtailMatrix,
  type LongtailStages,
} from "./rollout";

const SUCCESS_TTL_MS = 30_000;
const FAILURE_TTL_MS = 10_000;
const FETCH_TIMEOUT_MS = 800;

interface CachedStages {
  stages: LongtailStages;
  at: number;
  ttl: number;
}

let cached: CachedStages | null = null;
let inflight: Promise<LongtailStages> | null = null;

function toStages(body: { matrices?: Record<string, unknown> | null } | null | undefined) {
  const raw = body?.matrices ?? {};
  return {
    surname: normalizeLongtailStage("surname", raw["surname"]),
    classic: normalizeLongtailStage("classic", raw["classic"]),
    surnamePlace: normalizeLongtailStage("surnamePlace", raw["surnamePlace"]),
    wuxing: normalizeLongtailStage("wuxing", raw["wuxing"]),
    zodiacGender: normalizeLongtailStage("zodiacGender", raw["zodiacGender"]),
  };
}

async function fetchStages(): Promise<LongtailStages> {
  try {
    const body = await get<{ matrices?: Record<string, unknown> | null }>(
      "/api/v1/config/longtail-rollout",
      {},
      { auth: false, timeoutMs: FETCH_TIMEOUT_MS },
    );
    const stages = toStages(body);
    cached = { stages, at: Date.now(), ttl: SUCCESS_TTL_MS };
    return stages;
  } catch {
    const stages = cached?.stages ?? LONGTAIL_DEFAULTS;
    cached = { stages, at: Date.now(), ttl: FAILURE_TTL_MS };
    return stages;
  }
}

/** 全部矩阵的当前放量值；永远不会 reject，接口异常时返回上次值或默认值。 */
export function getLongtailStages(): Promise<LongtailStages> {
  if (cached && Date.now() - cached.at < cached.ttl) {
    return Promise.resolve(cached.stages);
  }
  inflight ??= fetchStages().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 单个矩阵的当前放量值（共享同一次请求与缓存）。 */
export async function getLongtailStage(matrix: LongtailMatrix): Promise<number> {
  return (await getLongtailStages())[matrix];
}
