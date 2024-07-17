#!/usr/bin/env node

/**
 * @author 呂學洲 <evan.lu@104.com.tw>
 */

import api from '../lib/api.js';
import { getPackageJsonFile, npm, readFile } from '../lib/helper.js';
import { notice } from '../lib/logger.js';

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

  const command = !process.argv[2] || process.argv[2].startsWith('-') ? '' : process.argv[2];

  const needHelp = process.argv.includes('-h') || process.argv.includes('--help') || process.argv.includes('--h');
  const needVersion = command === 'version' || command === 'v' || process.argv.includes('--version');

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

  notice(`${command} done`);
})().catch(onFatalError);
