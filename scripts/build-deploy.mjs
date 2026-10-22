#!/usr/bin/env node
/**
 * 生产构建（build + 保留上一版 assets）。
 *
 * vite build 会清空 .output：部署后，客户端/微信 WebView 里缓存的旧 HTML 引用的旧哈希
 * 资源随即 404（GEO 面板「静态资源 404」的来源）。构建前把上一版 assets 暂存到
 * .assets-carryover，构建后把新构建中缺失的旧哈希文件合并回来——旧页面在缓存期内仍能
 * 正常加载，下一版再被自然淘汰（carryover 只保留一版，不会无限膨胀）。
 *
 * 注意：Nitro 在构建时为 public/ 下的每个文件生成静态清单（type/etag/size/path），
 * 只认清单里的路径。因此构建后再往 .output/public/assets 补拷文件是无效的（照样 404），
 * 上一版资源必须在构建前投放进 Vite 的 publicDir，由构建写进清单；构建完成后清理掉
 * 这些投放文件，避免污染工作区。
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assetsDir = join(root, ".output", "public", "assets");
const carryDir = join(root, ".assets-carryover");
const publicAssetsDir = join(root, "public", "assets");

const listFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true }).filter((p) => statSync(join(dir, p)).isFile())
    : [];

// 1) 暂存上一版 assets（只保留一版：更早的 carryover 直接丢弃）
rmSync(carryDir, { recursive: true, force: true });
let stashed = false;
if (existsSync(assetsDir)) {
  try {
    renameSync(assetsDir, carryDir);
  } catch {
    cpSync(assetsDir, carryDir, { recursive: true });
    rmSync(assetsDir, { recursive: true, force: true });
  }
  stashed = true;
}
console.log(
  stashed
    ? `[carryover] 已暂存上一版 assets（${listFiles(carryDir).length} 个文件）`
    : "[carryover] 无上一版 assets（首次构建或已清理）",
);

// 2) 上一版资源投放进 Vite publicDir（构建期写进 Nitro 静态清单）
const seeded = [];
if (stashed) {
  for (const rel of listFiles(carryDir)) {
    const target = join(publicAssetsDir, rel);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(carryDir, rel), target);
    seeded.push(rel);
  }
  console.log(`[carryover] 构建前投放 ${seeded.length} 个上一版资源（进入 Nitro 静态清单）`);
}

// 只清理自己投放的文件与因此变空的目录
const pruneEmptyDirs = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) pruneEmptyDirs(p);
  }
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
};
const cleanupSeeded = () => {
  for (const rel of seeded) rmSync(join(publicAssetsDir, rel), { force: true });
  pruneEmptyDirs(publicAssetsDir);
};

// 3) 构建
const build = spawnSync("npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
cleanupSeeded();
if ((build.status ?? 1) !== 0) {
  // 构建失败：暂存的 assets 放回去，不破坏现有 .output
  if (stashed) {
    mkdirSync(dirname(assetsDir), { recursive: true });
    cpSync(carryDir, assetsDir, { recursive: true, force: true });
  }
  process.exit(build.status ?? 1);
}

// 4) 兜底：构建仍未产出的旧文件补拷（例如 publicDir 被 Vite 跳过的文件类型）
let restored = 0;
for (const rel of listFiles(carryDir)) {
  const target = join(assetsDir, rel);
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(carryDir, rel), target);
    restored++;
  }
}
console.log(
  `[carryover] 合并上一版遗留资源 ${restored} 个，当前 assets 共 ${listFiles(assetsDir).length} 个`,
);
