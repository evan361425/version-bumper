import { info } from 'console';
import { spawn } from 'node:child_process';
import { isDebug } from './io.js';
import { verbose } from './logger.js';

let mockResponses: string[] = [];

export function mockCommandResponse(response: string): void {
  mockResponses.push(response);
}

/**
 * Spawn a command and return the response
 *
 * @param oneByOne - If provided, the function will be called for each line of the response.
 *   If the function returns true, the command will stop and return the line that return true.
 * @returns
 */
export function command(name: string, args: string[], oneByOne?: (line: string) => boolean): Promise<string> {
  info(`[cmd]: ${name} '${args.join("' '")}'`);

  if (isDebug()) {
    const resp = mockResponses.shift();
    return Promise.resolve(resp ?? '');
  }

  return new Promise((res, rej) => {
    const command = spawn(name, args);
    let response = '';
    let error = '';

    command.stdout.on('data', (data) => {
      const line = data.toString();
      if (oneByOne !== undefined) {
        verbose(`[cmd]: ${name} one by one: ${line}`);
        if (oneByOne(line)) {
          command.kill();
          res(line);
        }
      } else {
        response += line;
      }
    });
    command.stderr.on('data', (data) => (error += data.toString()));
    command.on('error', (err) => {
      info(`[cmd]: ${name} error: ${err}`);
      rej(err);
    });
    command.on('close', () => {
      if (error !== '') {
        info(`[cmd]: ${name} error: ${error}`);
        rej(new Error(`Command: ${name} ${args.join(' ')} \nerror:\n${error}`));
      } else {
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
