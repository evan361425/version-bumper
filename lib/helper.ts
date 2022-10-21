import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { info, error } from './logger.js';

let debug = false;

export function startDebug(): void {
  debug = true;
}

export function stopDebug(): void {
  debug = false;
}

export function isDebug(): boolean {
  return debug;
}

function createCommand(name: string, args: string[]): Promise<string> {
  const force = typeof args[0] === 'boolean' ? args.shift() : false;
  info(`[cmd]: ${name} '${args.join("' '")}'`);
  if (!force && isDebug()) return Promise.resolve('');

  return new Promise((res, rej) => {
    const command = spawn(name, args);
    let response = '';
    let error = '';

    command.stdout.on('data', (data) => (response += data.toString()));
    command.stderr.on('data', (data) => (error += data.toString()));
    command.on('error', (err) => {
      rej(err);
    });
    command.on('close', () => {
      error !== '' ? rej(new Error(error)) : res(response);
    });
  });
}

export async function git(...args: string[]): Promise<string> {
  try {
    return await createCommand('git', args);
  } catch (err) {
    error(`${err}`);
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

export function readFile(fileName: string) {
  return existsSync(fileName) ? readFileSync(fileName).toString() : '';
}

export function writeFile(fileName: string, data: string) {
  isDebug() ? info(data) : writeFileSync(fileName, data);
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
      if (e[0]) meta[e[0].toLowerCase() as keyof MarkdownMeta] = e[1];
    });

  return [meta, body?.trim() ?? ''];
}
