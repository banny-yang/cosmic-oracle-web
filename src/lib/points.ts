/**
 * 免费得点任务（后端 PointTaskService）：分享、发起投票、投票达标、邀请好友。
 *
 * 额度与开关都在 t_system_config（app.points.task.*），管理端可改、即时生效；
 * 前端只负责展示状态和触发，发点判定全在服务端台账（同一任务重放不会重复到账）。
 */
import { get, post } from "./api";
import { getAuthUser } from "./auth";
import { refreshBalance } from "./balance";

/** claimed_today 今日已领 / claimed 已领过 / claimable 现在可领 / 其余为待触发的前置动作 */
export type PointTaskState =
  | "claimed_today"
  | "claimed"
  | "claimable"
  | "after_vote_create"
  | "after_votes";

export interface PointTask {
  key: string;
  label: string;
  desc: string;
  tokens: number;
  state: PointTaskState;
}

export interface PointTaskStatus {
  enabled: boolean;
  voteUnlockThreshold: number;
  tokenBalance: number;
  earnedLast30Days: number;
  tasks: PointTask[];
}

export interface ShareClaimResult {
  granted?: boolean;
  tokens?: number;
  tokenBalance?: number;
}

/** 我的任务清单（未登录返回 null）。 */
export async function getPointTasks(): Promise<PointTaskStatus | null> {
  if (!getAuthUser()) return null;
  return get<PointTaskStatus>("/api/v1/ops/points/tasks");
}

/**
 * 分享成功即领点（每日 1 次）。失败静默：分享本身已经完成，
 * 不该因为发点失败打断用户；余额刷新只在真的到账时做。
 */
export async function claimShareTask(): Promise<ShareClaimResult | null> {
  if (!getAuthUser()) return null;
  try {
    const r = await post<ShareClaimResult>("/api/v1/ops/points/tasks/share", {});
    if (r?.granted) void refreshBalance();
    return r ?? null;
  } catch {
    return null;
  }
}
