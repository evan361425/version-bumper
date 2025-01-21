import { loadConfigFromArgs, loadConfigFromFile } from '../../lib/config-loader.js';
import { Config } from '../../lib/config.js';
import { BumperError } from '../../lib/errors.js';

export async function bumperCommand(args: string[]): Promise<void> {
  const cfg = new Config(loadConfigFromFile(args), loadConfigFromArgs(args));
  cfg.init(args);

  if (cfg.process.checkTag) {
    if (!(await cfg.git.hasTag(cfg.version))) {
      throw new BumperError(`Tag ${cfg.version} not found`);
    }
  }

  await cfg.diff.prepareContent(cfg.tag);
  await cfg.changelog.section.formatContent(cfg.changelogTemplate);

  if (cfg.changelog.enable) {
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
}
