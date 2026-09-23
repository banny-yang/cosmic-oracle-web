import { get } from "@/lib/api";

/**
 * 系统实有典籍书目树（公开接口 GET /api/v1/naming/classic-books），
 * 服务端（《典籍馆》loader）与客户端（起名表单两级选择）共用。
 * 数据源为 t_classic_book：书单由语料表同步维护，运营在管理端定「用户可选 / 宣传展示」。
 */

export interface ClassicBookNode {
  book: string;
  intro: string | null;
  highlight: string | null;
  highlightSource: string | null;
  sentenceCount: number;
  entryCount: number;
  /** 用户可在起名表单按此书选典（管理端开关）。 */
  selectable: boolean;
  /** 在《典籍馆》展示（管理端开关）。 */
  promoted: boolean;
  sortOrder: number;
}

export interface ClassicCategoryNode {
  /** 类目编码，与起名请求 classicSources 同口径（shijing/chuci/…/mengxue）。 */
  code: string;
  name: string;
  books: ClassicBookNode[];
}

export interface ClassicGroupNode {
  group: string;
  name: string;
  categories: ClassicCategoryNode[];
}

export interface ClassicBookTree {
  groups: ClassicGroupNode[];
  totalBooks: number;
  totalSentences: number;
}

/** 取书目树；失败返回 null（调用方各自回落：表单回到类目轴，典籍馆隐藏板块）。 */
export function fetchClassicBookTree(): Promise<ClassicBookTree | null> {
  return get<ClassicBookTree>(
    "/api/v1/naming/classic-books",
    {},
    { auth: false, timeoutMs: 10000 },
  ).catch(() => null);
}

/** 类目编码 → 可选书目（只取 selectable，按 sortOrder 排序）。 */
export function selectableBooksByCategory(tree: ClassicBookTree | null): Map<string, ClassicBookNode[]> {
  const out = new Map<string, ClassicBookNode[]>();
  for (const g of tree?.groups ?? []) {
    for (const c of g.categories) {
      const books = c.books.filter((b) => b.selectable);
      if (books.length) out.set(c.code, books);
    }
  }
  return out;
}

/** 典籍馆展示书目（只取 promoted，按类目原序展开）。 */
export function promotedCategories(tree: ClassicBookTree | null): ClassicCategoryNode[] {
  const out: ClassicCategoryNode[] = [];
  for (const g of tree?.groups ?? []) {
    for (const c of g.categories) {
      const books = c.books.filter((b) => b.promoted);
      if (books.length) out.push({ ...c, books });
    }
  }
  return out;
}
