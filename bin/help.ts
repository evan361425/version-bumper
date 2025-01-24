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

  parseMsg(): string {
    const info = `--${this.key}`;
    const msg = this.title
      .split('\n')
      .filter(Boolean)
      .flatMap((m) => m.split('. ').map((m, i, a) => (i === a.length - 1 ? m : `${m}.`)));

    return [
      info,
      `  type: ${this.type}`,
      `  default: ${this.other ?? '<required>'}`, // no default means required
      ...msg.map((m) => `  ${m}`),
    ]
      .map((m) => '  ' + m)
      .join('\n');
  }
}

(function main() {
  for (const arg of findArgs()) {
    console.log(arg.parseMsg());
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
    const title = [def.title, def.description].filter(Boolean).join('\n');
    args.push(
      new MyArg(
        name,
        title ? title : 'No description provided.',
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
        description: def!.description,
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
