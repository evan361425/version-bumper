import { readFileSync } from 'node:fs';

const commands: Record<string, string> = {
  '': 'Specific version to bump',
  version: 'Show latest version of this package',
  help: 'Show this message',
};

export function helpCommand(firstArg: string): void {
  if (firstArg === 'version') {
    console.log(`Usage: (npx) bumper version [args]\nArgs:\n\tNo arguments, only show the latest version`);
    return;
  }

  if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
    console.log('Usage: (npx) bumper <command|version|$tag> [args]\nCommands');
    printCommands();
    console.log('\nArgs:\n\t-h, --help Show available arguments');
    console.log('\t-v, --version Show version');
    return;
  }

  console.log(`Usage: (npx) bumper <$tag> [args]\nIf no version given in first arg, it will ask for it\nArgs:`);
  printArgsFromSchema();
}

function printCommands() {
  const keyMaxLength = Object.keys(commands)
    .map((k) => (k || '(any else)').length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));

  Object.entries(commands).forEach(([key, desc]) => {
    key = key || '(any else)';
    const spaces = keyMaxLength - key.length;
    const prefix = '\t' + key + ' '.repeat(spaces);
    console.log(prefix + ' ' + desc);
  });
}

function printArgsFromSchema() {
  const msg = readFileSync('bin/api/help-args.txt', 'utf-8');
  console.log(msg);
}
