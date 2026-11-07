#!/usr/bin/env node
/**
 * SEO 长尾词采集：百度下拉词（sugrec JSON 接口）按种子词展开两层，去重后输出。
 *
 * 用法：
 *   node scripts/harvest-keywords.mjs                          # 全部默认种子
 *   node scripts/harvest-keywords.mjs --seeds 成都,王姓        # 指定种子
 *   node scripts/harvest-keywords.mjs --matrix surname-place   # 标注矩阵归属
 *   node scripts/harvest-keywords.mjs --import                 # 采集后直接导入后台词库
 *   node scripts/harvest-keywords.mjs --out /tmp/words.json    # 输出文件（默认 stdout 摘要 + json 文件）
 *
 * 环境变量：
 *   SEO_ADMIN_BASE（默认 https://server.oracle.duimai.net）+ SEO_ADMIN_TOKEN（管理员 JWT，
 *   登录后台后从 localStorage 取 token）——仅 --import 需要。
 *
 * 运营流程：每周跑一次 → 导出 JSON/CSV → 在后台 /seo-keywords 标记 PLANNED/REJECTED
 * 并归入矩阵 → PLANNED 的词进入对应矩阵的下一批或文章选题。
 */
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
function argOf(flag, fallback = null) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const hasFlag = (flag) => args.includes(flag);

/** 默认种子：按矩阵维度分组（城市/姓氏/生肖/典籍/五行），覆盖现有页面的主词。 */
const DEFAULT_SEEDS = {
  place: ["小孩取名", "宝宝取名", "成都", "杭州", "武汉"],
  surname: ["王姓", "李姓", "张姓", "陈姓"],
  "surname-place": ["成都王姓", "杭州李姓", "武汉张姓"],
  classic: ["诗经取名", "楚辞取名", "唐诗取名", "论语取名"],
  wuxing: ["五行属水的字", "五行属木的字", "五行缺水取名"],
  "zodiac-gender": ["属马男孩取名", "属龙女孩取名"],
};

/** 百度下拉词：sugrec 是浏览器搜索框同款 JSON 接口，稳定且无需登录。 */
async function suggest(word, signal) {
  const url = `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    signal,
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", accept: "application/json" },
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body.g ?? []).map((g) => g.q).filter(Boolean);
}

async function expandSeeds(seeds, matrixHint) {
  const rows = [];
  const seen = new Set();
  for (const seed of seeds) {
    process.stdout.write(`  ${seed} ... `);
    let level1 = [];
    try {
      level1 = await suggest(seed, AbortSignal.timeout(8000));
    } catch {
      level1 = [];
    }
    const level2Lists = await Promise.allSettled(
      level1.slice(0, 8).map((w) => suggest(w, AbortSignal.timeout(8000))),
    );
    const words = [seed, ...level1, ...level2Lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []))];
    let fresh = 0;
    for (const word of words) {
      const key = word.trim();
      if (!key || key.length > 60 || seen.has(key)) continue;
      seen.add(key);
      rows.push({ keyword: key, sourceSeed: seed, matrixHint: matrixHint || null, status: "PENDING" });
      fresh++;
    }
    process.stdout.write(`${fresh} new\n`);
  }
  return rows;
}

async function importToBackend(rows) {
  const base = process.env.SEO_ADMIN_BASE || "https://server.oracle.duimai.net";
  const token = process.env.SEO_ADMIN_TOKEN;
  if (!token) {
    console.error("--import 需要 SEO_ADMIN_TOKEN（管理员 JWT，登录后台后从 localStorage 取）");
    process.exit(1);
  }
  // 按种子分批，保留 sourceSeed 维度
  const bySeed = new Map();
  for (const row of rows) {
    const seed = row.sourceSeed || "";
    if (!bySeed.has(seed)) bySeed.set(seed, []);
    bySeed.get(seed).push(row.keyword);
  }
  let imported = 0;
  let duplicated = 0;
  for (const [seed, keywords] of bySeed) {
    const res = await fetch(`${base}/api/v1/admin/seo-keywords/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keywords, sourceSeed: seed || null, matrixHint: rows.find((r) => r.sourceSeed === seed)?.matrixHint ?? null }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res || !res.ok) {
      console.error(`  导入失败（seed=${seed}）：${res ? res.status : "network"}`);
      continue;
    }
    const body = await res.json().catch(() => ({}));
    imported += body.imported || 0;
    duplicated += body.duplicated || 0;
  }
  console.log(`导入完成：新增 ${imported}，重复 ${duplicated}`);
}

async function main() {
  const seedsArg = argOf("--seeds");
  const matrixHint = argOf("--matrix");
  const outFile = argOf("--out", "harvested-keywords.json");

  const groups = seedsArg
    ? { custom: seedsArg.split(",").map((s) => s.trim()).filter(Boolean) }
    : DEFAULT_SEEDS;

  const all = [];
  for (const [group, seeds] of Object.entries(groups)) {
    console.log(`[${group}] ${seeds.length} seeds`);
    const rows = await expandSeeds(seeds, matrixHint || (group === "custom" ? null : group));
    all.push(...rows);
  }

  writeFileSync(outFile, JSON.stringify(all, null, 2) + "\n");
  console.log(`共 ${all.length} 条 → ${outFile}`);

  // 顺手产出 CSV（Excel 可直接筛）
  const csv = ["keyword,source_seed,matrix_hint,status"]
    .concat(all.map((r) => `${r.keyword},${r.sourceSeed ?? ""},${r.matrixHint ?? ""},${r.status}`))
    .join("\n");
  writeFileSync(outFile.replace(/\.json$/, ".csv"), csv + "\n");

  if (hasFlag("--import")) await importToBackend(all);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
