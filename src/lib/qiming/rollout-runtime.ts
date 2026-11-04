/**
 * 地名页放量批次的运行时读取。
 *
 * 批次由运营后台维护，经公开接口 /api/v1/config/qiming-rollout 下发；页面 head、
 * sitemap 与百度推送三处闸门都从这里取同一个值。缓存口径：
 * - 成功 30 秒：运营改批次后最多半分钟内生效，又不会每个请求都打后端；
 * - 失败 10 秒：接口抖动时不至于把每个 SSR 请求都拖到超时；
 * - 失败时沿用上次成功值，进程刚启动还没有成功值则按第 1 批（fail-safe）。
 *
 * 超时压到 800ms：这是内部读接口，正常在几十毫秒内返回；宁可短暂按旧批次，
 * 也不让 SEO 页面为了一个开关等几秒。
 */
import { get } from "@/lib/api";
import { DEFAULT_PLACE_ROLLOUT_STAGE, normalizePlaceRolloutStage } from "./rollout";

const SUCCESS_TTL_MS = 30_000;
const FAILURE_TTL_MS = 10_000;
const FETCH_TIMEOUT_MS = 800;

interface CachedStage {
  stage: number;
  at: number;
  ttl: number;
}

let cached: CachedStage | null = null;
let inflight: Promise<number> | null = null;

async function fetchStage(): Promise<number> {
  try {
    const body = await get<{ stage?: unknown }>(
      "/api/v1/config/qiming-rollout",
      {},
      { auth: false, timeoutMs: FETCH_TIMEOUT_MS },
    );
    const stage = normalizePlaceRolloutStage(body?.stage);
    cached = { stage, at: Date.now(), ttl: SUCCESS_TTL_MS };
    return stage;
  } catch {
    const stage = cached?.stage ?? DEFAULT_PLACE_ROLLOUT_STAGE;
    cached = { stage, at: Date.now(), ttl: FAILURE_TTL_MS };
    return stage;
  }
}

/** 当前放量批次（1-4）；永远不会 reject，接口异常时返回上次值或第 1 批。 */
export function getPlaceRolloutStage(): Promise<number> {
  if (cached && Date.now() - cached.at < cached.ttl) {
    return Promise.resolve(cached.stage);
  }
  inflight ??= fetchStage().finally(() => {
    inflight = null;
  });
  return inflight;
}
