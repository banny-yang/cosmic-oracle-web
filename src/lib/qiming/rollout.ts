/**
 * 地名页放量闸门。
 *
 * 这套页面正文完全通用，只有 H1/title/URL 带地名，一次性铺开 3,200 页容易被判 doorway。
 * 分批放量的唯一开关就是这个常量：group > stage 的页面照常渲染，但 noindex 且不进 sitemap；
 * 百度主动推送也要过同一道闸（见 qiming/push-gate.ts）。
 *
 * 推进前先看搜索资源平台的收录率：批次 1 ≥60%、批次 2 ≥50%、批次 3 ≥40% 再往下放。
 */
export const PLACE_ROLLOUT_STAGE = 1;

/** 数据生成脚本写入的批次：1 省级/省会，2 其余地级，3 直辖市/省会下辖区县，4 其余县级。 */
export type PlaceGroup = 1 | 2 | 3 | 4;

export function isPlaceIndexable(group: number): boolean {
  return group <= PLACE_ROLLOUT_STAGE;
}
