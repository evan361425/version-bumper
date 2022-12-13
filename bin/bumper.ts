#!/usr/bin/env node

/**
 * @author 呂學洲 <evan.lu@104.com.tw>
 */

import api from '../lib/api.js';
import { getPackageJsonFile, readFile } from '../lib/helper.js';

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

  const command = process.argv[2];
  const needHelp =
    process.argv.includes('-h') ||
    process.argv.includes('--help') ||
    command?.startsWith('-');
  const needVersion =
    process.argv.includes('-v') || process.argv.includes('--version');

  if (needVersion) {
    return console.log(`version-bumper: ${getVersion()}`);
  }

  if (needHelp) {
    api.help(command);
  } else if (command === 'version') {
    await api.bumpVersion();
  } else if (command === 'deps') {
    await api.bumpDeps();
  } else if (command === 'init') {
    await api.init();
  } else {
    api.help(command);
  }
})().catch(onFatalError);
