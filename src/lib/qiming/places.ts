/**
 * 地名数据的运行时读取。
 *
 * 数据由 scripts/build-places.mjs 生成：provinces.json 只有 31 条摘要（总入口用），
 * 每个省一棵完整树放在 provinces/{slug}.json，用 import.meta.glob 按需加载——
 * 不把 1.4MB 地名数据打进首包，也不把整棵树塞进 loader data。
 *
 * 页面只用 displayName / path / group 这类展示字段；parent 与 province 系列字段留给
 * 路由做层级校验和 301 纠偏。
 */
import provinceSummaries from "@/data/places/provinces.json";

export interface ProvinceSummary {
  adcode: string;
  name: string;
  displayName: string;
  slug: string;
  path: string;
}

export type PlaceLevel = "province" | "prefecture" | "county";

export interface PlaceNode {
  adcode: string;
  name: string;
  displayName: string;
  slug: string;
  path: string;
  level: PlaceLevel;
  group: number;
  parentName?: string;
  parentDisplayName?: string;
  parentSlug?: string;
  parentPath?: string;
  provinceName?: string;
  provinceDisplayName?: string;
  provinceSlug?: string;
  provincePath?: string;
  isCapital?: boolean;
  noCountyLevel?: boolean;
  children?: PlaceNode[];
}

export interface ProvinceTree extends PlaceNode {
  level: "province";
  children: PlaceNode[];
}

/** 页面/loader 真正需要的字段（不含 children，避免整棵树进序列化数据）。 */
export interface PlaceInfo {
  adcode: string;
  displayName: string;
  slug: string;
  path: string;
  level: PlaceLevel;
  group: number;
}

const PROVINCE_MODULES = import.meta.glob<ProvinceTree>("../../data/places/provinces/*.json", {
  import: "default",
});

const provinceLoaders = new Map<string, () => Promise<ProvinceTree>>();
for (const [file, load] of Object.entries(PROVINCE_MODULES)) {
  const slug = file.slice(file.lastIndexOf("/") + 1).replace(/\.json$/, "");
  provinceLoaders.set(slug, load);
}

/** 31 个省级入口（按数据源顺序，即行政区划代码顺序）。 */
export const PROVINCES: ProvinceSummary[] = provinceSummaries;

const summaryBySlug = new Map(PROVINCES.map((p) => [p.slug, p]));

export function provinceSummary(slug: string): ProvinceSummary | null {
  return summaryBySlug.get(slug) ?? null;
}

/** 按省 slug 加载完整地名树；未知 slug 返回 null（调用方据此 404）。 */
export async function loadProvince(slug: string): Promise<ProvinceTree | null> {
  const load = provinceLoaders.get(slug);
  if (!load) return null;
  return load();
}

export function toPlaceInfo(node: PlaceNode): PlaceInfo {
  return {
    adcode: node.adcode,
    displayName: node.displayName,
    slug: node.slug,
    path: node.path,
    level: node.level,
    group: node.group,
  };
}

/** 省下的直接子节点：地级市/自治州/地区/盟，或省直管的县级单位。 */
export function findProvinceChild(tree: ProvinceTree, slug: string): PlaceNode | null {
  return tree.children.find((child) => child.slug === slug) ?? null;
}

/**
 * 在整棵树里按 slug 找节点（最多三层）。
 * 只用于「层级写错时 301 到规范地址」；同一 slug 命中多个节点时返回 null，
 * 宁可按 404 处理也不猜。
 */
export function findPlaceAnywhere(tree: ProvinceTree, slug: string): PlaceNode | null {
  const matches: PlaceNode[] = [];
  const walk = (node: PlaceNode, depth: number) => {
    if (node.slug === slug) matches.push(node);
    if (depth >= 2) return;
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(tree, 0);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
