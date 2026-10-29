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
