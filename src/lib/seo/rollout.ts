/**
 * 长尾矩阵的放量配置（纯函数，与 qiming/rollout.ts 同一套治理口径）。
 *
 * 五个矩阵各自有独立的开关值，由运营后台写入 t_system_config 的 longtail.* 键，
 * 经公开接口 /api/v1/config/longtail-rollout 一次下发；页面 head 的 noindex、
 * sitemap 与百度推送三处共用同一个值。
 *
 * - 开关型矩阵（surname/classic/wuxing/zodiacGender）：1=放开，0=关；
 * - surnamePlace 是「放开前 N 大姓」的档位值：0=关，10/30/50=放开前 N 大姓
 *   （与地名页批次叠加生效：地名页只放第 1 批的 58 个省会/直辖市入口）。
 * 缺失、非法或越界一律按默认值处理（fail-safe），绝不能因为配置错误放出未验证页面。
 */
export type LongtailMatrix = "surname" | "classic" | "surnamePlace" | "wuxing" | "zodiacGender";

export type LongtailStages = Record<LongtailMatrix, number>;

/** 线上默认值（与 V210 迁移种子一致）。 */
export const LONGTAIL_DEFAULTS: LongtailStages = {
  surname: 1,
  classic: 1,
  surnamePlace: 10,
  wuxing: 1,
  zodiacGender: 1,
};

/** 城市×姓氏页允许的姓氏档位（=放开前 N 大姓）。 */
export const SURNAME_PLACE_STAGES = [0, 10, 30, 50] as const;

function normalizeSwitch(value: unknown): number {
  return value === 1 || value === "1" ? 1 : 0;
}

/** 按矩阵收敛配置值：开关型只认 0/1，surnamePlace 只认 0/10/30/50。 */
export function normalizeLongtailStage(matrix: LongtailMatrix, value: unknown): number {
  if (matrix === "surnamePlace") {
    const stage = Number(value);
    return (SURNAME_PLACE_STAGES as readonly number[]).includes(stage) ? stage : 0;
  }
  return normalizeSwitch(value);
}

/**
 * 城市×姓氏页是否可收录：宿主城市限定为第 1 批地名的 58 个省会/直辖市入口
 * （地名批次放开的城市），姓氏按放开档位截断。
 */
export function isSurnamePlaceIndexable(
  placeGroup: number,
  surnameRank: number,
  surnamePlaceStage: number,
): boolean {
  return placeGroup === 1 && surnameRank >= 1 && surnameRank <= surnamePlaceStage;
}
