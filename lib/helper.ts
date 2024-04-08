import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { info } from './logger.js';

let mode: 'debug' | 'normal' | 'verbose' = 'normal';
let mockedCommands: undefined | Promise<string>[];
let mockedFiles: undefined | string[];

export function startDebug(): void {
  mode = 'debug';
}

export function startVerbose(): void {
  mode = 'verbose';
}

export function stopDebug(): void {
  mode = 'normal';
}

export function isDebug(): boolean {
  return mode === 'debug';
}

export function isVerbose(): boolean {
  return mode === 'verbose' || mode === 'debug';
}

export function createCommand(name: string, args: string[]): Promise<string> {
  const force = typeof args[0] === 'boolean' ? args.shift() : false;
  info(`[cmd]: ${name} '${args.join("' '")}'`);

  const prepared = !force && isDebug() ? Promise.resolve('') : mockedCommands ? mockedCommands.shift() : undefined;

  return (
    prepared ??
    new Promise((res, rej) => {
      const command = spawn(name, args);
      let response = '';
      let error = '';

      command.stdout.on('data', (data) => (response += data.toString()));
      command.stderr.on('data', (data) => (error += data.toString()));
      command.on('error', (err) => {
        rej(err);
      });
      command.on('close', () => {
        error !== '' ? rej(new Error(`Command: ${name} ${args.join(' ')} \n${error}`)) : res(response);
      });
      command.on('exit', (code, signal) => {
        if (code !== 0) {
          rej(
            new Error(
              `Command: ${name} ${args.join(' ')} \n` +
                `return non-zero code: ${code}\n` +
                `with signal: ${signal}\n` +
                `and response:\n${response}\nerror:\n${error}`,
            ),
          );
        }
      });
    })
  );
}

export async function git(...args: string[]): Promise<string> {
  try {
    return await createCommand('git', args);
  } catch (err) {
    isVerbose() && console.log(err);
    return '';
  }
}

export function gh(...args: string[]): Promise<string> {
  return createCommand('gh', args);
}

export function npm(...args: string[]): Promise<string> {
  return createCommand('npm', args);
}

export function breaker(value: string, length = 1, separator = '\n'): string[] {
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    const index = value.indexOf(separator);
    result.push(value.substring(0, index));
    value = value.substring(index + separator.length);
  }
  result.push(value);

  return result;
}

export function readFile(fileName: string): string {
  if (mockedFiles && mockedFiles.length) {
    return mockedFiles.shift() ?? '';
  }
  return existsSync(fileName) ? readFileSync(fileName).toString() : '';
}

export function writeFile(fileName: string | undefined, data: string) {
  if (fileName) {
    if (isDebug()) {
      console.log(data);
    } else {
      writeFileSync(fileName, data);
    }
  }
}

export function appendFile(fileName: string | undefined, data: string) {
  if (isDebug()) {
    console.log(data);
    return;
  }

  if (fileName) {
    appendFileSync(fileName, data);
  }
}

type MarkdownMeta = Partial<{
  version: string;
  ticket: string;
}>;

export function parseMarkdown(fileName: string): [MarkdownMeta, string] {
  const content = readFile(fileName);
  if (!content) return [{}, ''];

  const [, rawMeta, body] = breaker(content, 2, '---');
  const meta: MarkdownMeta = {};

  rawMeta
    ?.split('\n')
    .filter((e: string) => e.includes(':'))
    .map((e: string) => breaker(e, 1, ':').map((v) => v.trim()))
    .forEach((e: string[]) => {
      if (e[0]) meta[e[0].toLowerCase() as keyof MarkdownMeta] = e[1] as string;
    });

  return [meta, body?.trim() ?? ''];
}

export function getSchemaFile() {
  const paths = ['..', '..', 'schema.json'];
  if (import.meta.url.endsWith('.js')) paths.unshift('..');
  const file = path.join(import.meta.url, ...paths);
  const schemaIndex = file.indexOf(':');
  if (schemaIndex === -1) return file;

  return file.substring(schemaIndex + 1);
}

export function getPackageJsonFile() {
  const paths = ['..', '..', 'package.json'];
  if (import.meta.url.endsWith('.js')) paths.unshift('..');
  const file = path.join(import.meta.url, ...paths);
  const schemaIndex = file.indexOf(':');
  if (schemaIndex === -1) return file;

  return file.substring(schemaIndex + 1);
}

export function mockCommand(target: Promise<string>) {
  if (mockedCommands) {
    mockedCommands.push(target);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    mockedCommands = [target];
  }
}

export function mockFile(target: string) {
  if (mockedFiles) mockedFiles.push(target);
  else mockedFiles = [target];
}

export function extractLinks(body: string): string {
  const linker = new RegExp(`\\[([^\\]]+)\\]\\([^\\)\\s]+\\)`, 'mi');
  let result = '';

  do {
    const index = body.search(linker);
    if (index === -1) {
      result += body;
      break;
    }

    const [hit, text] = linker.exec(body.substring(index)) as unknown as [string, string];
    const rest = index + hit.length;

    result += body.substring(0, index) + text;
    body = body.substring(rest);
  } while (body !== '');

  return result;
}
