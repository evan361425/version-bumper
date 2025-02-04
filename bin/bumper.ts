#!/usr/bin/env node

/**
 * @author 呂學洲 <evan.lu@104.com.tw>
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bumperCommand } from './api/bumper.js';
import { helpCommand } from './api/help.js';
import { versionCommand } from './api/version.js';

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
    return JSON.parse(readFileSync(getPackageJsonFile()).toString('utf-8')).version;
  } catch (error) {
    return "can't find package.json";
  }
}

function getPackageJsonFile() {
  const paths = ['..', '..', 'package.json'];
  if (import.meta.url.endsWith('.js')) paths.unshift('..');
  const file = path.join(import.meta.url, ...paths);
  const schemaIndex = file.indexOf(':');
  if (schemaIndex === -1) return file;

  return file.substring(schemaIndex + 1);
}

function onFatalError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'BumperError') {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
  }

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
  const showVersion = args.includes('--version') || args.includes('-V');

  if (showVersion) {
    console.log(`bumper ${getVersion()}`);
    return;
  }

  const firstArg = args[0] ?? '';
  if (needHelp || firstArg === 'help') {
    helpCommand(firstArg);
    return;
  }

  if (firstArg === 'version') {
    console.log('searching for latest version...');
    console.log(`Current version: ${getVersion()}`);
    console.log(`Latest version: ${await versionCommand()}`);
    console.log('Update command: npm update -g @evan361425/version-bumper');
    return;
  }

  await bumperCommand(args);
})().catch(onFatalError);
