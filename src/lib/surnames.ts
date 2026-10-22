/**
 * 姓氏×生肖取名长尾页（/names/{拼音}/{生肖slug}）的常量与工具。
 *
 * 姓氏清单按公安部全国姓名报告的人口序取前 50 个大姓；同音姓（徐/许、余/于、蒋/姜）
 * 只取先到者，用后位姓氏（卢/崔/姚）补位——URL 用拼音做唯一 slug，同音不同姓会撞地址。
 * 清单是纯前端常量：路由 loader 据此校验（未收录 → 404），sitemap 据此生成 50×12 条目。
 */

export interface Surname {
  /** 汉字姓氏。 */
  han: string;
  /** 拼音 slug（URL 用，全表唯一）。 */
  pinyin: string;
}

export const TOP_SURNAMES: Surname[] = [
  { han: "王", pinyin: "wang" },
  { han: "李", pinyin: "li" },
  { han: "张", pinyin: "zhang" },
  { han: "刘", pinyin: "liu" },
  { han: "陈", pinyin: "chen" },
  { han: "杨", pinyin: "yang" },
  { han: "黄", pinyin: "huang" },
  { han: "赵", pinyin: "zhao" },
  { han: "吴", pinyin: "wu" },
  { han: "周", pinyin: "zhou" },
  { han: "徐", pinyin: "xu" },
  { han: "孙", pinyin: "sun" },
  { han: "马", pinyin: "ma" },
  { han: "朱", pinyin: "zhu" },
  { han: "胡", pinyin: "hu" },
  { han: "郭", pinyin: "guo" },
  { han: "何", pinyin: "he" },
  { han: "林", pinyin: "lin" },
  { han: "高", pinyin: "gao" },
  { han: "罗", pinyin: "luo" },
  { han: "郑", pinyin: "zheng" },
  { han: "梁", pinyin: "liang" },
  { han: "谢", pinyin: "xie" },
  { han: "宋", pinyin: "song" },
  { han: "唐", pinyin: "tang" },
  { han: "韩", pinyin: "han" },
  { han: "邓", pinyin: "deng" },
  { han: "冯", pinyin: "feng" },
  { han: "曹", pinyin: "cao" },
  { han: "彭", pinyin: "peng" },
  { han: "曾", pinyin: "zeng" },
  { han: "田", pinyin: "tian" },
  { han: "董", pinyin: "dong" },
  { han: "潘", pinyin: "pan" },
  { han: "袁", pinyin: "yuan" },
  { han: "蔡", pinyin: "cai" },
  { han: "蒋", pinyin: "jiang" },
  { han: "余", pinyin: "yu" },
  { han: "卢", pinyin: "lu" },
  { han: "崔", pinyin: "cui" },
  { han: "杜", pinyin: "du" },
  { han: "叶", pinyin: "ye" },
  { han: "程", pinyin: "cheng" },
  { han: "苏", pinyin: "su" },
  { han: "魏", pinyin: "wei" },
  { han: "吕", pinyin: "lv" },
  { han: "丁", pinyin: "ding" },
  { han: "任", pinyin: "ren" },
  { han: "沈", pinyin: "shen" },
  { han: "姚", pinyin: "yao" },
];

/** 十二生肖（地支顺序），slug 与 /zodiac/{slug} 及灵感库 zodiac 筛选参数同口径。 */
export const ZODIAC_SLUGS: { slug: string; animal: string }[] = [
  { slug: "shu", animal: "鼠" },
  { slug: "niu", animal: "牛" },
  { slug: "hu", animal: "虎" },
  { slug: "tu", animal: "兔" },
  { slug: "long", animal: "龙" },
  { slug: "she", animal: "蛇" },
  { slug: "ma", animal: "马" },
  { slug: "yang", animal: "羊" },
  { slug: "hou", animal: "猴" },
  { slug: "ji", animal: "鸡" },
  { slug: "gou", animal: "狗" },
  { slug: "zhu", animal: "猪" },
];

export function surnameByPinyin(pinyin: string): Surname | null {
  return TOP_SURNAMES.find((s) => s.pinyin === pinyin) ?? null;
}

export function zodiacBySlug(slug: string): { slug: string; animal: string } | null {
  return ZODIAC_SLUGS.find((z) => z.slug === slug) ?? null;
}

/** 姓氏×生肖页路径（/names/wang/ma）。 */
export function surnameZodiacPath(pinyin: string, slug: string): string {
  return `/names/${pinyin}/${slug}`;
}
