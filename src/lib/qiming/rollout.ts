/**
 * 地名页放量闸门（运行时配置）。
 *
 * 这套页面正文完全通用，只有 H1/title/URL 带地名，一次性铺开 3,200 页容易被判 doorway。
 * 放量批次由运营后台写入 t_system_config，经 /api/v1/config/qiming-rollout 下发；
 * 本模块只保留默认值与归一化逻辑，网络读取与缓存见 rollout-runtime.ts。
 *
 * 已放量批次：页面不加 noindex、进 sitemap、允许百度主动推送；
 * 未放量批次：照常渲染，但 noindex、不进 sitemap、不推送。
 * 推进前先看搜索资源平台的收录率：批次 1 ≥60%、批次 2 ≥50%、批次 3 ≥40% 再往下放。
 */
export const DEFAULT_PLACE_ROLLOUT_STAGE = 1;
export const MAX_PLACE_ROLLOUT_STAGE = 4;

/** 数据生成脚本写入的批次：1 省级/省会，2 其余地级，3 直辖市/省会下辖区县，4 其余县级。 */
export type PlaceGroup = 1 | 2 | 3 | 4;

/** 后端返回的数字/字符串统一收敛为 1-4；缺失、非法或越界一律按第 1 批处理。 */
export function normalizePlaceRolloutStage(value: unknown): PlaceGroup {
  if (typeof value !== "number" && typeof value !== "string") {
    return DEFAULT_PLACE_ROLLOUT_STAGE;
  }
  const stage = Number(value);
  return Number.isInteger(stage) && stage >= 1 && stage <= MAX_PLACE_ROLLOUT_STAGE
    ? (stage as PlaceGroup)
    : DEFAULT_PLACE_ROLLOUT_STAGE;
}

export function isPlaceIndexable(
  group: number,
  stage: number = DEFAULT_PLACE_ROLLOUT_STAGE,
): boolean {
  return Number.isInteger(group) && group >= 1 && group <= stage;
}
