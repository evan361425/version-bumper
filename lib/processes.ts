import { ChangelogIO } from './changelog.js';
import { Config } from './config.js';
import { BumperError } from './errors.js';
import { askQuestion } from './io.js';
import { log } from './logger.js';

export async function checkTag(cfg: Config): Promise<void> {
  if (cfg.process.checkTag) {
    if (await cfg.git.hasTag(cfg.version, cfg.process.checkRemoteTag)) {
      throw new BumperError(`Tag ${cfg.version} already exists, please consider using a different version.`);
    }
  }
  log(`[bump] version validation passed: ${cfg.version}`);
}

export async function prepare(cfg: Config): Promise<void> {
  if (cfg.process.diffFromChangelog) {
    const clog = new ChangelogIO(cfg.changelog.destination, cfg.changelog.destination);
    const section = clog.content.sections.find((s) => s.header.includes(cfg.version));
    if (!section) {
      throw new BumperError(`Changelog section not found in version: ${cfg.version}`);
    }

    cfg.diff.content = section.body;
  } else {
    await cfg.diff.prepareContent(cfg.tag, cfg.repo, cfg.autoLinks);
    await cfg.changelog.section.formatContent(cfg.changelogTemplate);
    cfg.changelog.section.formatted = cfg.injectAutoLinks(cfg.changelog.section.formatted);
  }

  if (cfg.process.askToVerifyContent) {
    log('====== Content is in below:');
    console.log(cfg.changelog.section.formatted);
    const answer = (await askQuestion('====== Is this OK? [Y/n]')).trim();
    if (answer.toLowerCase() !== 'y' && answer !== '') {
      throw new BumperError('OK, then.');
    }
  }
}

export async function bump(cfg: Config): Promise<void> {
  const hasClog = cfg.changelog.enable && cfg.tag.withChangelog;
  if (cfg.process.bump) {
    if (hasClog) {
      await cfg.bumpChangelog();
    }

    await cfg.git.tag(cfg.version, cfg.changelog.section.formatted);
  }

  if (cfg.process.push) {
    await cfg.git.push(hasClog);
  }
}

export async function createPR(cfg: Config): Promise<void> {
  if (cfg.process.pr) {
    await cfg.tag.createPR(cfg.pr, cfg.contentTemplate, cfg.autoLinks);
  }
}

export async function createRelease(cfg: Config): Promise<void> {
  if (cfg.process.release) {
    await cfg.tag.createRelease(cfg.contentTemplate, cfg.autoLinks);
  }
}
