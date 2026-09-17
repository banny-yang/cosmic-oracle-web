/**
 * 轻量埋点封装：上报自建统计（/api/v1/analytics/collect，明细落 t_web_visit）。
 * 函数签名与事件名保持不变，调用方零改动；失败静默，绝不影响业务。
 */

import { beacon } from "@/lib/analytics";

type TrackProps = Record<string, string | number | boolean | undefined | null>;

export function track(event: string, props?: TrackProps) {
  beacon({ event, props: props ? JSON.stringify(props) : undefined });
}
