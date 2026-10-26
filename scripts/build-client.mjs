/**
 * 构建可运行产物：把 content.js / pet-core.js 内联进两个宿主壳。
 *
 * 产物（都提交进仓库，测试会校验它们与源码一致，防止手改产物造成漂移）：
 *   naiwa-pet/client.js           DSH 浏览器半侧（window.__ModuleLoader__ 入口）
 *   naiwa-pet/desktop/pet-app.js  桌面 Electron 渲染页脚本（classic script）
 *
 * 源码：
 *   naiwa-pet/content.js          ESM，数据
 *   naiwa-pet/pet-core.js         ESM，状态机 + 物理 + 表现描述
 *   naiwa-pet/src/client-shell.js DSH 壳模板（含 @embed 占位注释）
 *   naiwa-pet/src/desktop-renderer.js 桌面渲染壳（classic script body）
 *
 * 用法：node scripts/build-client.mjs [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(repoRoot, 'naiwa-pet');
const checkOnly = process.argv.includes('--check');

/** 去掉 ESM 语法：这些文件只被内联，产物必须是 classic script。 */
function stripEsm(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\s/.test(line))
    .map((line) => line.replace(/^export\s+/, ''))
    .join('\n');
}

function readSource(relative) {
  const path = join(pluginDir, relative);
  if (!existsSync(path)) {
    console.error('[build-client] missing source: ' + relative);
    process.exit(1);
  }
  return readFileSync(path, 'utf8');
}

const content = stripEsm(readSource('content.js'));
const core = stripEsm(readSource('pet-core.js'));
const shell = readSource('src/client-shell.js');
const renderer = readSource('src/desktop-renderer.js');

for (const [name, source] of [
  ['content.js', content],
  ['pet-core.js', core],
  ['src/desktop-renderer.js', renderer],
]) {
  if (/^\s*(import|export)\s/m.test(source)) {
    console.error('[build-client] ' + name + ' still contains ESM syntax after stripping');
    process.exit(1);
  }
}

const marker = (name) => '/* @embed:' + name + ' */';
if (!shell.includes(marker('content')) || !shell.includes(marker('core'))) {
  console.error('[build-client] src/client-shell.js is missing @embed markers');
  process.exit(1);
}

const clientBundle =
  shell.replace(marker('content'), content.trimEnd()).replace(marker('core'), core.trimEnd()).trimEnd() + '\n';

const desktopBundle =
  '/** 生成产物：不要手改。源码见 naiwa-pet/src/desktop-renderer.js + content.js + pet-core.js。 */\n' +
  '(function () {\n' +
  "'use strict';\n" +
  content.trimEnd() +
  '\n' +
  core.trimEnd() +
  '\n' +
  renderer.trimEnd() +
  '\n' +
  '})();\n';

for (const [name, bundle] of [
  ['client.js', clientBundle],
  ['desktop/pet-app.js', desktopBundle],
]) {
  if (/^\s*(import|export)\s/m.test(bundle)) {
    console.error('[build-client] generated ' + name + ' still contains ESM syntax');
    process.exit(1);
  }
}

const outputs = [
  { relative: 'client.js', bundle: clientBundle },
  { relative: 'desktop/pet-app.js', bundle: desktopBundle },
];

if (checkOnly) {
  let stale = 0;
  for (const output of outputs) {
    const path = join(pluginDir, output.relative);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current !== output.bundle) {
      console.error('[build-client] stale generated file: naiwa-pet/' + output.relative);
      stale += 1;
    }
  }
  if (stale > 0) {
    console.error('[build-client] run `npm run build` to regenerate');
    process.exit(1);
  }
  console.log('[build-client] PASS (generated files are up to date)');
} else {
  for (const output of outputs) {
    writeFileSync(join(pluginDir, output.relative), output.bundle, 'utf8');
  }
  console.log('[build-client] wrote naiwa-pet/client.js and naiwa-pet/desktop/pet-app.js');
}
