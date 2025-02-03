import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';

let debug = false;
let verbose = false;
let mockFileContents: string[] = [];
let mockAsk: string[] = [];

export function startDebug(): void {
  debug = true;
}
export function stopDebug(): void {
  debug = false;
}
export function isDebug(): boolean {
  return debug;
}

export function startVerbose(): void {
  console.log('===== start verbose mode =====');
  verbose = true;
}
export function isVerbose(): boolean {
  return verbose;
}

export function mockFileContent(text: string): void {
  mockFileContents.push(text);
}
export function mockAskContent(text: string): void {
  mockAsk.push(text);
}

export function readFile(fileName: string): string {
  if (mockFileContents.length !== 0) {
    return mockFileContents.shift()!;
  }

  return existsSync(fileName) ? readFileSync(fileName).toString() : '';
}

export function writeFile(fileName: string, data: string) {
  if (isDebug()) {
    console.log('[io]: write file to', fileName);
    console.log(data);
    return;
  }

  writeFileSync(fileName, data);
}

export function askQuestion(question: string): Promise<string> {
  if (mockAsk.length !== 0) {
    return Promise.resolve(mockAsk.shift()!);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
      rl.close();
      // https://stackoverflow.com/questions/44153552/readline-doesnt-stop-line-reading-after-rl-close-emit-in-nodejs
      rl.removeAllListeners();
    });
  });
}
