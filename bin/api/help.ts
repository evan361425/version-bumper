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
  console.log('');
  console.log(
    [
      'Key with "[]" means array variables, like "autolink[]link", it can have multiple values',
      'But any repeated key will be pushed to the array, like "autolink[]link=link1", "autolink[]link=link2" will be',
      '[{"link":"link1"}, {"link":"link2"}]',
      'If you like to set other properties, you should do it before "auto[]link", like ',
      '"autolink[]link=link1", "autolink[]match[]=match1", "autolink[]link=link2" will be',
      '[{"link":"link1","matches":["match1"]}, {"link":"link2"}]',
    ].join('\n'),
  );
  console.log('');
  console.log(
    [
      'Combine multiple tag can be done by setting same name.',
      'Since array (arg key with []) are pushed, you can overwrite value of specific tag by setting the same name.',
      'For example, when using semantic tag, you want to add PR settings.',
      '"--tag[]name=semantic", "--tag[]pr[]head=deployment", "--tag[]pr[]base=main"',
      'will be [{"name":"semantic","pr":[{"head":"deployment","base":"main"}],"...":"and other settings"}',
    ].join('\n'),
  );
  console.log('');
  console.log(
    [
      'Template: when you see type is "template", it means you can do these things:',
      '- Use a string with the template, like "<prefix>-v=Bump to {version}", prefix is the key name like "clog-commit".',
      '- Load content from a file, like "<prefix>-f=./path/to/file".',
      '- Load content from GitHub, like "<prefix>-gh-repo=example/example", "<prefix>-gh-branch=master", "<prefix>-gh-path=path/to/file"',
      '',
      'Template variables can bind as:',
      '- {<key>} for the <key> name, like {versionName} for the name of version',
      '- {<prefix>"<key>"<suffix>} for the <key> name with prefix and suffix, like "Hi, {Version "version" is created}"',
      '  If <version> is "1.0.0", it will be "Hi, Version 1.0.0 is created" and if <version> is empty, it will be "Hi, "',
    ].join('\n'),
  );
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
