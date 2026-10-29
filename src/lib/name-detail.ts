/**
 * 名字详情页（/names/detail/{名字}）的路径口径。
 *
 * 站内链接走 router 的 params（自动编码），sitemap 与 canonical 需要自己拼，
 * 这里统一一份，避免出现「/names/detail/明远」与「%E6%98%8E%E8%BF%9C」两种写法
 * 被搜索引擎当成两个地址。
 */
export function nameDetailPath(word: string): string {
  return `/names/detail/${encodeURIComponent(word.trim())}`;
}

/** 判断「是否有详情页」所需的最少字段（灵感库卡片与生肖名字卡片结构兼容）。 */
export interface NameDetailFields {
  score?: number | null;
  pinyin?: string | null;
  meaning?: string | null;
  text?: string | null;
  source?: string | null;
}

/**
 * 与后端 NameDetailService.isPublishable 同一口径：评分、拼音、出处原句、意蕴、书名
 * 五项齐全才出详情页。列表卡片按同一判断挂链接，缺一项就不挂，避免点进 404。
 */
export function hasDetailPage(n: NameDetailFields): boolean {
  return (
    typeof n.score === "number" &&
    Boolean(n.pinyin) &&
    Boolean(n.meaning) &&
    Boolean(n.text) &&
    Boolean(n.source)
  );
}
