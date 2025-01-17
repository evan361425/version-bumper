import { Config } from '../config.js';
import { BumperError } from '../errors.js';

export default async function (cfg: Config) {
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
