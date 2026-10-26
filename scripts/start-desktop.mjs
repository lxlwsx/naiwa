/**
 * 手动启动桌面形态：解析 Electron 与配置路径后以固定 argv 拉起 desktop/main.cjs。
 *
 *   node scripts/start-desktop.mjs
 *   DSH_NAIWA_ELECTRON_PATH=/path/to/electron node scripts/start-desktop.mjs
 *
 * 手动启动会把 displayMode 写成 desktop（否则下一次配置热更新会把窗口收回去），
 * 之后可以在右键菜单里切回“仅应用内 / 两者都显示”。
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigStore, dshHomeDir, resolveConfigPath, resolveElectronPath } from '../naiwa-pet/index.js';

if (process.env.ELECTRON_RUN_AS_NODE) {
  console.error('[desktop] ELECTRON_RUN_AS_NODE is set in this shell; unset it before starting the desktop form.');
  process.exit(1);
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electron = resolveElectronPath();
if (!electron) {
  console.error(
    '[desktop] Electron not found. Set DSH_NAIWA_ELECTRON_PATH or install Electron into $DSH_HOME/electron.',
  );
  process.exit(1);
}
const configPath = resolveConfigPath();
const store = new ConfigStore({ path: configPath });
store.write({ displayMode: 'desktop' });
const main = join(repoRoot, 'naiwa-pet', 'desktop', 'main.cjs');

const env = { ...process.env, DSH_HOME: dshHomeDir() };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [main, '--config', configPath], {
  shell: false,
  stdio: 'inherit',
  env,
  cwd: join(repoRoot, 'naiwa-pet'),
});
child.on('exit', (code) => process.exit(code ?? 0));
