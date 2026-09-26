/**
 * 运营套件用户端接口（/api/v1/ops/*）：站内信、我的券与兑换、邀请。
 * 与小程序共用同一组后端接口，字段口径以 OpsClientController 为准。
 */
import { get, post } from "./api";

// ── 站内信 ──

export interface InboxMessage {
  id: string;
  title: string;
  body: string;
  /** SYSTEM / COUPON / CAMPAIGN / RECALL */
  type: string;
  read: boolean;
  createdAt: string | null;
}

export interface InboxPage {
  data: InboxMessage[];
  total: number;
  page: number;
  pageSize: number;
  unread: number;
}

/** 我的消息：分页倒序，附未读数 */
export const listMessages = (page = 1, size = 20) =>
  get<InboxPage>("/api/v1/ops/messages", { page, size });

/** 未读数（红点轮询用） */
export const getUnreadCount = () => get<{ unread: number }>("/api/v1/ops/messages/unread");

/** 全部标为已读 */
export const markAllMessagesRead = () => post<{ unread: number }>("/api/v1/ops/messages/read-all");

// ── 优惠券 ──

export interface UserCoupon {
  id: string;
  templateId: string;
  /** UNUSED / USED / EXPIRED */
  status: string;
  expiresAt: string | null;
  claimedAt: string | null;
  name?: string;
  /** FIXED_TOKENS（面值为点数） / DISCOUNT_FEN（面值为分） */
  couponType?: string;
  value?: number;
  minSpendFen?: number;
}

export interface CouponWallet {
  data: UserCoupon[];
  usable: number;
  total: number;
}

/** 我的券包 */
export const listMyCoupons = () => get<CouponWallet>("/api/v1/ops/coupons");

export interface RedeemResult {
  couponId: string;
  couponName: string;
  couponType: string;
  value: number;
  tokenBalance: number;
}

/** 兑换码兑换：点数券立即到账，抵扣券进券包 */
export const redeemCouponCode = (code: string) =>
  post<RedeemResult>("/api/v1/ops/coupons/redeem", { code });

// ── 邀请 ──

export interface InviteInfo {
  /** 邀请码 = 邀请人短号，分享链接拼 ?ref=<inviteCode> */
  inviteCode: string | null;
  /** 奖励开关（管理端「邀请奖励」页），关闭时仍记关系但不发奖 */
  enabled: boolean;
  rewardTokens: number;
  invitedTotal: number;
  rewardedTotal: number;
  earnedTokens: number;
  /** 我是否已经有邀请人（已绑定就不能再绑） */
  invited: boolean;
}

/** 我的邀请信息 */
export const getMyInvite = () => get<InviteInfo>("/api/v1/ops/invite");

/** 绑定邀请人（重复/无效静默忽略，bound=false） */
export const bindInviter = (code: string) =>
  post<{ bound: boolean }>("/api/v1/ops/invite/bind", { code });
