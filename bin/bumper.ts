#!/usr/bin/env node

/**
 * @author 呂學洲 <evan.lu@104.com.tw>
 */

import api from '../lib/api.js';
import { Config } from '../lib/config.js';
import { BumperError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { getPackageJsonFile, npm, readFile } from '../lib/util.js';

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

function getErrorMessage(error: unknown) {
  // Foolproof -- third-party module might throw non-object.
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  // Use the stacktrace if it's an error object.
  // @ts-expect-error Property 'stack' does not exist on type 'object'
  if (typeof error.stack === 'string') {
    // @ts-expect-error Property 'stack' does not exist on type 'object'
    return error.stack;
  }

  // Otherwise, dump the object.
  return error;
}

function getVersion(): string {
  try {
    return JSON.parse(readFile(getPackageJsonFile())).version;
  } catch (error) {
    return "can't find package.json";
  }
}

function onFatalError(error: unknown) {
  process.exitCode = 2;

  const message = getErrorMessage(error);

  console.error(`
Oops! Something went wrong! :(

Bumper: ${getVersion()}

${message}`);
}

//------------------------------------------------------------------------------
// Execution
//------------------------------------------------------------------------------

(async function main() {
  process.on('uncaughtException', onFatalError);
  process.on('unhandledRejection', onFatalError);

  const args = process.argv.slice(2);

  const needHelp = args.includes('-h') || args.includes('--help') || args.includes('--h');
  const needVersion = args.includes('--version');

  if (needVersion) {
    console.log(`bumper ${getVersion()}
Update command: npm i -g @evan361425/version-bumper`);
    const info = await npm('search', '@evan361425/version-bumper', '--parseable', '--prefer-online');
    const result = info
      .split('\t')
      .map((e) => e.trim())
      .filter((e) => Boolean(e));
    const latestVer = result[result.length - 1]?.trim();
    console.log(`Latest version: ${latestVer}`);
    return;
  }

  if (needHelp) {
    return api.help(command);
  } else if (command === '') {
    await api.bumper();
  } else if (command === 'deps') {
    await api.deps();
  } else if (command === 'init') {
    await api.init();
  } else {
    return api.help(command);
  }

  log(`${command} done`);
})().catch(onFatalError);

async function bump(cfg: Config): Promise<void> {
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
