import { info } from 'console';
import { spawn } from 'node:child_process';

let debug = false;
let mockResponses: string[] = [];

export function isDebug(): boolean {
  return debug;
}

export function mockCommandResponse(response: string): void {
  mockResponses.push(response);
}

export function command(name: string, args: string[]): Promise<string> {
  info(`[cmd]: ${name} '${args.join("' '")}'`);

  if (isDebug()) {
    const resp = mockResponses.shift();
    return Promise.resolve(resp ?? '');
  }

  return new Promise((res, rej) => {
    const command = spawn(name, args);
    let response = '';
    let error = '';

    command.stdout.on('data', (data) => (response += data.toString()));
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
