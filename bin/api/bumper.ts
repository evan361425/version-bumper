import { loadConfigFromArgs, loadConfigFromFile } from '../../lib/config-loader.js';
import { Config } from '../../lib/config.js';
import { BumperError } from '../../lib/errors.js';
import { log, verbose } from '../../lib/logger.js';

export async function bumperCommand(args: string[]): Promise<void> {
  const cfg = new Config(loadConfigFromFile(args), loadConfigFromArgs(args));
  await cfg.init(args);
  verbose('[bump] finish parsing config');

  if (cfg.process.checkTag) {
    if (await cfg.git.hasTag(cfg.version)) {
      throw new BumperError(`Tag ${cfg.version} already exists, please consider using a different version.`);
    }
  }
  log(`[bump] version validation passed: ${cfg.version}`);

  await cfg.diff.prepareContent(cfg.tag);
  await cfg.changelog.section.formatContent(cfg.changelogTemplate);

  if (cfg.changelog.enable && cfg.tag.withChangelog) {
    await cfg.bumpChangelog();
  }

  if (cfg.process.bump) {
    await cfg.git.tag(cfg.version, cfg.changelog.section.formatted);
  }

  if (cfg.process.push) {
    await cfg.git.push();
  }

  if (cfg.process.pr) {
    await cfg.tag.createPR(cfg.pr, cfg.contentTemplate);
  }

  if (cfg.process.release) {
    await cfg.tag.createRelease(cfg.contentTemplate);
  }

  log(`[bump] finished bumping version ${cfg.version}`);
}
