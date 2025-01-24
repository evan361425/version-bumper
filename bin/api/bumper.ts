import { loadConfigFromArgs, loadConfigFromFile } from '../../lib/config-loader.js';
import { Config } from '../../lib/config.js';
import { isDebug, startDebug, stopDebug } from '../../lib/io.js';
import { log, verbose } from '../../lib/logger.js';
import { bump, checkTag, createPR, createRelease, prepare } from '../../lib/processes.js';

export async function bumperCommand(args: string[]): Promise<void> {
  const cfg = new Config(loadConfigFromFile(args), loadConfigFromArgs(args));
  // Stop debugging for getting basic information
  const debug = isDebug();

  debug && stopDebug();
  await cfg.init(args);
  if (debug) {
    console.log('===== start debug mode =====');

    const { tag, ...config } = cfg;
    verbose(JSON.stringify(config, undefined, 2));
  }

  await checkTag(cfg); // 1. 檢查要求的版本是否已經存在
  await prepare(cfg); // 2. 準備好待會要用的各種東西

  await cfg.hook.runAfterVerified(cfg.versionTemplate); // hook
  debug && startDebug();

  await bump(cfg); // 3. 開始進行版本的 bump
  await createPR(cfg); // 4. 創建 PR
  await createRelease(cfg); // 5. 創建 Release

  debug && stopDebug();
  await cfg.hook.runAfterAll(cfg.versionTemplate); // hook
  log(`[bump] finished bumping version ${cfg.version}`);
}
