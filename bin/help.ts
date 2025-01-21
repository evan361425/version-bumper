import { JSONSchema7 } from 'json-schema';
import { readFileSync } from 'node:fs';
import { argsAliases, configArgsMap, DEFAULT_CONFIG_PATH } from '../lib/config-loader.js';

class MyArg {
  _key?: string;

  constructor(
    readonly name: string,
    readonly title: string,
    readonly type: 'string' | 'boolean' | 'number' | 'template',
    readonly alias?: string,
    readonly other?: string | boolean | number,
  ) {}

  get key(): string {
    const name = this.type === 'boolean' ? `[no-]${this.name}` : this.name;
    return (this._key ??= this.alias ? `${name},-${this.alias}` : name);
  }

  parseMsg(spaces: string): string {
    const info = `--${this.key}${spaces}`;
    const prefix = ' '.repeat(info.length + 2);
    const msg = this.title
      .split('\n')
      .filter(Boolean)
      .flatMap((m) => m.split('. ').map((m, i, a) => (i === a.length - 1 ? m : `${m}.`)));

    return [
      info + '  ' + msg[0],
      ...msg.slice(1).map((m) => prefix + m),
      ' '.repeat(info.length - 4) + `type: ${this.type}`,
      ' '.repeat(info.length - 7) + `default: ${this.other ?? '<required>'}`,
    ]
      .map((m) => '\t' + m)
      .join('\n');
  }
}

(function main() {
  const args = findArgs();
  const keyMaxLength = args.map((arg) => arg.key.length).reduce((prev, curr) => (curr > prev ? curr : prev));

  for (const arg of args) {
    const spaces = keyMaxLength - arg.key.length;
    console.log(arg.parseMsg(' '.repeat(spaces)));
  }
})();

function findArgs(): MyArg[] {
  const rings: Record<string, string> = {};
  getKeyRings('', configArgsMap, rings);

  const TAG =
    "Wanted `tags` item's name, it will then use it to ask for the version number.\nIf not found, it will use the first `tags`'s name.";
  const TICKET = 'Wanted ticket number.\nIf not found, it will ask for it if `process.wantedTicket` is enabled.';
  const DEBUG = 'Execute in debug mode without any side effects\nAlso output command input to stdout';
  const RENAME: Record<string, string> = { autoLinks: 'autoLink', pr: 'PR', tags: 'tag' };
  const args: MyArg[] = [
    new MyArg('debug', DEBUG, 'boolean', argsAliases['debug'], false),
    new MyArg('verbose', 'Output many logs to stdout', 'boolean', argsAliases['verbose'], false),
    new MyArg('config', 'Path to the configuration file.', 'string', argsAliases['config'], DEFAULT_CONFIG_PATH),
    new MyArg('tag', TAG, 'string', argsAliases['tag']),
    new MyArg('ticket', TICKET, 'string', argsAliases['ticket']),
    new MyArg('only-pr', 'Only create PR, no any bumping.', 'boolean', undefined, false),
    new MyArg('only-release', 'Only create GitHub release, no any bumping.', 'boolean', undefined, false),
  ];

  const defs: Record<string, JSONSchema7> = JSON.parse(readFileSync('schema.json').toString('utf-8')).definitions;
  for (const [key, name] of Object.entries(rings)) {
    const def = findSchema(key, defs);
    args.push(
      new MyArg(
        name,
        def.title ?? name,
        def.type as 'string' | 'boolean' | 'number' | 'template',
        argsAliases[name],
        def.default as string | boolean | number | undefined,
      ),
    );
  }

  return args;

  function findSchema(key: string, _dfs: Record<string, JSONSchema7>): JSONSchema7 {
    let [root, ...keys] = key.split('.');
    keys = keys.filter((e) => e !== '0');

    // rename root for special case
    if (keys.length > 0) {
      root = RENAME[root!] ?? root;
    }

    // getting correct definition
    let def = _dfs[root!];
    if (!def) {
      const k = `I${root!.charAt(0).toUpperCase()}${root!.slice(1)}`;
      def = _dfs[k] ?? defs[k];
    }

    if (keys.length > 0) {
      // Get desired schema, for object or array
      let prop = def!.properties;
      if (!prop) {
        if (def!.$ref) {
          prop = defs[def!.$ref!.split('/').slice(-1)[0]!]!.properties!;
        } else {
          prop = defs[(def!.items! as JSONSchema7).$ref!.split('/').slice(-1)[0]!]!.properties!;
        }
      }

      return findSchema(keys.join('.'), prop as Record<string, JSONSchema7>);
    }

    // special case
    if (def!.$ref === '#/definitions/ITemplate') {
      return {
        type: 'template' as any,
        title: def!.title,
        default: def!.default ? `-v=${(def!.default as any).value}` : undefined,
      };
    }

    return def!;
  }
}

function getKeyRings(root: string, obj: Record<string, unknown>, record: Record<string, string>): void {
  for (let [key, value] of Object.entries(obj)) {
    if (root) {
      key = `${root}.${key}`;
    }

    if (typeof value === 'string') {
      record[key] = value;
    }
    if (typeof value === 'object') {
      getKeyRings(key, value as Record<string, unknown>, record);
    }
  }
}
