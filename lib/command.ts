import { spawn } from 'node:child_process';
import { isDebug } from './io.js';
import { log, verbose } from './logger.js';

let mockResponses: string[] = [];
let mockedCommands: string[] = [];

export function resetMocked(): string[][] {
  const result = [mockResponses, mockedCommands];
  mockResponses = [];
  mockedCommands = [];
  return result;
}
export function mockCommandResponse(response: string): void {
  mockResponses.push(response);
}
export function getFirstMockedCommand(): string {
  return mockedCommands.shift() ?? '';
}

/**
 * Spawn a command and return the response
 *
 * @param oneByOne - If provided, the function will be called for each line of the response.
 *   If the function returns true, the command will stop and return the line that return true.
 * @returns
 */
export function command(name: string, args: string[], oneByOne?: (line: string) => boolean): Promise<string> {
  verbose(`[cmd]: ${name} '${args.join("' '")}'`);

  if (isDebug()) {
    const resp = mockResponses.shift();
    mockedCommands.push(`${name} ${args.join(' ')}`);
    return Promise.resolve(resp ?? '');
  }

  return new Promise((res, rej) => {
    const command = spawn(name, args);
    let response = '';
    let error = '';

    command.stdout.on('data', (data) => {
      const lines = data.toString();
      if (oneByOne !== undefined) {
        for (const line of lines.split('\n').filter(Boolean)) {
          if (oneByOne(line)) {
            command.kill();
            res(line);
            return;
          }
        }
      } else {
        response += lines;
      }
    });
    command.stderr.on('data', (data) => (error += data.toString()));
    command.on('error', (error) => {
      const err = `${error}`.trim();
      log(`[cmd]: ${name} error: ${err}`);
      rej(err);
    });
    command.on('close', () => {
      if (error !== '') {
        if (name === 'git' && args[0] === 'push') {
          res(response);
          return;
        }

        const err = `${error}`.trim();
        log(`[cmd]: ${name} close with error: ${err}`);
        rej(new Error(`Command: ${name} ${args.join(' ')} \nerror:\n${err}`));
      } else {
        verbose(`[cmd]: response: ${response}`);
        res(response);
      }
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
  });
}
