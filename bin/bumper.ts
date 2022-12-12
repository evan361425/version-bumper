#!/usr/bin/env node

/**
 * @author 呂學洲 <evan.lu@104.com.tw>
 */

import api from '../lib/api.js';
import { readFile } from '../lib/helper.js';

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
    return JSON.parse(readFile('package.json')).version;
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

  const command =
    process.argv.includes('-h') || process.argv.includes('--help')
      ? 'help'
      : process.argv[2]?.startsWith('--')
      ? 'version'
      : process.argv[2];
  switch (command) {
    case 'version':
    case undefined:
      await api.bumpVersion();
      break;
    case 'init':
      await api.init();
      break;
    case 'help':
      api.help();
      break;
    default:
      console.log(`unknown command: ${command}`);
  }
})().catch(onFatalError);
