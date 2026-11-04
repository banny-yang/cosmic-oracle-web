/**
 * 生成「小孩取名」地名长尾页的静态数据。
 *
 * 数据源：modood/Administrative-divisions-of-China 的 dist/pca-code.json
 * 生成命令：npm run gen:places
 *
 * 设计约束：
 * - 只保留省/地级/县级三层，折叠 `市辖区`、`县`、`省直辖县级行政区划` 等分组节点。
 * - 页面只用地名做标题/URL 关键词，所以这里不生成任何本地概况、方言、文化字段。
 * - 文件按省拆分，运行时用 import.meta.glob 动态加载；sitemap.json 只给服务端用。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";
import {
  DISPLAY_NAME_OVERRIDES,
  ETHNIC_NAMES,
  EXPECTED_PROVINCES,
  PINYIN_OVERRIDES,
  PROVINCE_META,
} from "./place-overrides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "src", "data", "places");
const PROVINCE_DIR = join(OUT_DIR, "provinces");
const AUDIT_PATH = join(__dirname, ".cache", "pinyin-audit.txt");

const SITE_ORIGIN = "https://name.duimai.net";
const SOURCE_URL =
  "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/dc3a1d7acd85ca1b0979543e9259604142c52e8e/dist/pca-code.json";
const SOURCE_SHA256 = "83b7536f853ad16beb4d37b92890a3fd7bb9d33d4f37e7c8885fb948749a9bc4";
const DATA_CUTOFF = "2022-10-31";
const LAST_MOD = "2026-11-04";

const GROUP_NODE_NAMES = new Set(["市辖区", "县", "省直辖县级行政区划", "自治区直辖县级行政区划"]);

const EXPECTED_PREFECTURES = 333;
const EXPECTED_COUNTIES = 2843;

/**
 * 数据源混入了统计局口径的开发区/园区（如「合肥高新技术产业开发区」「兰州新区」）
 * 和直筒子市下的街道/镇（东莞、中山、儋州、嘉峪关）。这些不是县级行政区，
 * 不生成地名页。新区里只有下列几个是正式市辖区名称，其余「新区」都是功能区。
 */
const COUNTY_LEVEL_SUFFIXES = [
  "自治县",
  "自治旗",
  "行政区",
  "林区",
  "特区",
  "区",
  "县",
  "市",
  "旗",
];
const PSEUDO_COUNTY_SUFFIXES = [
  "开发区",
  "管理区",
  "示范区",
  "园区",
  "工业区",
  "高新区",
  "经济区",
  "保税区",
  "旅游区",
  "度假区",
  "新区",
  "实验区",
  "试验区",
  "集聚区",
  "聚集区",
  "食品区",
  "风景名胜区",
  "合作区",
  "产业园",
  "物流园",
];
const REAL_XINQU_NAMES = new Set(["浦东新区", "滨海新区", "清新区", "沈北新区"]);

function isCountyLevelNode(raw) {
  const name = raw.name;
  if (!COUNTY_LEVEL_SUFFIXES.some((suffix) => name.endsWith(suffix))) return false;
  if (
    PSEUDO_COUNTY_SUFFIXES.some((suffix) => name.endsWith(suffix)) &&
    !REAL_XINQU_NAMES.has(name)
  ) {
    return false;
  }
  return true;
}

/** 抽查表：path -> H1 地名。脚本会逐条断言，发布前也可照这张表人工看页面。 */
const SPOT_CHECKS = [
  ["/qiming/sichuan/chengdu", "成都"],
  ["/qiming/sichuan/nanchong/nanbu", "南部"],
  ["/qiming/beijing/dongcheng", "东城区"],
  ["/qiming/hubei/xiantao", "仙桃"],
  ["/qiming/guangdong/dongguan", "东莞"],
  ["/qiming/xinjiang/shihezi", "石河子"],
  ["/qiming/chongqing/chengkou", "城口"],
  ["/qiming/hainan/wuzhishan", "五指山"],
  ["/qiming/jilin/jilinshi", "吉林市"],
  ["/qiming/hunan/changsha/changshaxian", "长沙县"],
  ["/qiming/qinghai/hainan", "海南州"],
  ["/qiming/qinghai/huangnan/henan", "河南县"],
  ["/qiming/guangdong/guangzhou/panyu", "番禺区"],
  ["/qiming/anhui/luan", "六安"],
  ["/qiming/chongqing", "重庆"],
  ["/qiming/xinjiang/kashi", "喀什"],
  ["/qiming/xinjiang/kashi/kashishi", "喀什市"],
  ["/qiming/xinjiang/yili/yiningshi", "伊宁市"],
  ["/qiming/xinjiang/yili/yiningxian", "伊宁县"],
  ["/qiming/guangxi/guilin/longsheng", "龙胜"],
  ["/qiming/yunnan/honghe/honghexian", "红河县"],
  ["/qiming/hubei/shennongjia", "神农架"],
  ["/qiming/guizhou/liupanshui/liuzhi", "六枝"],
  ["/qiming/shanghai/pudong", "浦东新区"],
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

/** 去掉声调并把 ü 转成 URL 可用的 ASCII；üe 按惯例写 ue，单独 ü 写 v。 */
function pinyinSlug(text) {
  const syllables = pinyin(text, { toneType: "none", type: "array" });
  const raw = syllables.join("");
  return raw
    .replace(/üe/g, "ue")
    .replace(/ü/g, "v")
    .replace(/[^a-z0-9]/g, "");
}

function overridePinyin(name, base) {
  return PINYIN_OVERRIDES[name] ?? PINYIN_OVERRIDES[base];
}

function slugOf(name, base) {
  return overridePinyin(name, base) ?? pinyinSlug(base);
}

function fullSlugOf(name) {
  return PINYIN_OVERRIDES[name] ?? pinyinSlug(name);
}

/** 省级短名：去省/市/自治区，自治区同时去民族名。 */
function provinceBase(name) {
  for (const suffix of [
    "维吾尔自治区",
    "壮族自治区",
    "回族自治区",
    "自治区",
    "特别行政区",
    "省",
    "市",
  ]) {
    if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
  }
  return name;
}

/** 剥掉自治州/自治县/自治旗前的民族名；保留至少 2 个字，避免「东乡」被剥空。 */
function stripEthnic(name) {
  let base = name;
  let changed = true;
  while (changed) {
    changed = false;
    for (const eth of ETHNIC_NAMES) {
      for (const suffix of [`${eth}族`, eth]) {
        if (!base.endsWith(suffix)) continue;
        const next = base.slice(0, -suffix.length);
        if (next.length < 2) continue;
        base = next;
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return base;
}

function prefectureBase(name) {
  for (const suffix of ["自治州", "地区", "盟", "市"]) {
    if (name.endsWith(suffix)) {
      const base = name.slice(0, -suffix.length);
      return suffix === "自治州" ? stripEthnic(base) : base;
    }
  }
  return name;
}

function isDistrictName(name) {
  return (
    name.endsWith("区") &&
    !name.endsWith("林区") &&
    !name.endsWith("特区") &&
    !name.endsWith("行政区")
  );
}

function districtBase(name) {
  if (name.endsWith("新区")) return name.slice(0, -2);
  return name.endsWith("区") ? name.slice(0, -1) : name;
}

function countyBase(name) {
  for (const suffix of ["自治县", "自治旗", "林区", "特区", "行政区", "县", "市", "旗"]) {
    if (name.endsWith(suffix)) {
      const base = name.slice(0, -suffix.length);
      return suffix === "自治县" || suffix === "自治旗" ? stripEthnic(base) : base;
    }
  }
  return name;
}

function stripTrailingGroupNodes(children, parentName) {
  const normal = [];
  const folded = [];
  for (const child of children ?? []) {
    if (GROUP_NODE_NAMES.has(child.name)) {
      // `县` 只重庆用；其余分组节点同理。把子节点直接挂到父级，避免出现第四层。
      assert(child.children?.length, `${parentName}/${child.name} 是分组节点但没有子节点`);
      folded.push(...child.children);
    } else {
      normal.push(child);
    }
  }
  return { normal, folded };
}

function makeProvince(raw) {
  const meta = PROVINCE_META[raw.name];
  assert(meta, `缺少省级元数据：${raw.name}`);
  const displayName = DISPLAY_NAME_OVERRIDES[raw.name] ?? provinceBase(raw.name);
  const slug = slugOf(displayName, displayName);
  const node = {
    adcode: raw.code,
    name: raw.name,
    displayName,
    slug,
    path: `/qiming/${slug}`,
    level: "province",
    group: 1,
    provinceName: raw.name,
    provinceDisplayName: displayName,
    provinceSlug: slug,
    provincePath: `/qiming/${slug}`,
    children: [],
  };
  return { node, meta };
}

function makePrefecture(raw, province, isCapital) {
  const base = prefectureBase(raw.name);
  const override = DISPLAY_NAME_OVERRIDES[raw.name];
  let displayName = override ?? base;
  let forceFullName = false;

  if (!override) {
    if (displayName.length < 2 || base === province.displayName) {
      displayName = raw.name;
      forceFullName = true;
    }
  }

  const slug = forceFullName ? fullSlugOf(raw.name) : slugOf(raw.name, base);
  return {
    adcode: raw.code,
    name: raw.name,
    displayName,
    slug,
    path: `${province.path}/${slug}`,
    level: "prefecture",
    group: isCapital ? 1 : 2,
    parentName: province.name,
    parentDisplayName: province.displayName,
    parentSlug: province.slug,
    parentPath: province.path,
    provinceName: province.name,
    provinceDisplayName: province.displayName,
    provinceSlug: province.slug,
    provincePath: province.path,
    ...(isCapital ? { isCapital: true } : {}),
  };
}

function makeCounty(raw, parent, province) {
  const district = isDistrictName(raw.name);
  const base = district ? districtBase(raw.name) : countyBase(raw.name);
  const override = DISPLAY_NAME_OVERRIDES[raw.name];
  let displayName = override ?? (district ? raw.name : base);
  let forceFullName = false;

  if (!override) {
    if (displayName.length < 2) {
      displayName = raw.name;
      forceFullName = true;
    } else if (!district && base === parent.displayName) {
      displayName = raw.name;
      forceFullName = true;
    } else if (!district && parent.level === "province" && base === province.displayName) {
      displayName = raw.name;
      forceFullName = true;
    }
  }

  const slug = forceFullName ? fullSlugOf(raw.name) : slugOf(raw.name, base);
  return {
    adcode: raw.code,
    name: raw.name,
    displayName,
    slug,
    path: `${parent.path}/${slug}`,
    level: "county",
    group:
      parent.level === "province"
        ? PROVINCE_META[province.name].isMunicipality
          ? 3
          : 4
        : parent.group === 1
          ? 3
          : 4,
    parentName: parent.name,
    parentDisplayName: parent.displayName,
    parentSlug: parent.slug,
    parentPath: parent.path,
    provinceName: province.name,
    provinceDisplayName: province.displayName,
    provinceSlug: province.slug,
    provincePath: province.path,
  };
}

/** 同级同名/同 slug 兜底：改用完整 name 和完整 name 拼音。 */
function dedupeSiblings(children) {
  const byDisplay = new Map();
  const bySlug = new Map();
  for (const child of children) {
    (
      byDisplay.get(child.displayName) ??
      byDisplay.set(child.displayName, []).get(child.displayName)
    ).push(child);
    (bySlug.get(child.slug) ?? bySlug.set(child.slug, []).get(child.slug)).push(child);
  }

  const forced = new Set();
  for (const list of byDisplay.values()) {
    if (list.length > 1) list.forEach((child) => forced.add(child));
  }
  for (const list of bySlug.values()) {
    if (list.length > 1) list.forEach((child) => forced.add(child));
  }

  for (const child of forced) {
    child.displayName = child.name;
    child.slug = fullSlugOf(child.name);
    child.path = `${child.parentPath}/${child.slug}`;
  }

  const seen = new Set();
  for (const child of children) {
    assert(!seen.has(child.slug), `同级 slug 冲突：${child.path}`);
    seen.add(child.slug);
  }
}

function buildProvince(raw) {
  const { node: province, meta } = makeProvince(raw);
  const { normal, folded } = stripTrailingGroupNodes(raw.children, raw.name);

  if (meta.isMunicipality) {
    // 直辖市没有地级层：市辖区/县 分组直接摊平成区县。
    const counties = [...normal, ...folded]
      .filter(isCountyLevelNode)
      .map((child) => makeCounty(child, province, province));
    counties.sort((a, b) => a.adcode.localeCompare(b.adcode));
    dedupeSiblings(counties);
    province.children = counties;
    return province;
  }

  const prefectures = normal.map((child) =>
    makePrefecture(child, province, child.name === meta.capital),
  );
  prefectures.sort((a, b) => a.adcode.localeCompare(b.adcode));

  for (const prefecture of prefectures) {
    const countyGroup = stripTrailingGroupNodes(
      raw.children.find((p) => p.name === prefecture.name)?.children,
      prefecture.name,
    );
    // 上面的 find 只用于拿原始 children；分组节点已在这一步折叠。
    const counties = [...countyGroup.normal, ...countyGroup.folded]
      .filter(isCountyLevelNode)
      .map((child) => makeCounty(child, prefecture, province));
    counties.sort((a, b) => a.adcode.localeCompare(b.adcode));
    dedupeSiblings(counties);
    if (counties.length) {
      prefecture.children = counties;
    } else {
      prefecture.noCountyLevel = true;
    }
  }

  dedupeSiblings(prefectures);
  // dedupe 可能改 prefecture 的 path，同步修正其下 county 的父级字段。
  for (const prefecture of prefectures) {
    for (const county of prefecture.children ?? []) {
      county.parentDisplayName = prefecture.displayName;
      county.parentSlug = prefecture.slug;
      county.parentPath = prefecture.path;
      county.path = `${prefecture.path}/${county.slug}`;
    }
  }

  const directCounties = folded
    .filter(isCountyLevelNode)
    .map((child) => makeCounty(child, province, province));
  directCounties.sort((a, b) => a.adcode.localeCompare(b.adcode));
  dedupeSiblings(directCounties);

  province.children = [...prefectures, ...directCounties].sort((a, b) =>
    a.adcode.localeCompare(b.adcode),
  );
  return province;
}

function flatten(node, out) {
  out.push({ loc: `${SITE_ORIGIN}${node.path}`, lastmod: LAST_MOD, group: node.group });
  for (const child of node.children ?? []) flatten(child, out);
}

function countNodes(provinces) {
  let prefectures = 0;
  let counties = 0;
  let group1 = 0;
  let group2 = 0;
  let group3 = 0;
  let group4 = 0;
  for (const province of provinces) {
    if (province.group === 1) group1 += 1;
    for (const child of province.children ?? []) {
      if (child.level === "prefecture") {
        prefectures += 1;
        if (child.group === 1) group1 += 1;
        else group2 += 1;
      } else {
        counties += 1;
        if (child.group === 3) group3 += 1;
        else group4 += 1;
      }
      for (const county of child.children ?? []) {
        counties += 1;
        if (county.group === 3) group3 += 1;
        else group4 += 1;
      }
    }
  }
  return { prefectures, counties, group1, group2, group3, group4 };
}

function assertTree(provinces) {
  assert(provinces.length === EXPECTED_PROVINCES.length, `省级数量 ${provinces.length}`);
  const names = new Set(provinces.map((p) => p.name));
  for (const expected of EXPECTED_PROVINCES) {
    assert(names.has(expected), `缺少省级节点：${expected}`);
  }

  const all = [];
  const paths = new Set();
  const walk = (node) => {
    if (node.level !== "province") {
      assert(
        node.parentName && node.parentDisplayName && node.parentSlug && node.parentPath,
        `${node.path} 缺少父级字段`,
      );
      assert(node.path === `${node.parentPath}/${node.slug}`, `${node.path} 与父级路径不一致`);
    }
    assert(node.displayName && node.displayName.length >= 2, `${node.path} displayName 为空`);
    assert(/^[a-z0-9-]+$/.test(node.slug), `${node.path} slug 非法：${node.slug}`);
    assert(node.group >= 1 && node.group <= 4, `${node.path} group 非法`);
    assert(node.level !== "county" || isCountyLevelNode(node), `${node.path} 疑似非县级节点`);
    assert(!GROUP_NODE_NAMES.has(node.name), `${node.path} 仍是分组节点`);
    assert(!paths.has(node.path), `重复 path：${node.path}`);
    paths.add(node.path);
    all.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  provinces.forEach(walk);

  const counts = countNodes(provinces);
  assert(counts.prefectures === EXPECTED_PREFECTURES, `地级数量 ${counts.prefectures}`);
  assert(counts.counties === EXPECTED_COUNTIES, `县级数量 ${counts.counties}`);
  assert(counts.group1 === 58, `group 1 数量 ${counts.group1}`);

  for (const [path, displayName] of SPOT_CHECKS) {
    const node = all.find((n) => n.path === path);
    assert(node, `抽查路径不存在：${path}`);
    assert(
      node.displayName === displayName,
      `${path} 显示名 ${node.displayName}，期望 ${displayName}`,
    );
  }

  return { all, counts };
}

function readme(counts) {
  return `# 地名数据

本目录由 \`scripts/build-places.mjs\` 生成，**不要手改**。页面只把地名用于 H1/title/URL 关键词，不生成本地概况。

## 数据源

- 仓库：modood/Administrative-divisions-of-China
- 文件：\`dist/pca-code.json\`
- commit：\`dc3a1d7acd85ca1b0979543e9259604142c52e8e\`（2023-09-13）
- SHA-256：\`${SOURCE_SHA256}\`
- 数据口径：2022-10-31（该 commit 的 README 标注；之后仓库的更新不涉及此数据文件）
- 许可：WTFPL（以数据源仓库为准）
- 生成日期：${LAST_MOD}

## 命令

\`\`\`bash
npm run gen:places
# 或指定本地缓存：
PCA_CODE_PATH=/path/to/pca-code.json npm run gen:places
\`\`\`

生成脚本会校验 SHA-256；换数据源版本时必须同时更新脚本里的 \`SOURCE_URL\` 和 \`SOURCE_SHA256\`。

## 规模

- 省级：31
- 地级：${counts.prefectures}
- 县级：${counts.counties}
- 合计地名页：${31 + counts.prefectures + counts.counties}（不含 \`/qiming\` 总入口）

硬闸门分组：

| group | 内容 | 数量 |
|---|---|---|
| 1 | 31 省级 + 27 省会 | ${counts.group1} |
| 2 | 其余地级 | ${counts.group2} |
| 3 | 直辖市/省会下辖区县 | ${counts.group3} |
| 4 | 其余县级 | ${counts.group4} |

## 归一化规则

- 折叠 \`市辖区\`、\`县\`、\`省直辖县级行政区划\`、\`自治区直辖县级行政区划\` 分组，子节点直接挂到省/市。
- 只保留县级行政区（区/县/县级市/旗/林区/特区）；丢弃数据源里的开发区、园区、管理区、示范区等统计口径节点，以及直筒子市下的街道/镇/乡。
- 省级去 \`省/市/自治区\` 与民族名；地级去 \`市/自治州/地区/盟\` 与民族名；直辖市不设重复的市级层。
- 市辖区保留「区」；县/县级市/旗/林区/特区/行政区去后缀。
- 与父级同名（长沙县/大理市）、短名不足 2 字（单县/东区）、同级同名（伊宁市/伊宁县）时改用完整名称和完整名称拼音。
- 跨省/跨级同名：\`海南藏族自治州\`→\`海南州\`，\`河南蒙古族自治县\`→\`河南县\`。
- 多音字特例在 \`scripts/place-overrides.mjs\`；生成脚本同时写 \`scripts/.cache/pinyin-audit.txt\`（全部 path + displayName + 拼音），发布前抽查。

## 抽查记录

| path | H1 地名 |
|---|---|
${SPOT_CHECKS.map(([path, name]) => `| \`${path}\` | ${name} |`).join("\n")}

## 已知边界

- 数据截止 2022-10-31，2023 年之后的撤县设市/设区不会出现在这里；更新需重跑生成脚本。
- 不含港澳台。
- 东莞/中山/儋州/嘉峪关等不设县级节点的地级市只生成地级页，不生成县级页。
- 东莞市、中山市等无县级节点的市在数据里标 \`noCountyLevel: true\`，页面不使用该字段。
`;
}

async function main() {
  const localPath = process.env.PCA_CODE_PATH;
  const buffer = localPath
    ? await readFile(localPath)
    : Buffer.from(await (await fetch(SOURCE_URL)).arrayBuffer());

  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== SOURCE_SHA256 && process.env.PCA_CODE_SKIP_SHA !== "1") {
    fail(
      `数据 SHA-256 不匹配：${sha}\n期望 ${SOURCE_SHA256}\n如确认要换数据，更新脚本常量后重跑。`,
    );
  }

  const raw = JSON.parse(buffer.toString("utf8"));
  assert(Array.isArray(raw), "数据根节点不是数组");

  const provinces = raw.map(buildProvince);
  const { all, counts } = assertTree(provinces);
  assert(all.length === 31 + counts.prefectures + counts.counties, "节点总数不一致");

  await mkdir(PROVINCE_DIR, { recursive: true });
  await mkdir(dirname(AUDIT_PATH), { recursive: true });

  const summaries = provinces.map(({ adcode, name, displayName, slug, path }) => ({
    adcode,
    name,
    displayName,
    slug,
    path,
  }));
  await writeFile(join(OUT_DIR, "provinces.json"), `${JSON.stringify(summaries, null, 2)}\n`);

  for (const province of provinces) {
    await writeFile(join(PROVINCE_DIR, `${province.slug}.json`), `${JSON.stringify(province)}\n`);
  }

  const sitemap = [];
  provinces.forEach((province) => flatten(province, sitemap));
  await writeFile(join(OUT_DIR, "sitemap.json"), `${JSON.stringify(sitemap)}\n`);

  const audit = all
    .map((node) => `${node.path}\t${node.displayName}\t${node.name}\t${node.slug}`)
    .join("\n");
  await writeFile(AUDIT_PATH, `${audit}\n`);

  await writeFile(join(OUT_DIR, "README.md"), readme(counts));

  console.log(`省级 ${provinces.length}，地级 ${counts.prefectures}，县级 ${counts.counties}`);
  console.log(
    `group 1/2/3/4 = ${counts.group1}/${counts.group2}/${counts.group3}/${counts.group4}，sitemap ${sitemap.length} 条`,
  );
  console.log(`拼音审计：${relative(ROOT, AUDIT_PATH)}`);
  console.log("抽查：");
  for (const [path, displayName] of SPOT_CHECKS) {
    console.log(`  ${path} -> ${displayName}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
