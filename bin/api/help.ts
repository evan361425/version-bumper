const PREFIX = '\t';
const commands: Record<string, string> = {
  '': 'Specific version to bump',
  version: 'Show latest version of this package',
  help: 'Show this message',
  init: 'Create a new configuration file',
};
const allowedTypes = ['array', 'number', 'string', 'boolean'];
const arrayPrefix = '以逗號（,）做為區隔';

type ItemSchema = {
  title?: string;
  default?: string | boolean;
  type?: string;
  underlineKey: string;
  description?: string;
  alias?: string[];
};

export function helpCommand(firstArg: string): void {
  if (firstArg === 'version') {
    console.log(`Usage: (npx) bumper version [args]\nArgs:\n\tNo arguments, only show the latest version`);
  }

  if (firstArg === 'help') {
    console.log('Usage: (npx) bumper <command|version|> [args]\nCommands');
    printCommands();
    console.log('\nArgs:\n\t-h, --help Show available arguments');
    console.log('\t-v, --version Show version');
    return;
  }

  console.log(`Usage: (npx) bumper <version|> [args]\nIf no version given, it will ask for it\nArgs:`);
  printArgsFromSchema();
}

function printCommands() {
  const keyMaxLength = Object.keys(commands)
    .map((k) => (k || '(any else)').length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));

  Object.entries(commands).forEach(([key, desc]) => {
    key = key || '(any else)';
    const spaces = keyMaxLength - key.length;
    const prefix = PREFIX + key + ' '.repeat(spaces);
    console.log(prefix + ' ' + desc);
  });
}

function printArgsFromSchema() {
  const file = getSchemaFile();
  let schema = JSON.parse(readFile(file));

  const options: Record<string, ItemSchema> = {
    config: {
      title: '設定檔的位置',
      default: './bumper.json',
      type: 'string',
      underlineKey: 'config',
    },
    debug: {
      title: '執行程式而不會有任何副作用',
      default: false,
      type: 'boolean',
      description: '同時會輸出一些雜七雜八的日誌到 stdout',
      underlineKey: 'debug',
      alias: ['-d'],
    },
    verbose: {
      title: '執行程式時輸出雜七雜八的東西',
      default: false,
      type: 'boolean',
      description: '他和 debug 只差在 debug 不會真的執行且會輸出 IO 的操作\ndebug 會覆寫此設定',
      underlineKey: 'verbose',
      alias: ['-v'],
    },
  };

  if (command === 'deps') {
    schema = schema.properties.deps;
  } else {
    delete schema.properties.deps;
    delete schema.properties['$schema'];
    options['stage'] = {
      title: '你可以指定要使用的 Tag',
      type: 'string',
      underlineKey: 'stage',
    };
  }

  for (const option of parseObject(schema)) {
    const [key, meta] = option;
    meta.underlineKey = camelToUnderline(key);

    options[key] = meta;
  }

  const keyMaxLength = Object.entries(options)
    .map(([key, meta]) => [key, ...(meta.alias ?? [])].join(',').length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));
  Object.entries(options).forEach(([key, meta]) => {
    key = [key, ...(meta.alias ?? [])].join(',');
    const spaces = keyMaxLength - key.length;
    const prefix = '--' + key + ' '.repeat(spaces);
    const descSpaces = PREFIX + ' '.repeat(prefix.length + 1);
    const desc = meta.description?.split('\n').join('\n' + descSpaces);
    const typ = meta.type ? '類型：' + meta.type.toString() : null;
    const def = meta.default ? '預設：' + meta.default.toString() : null;
    const env = '環境變數：BUMPER_' + meta.underlineKey.toUpperCase();

    console.log(PREFIX + prefix + ' ' + (meta.title ?? desc));
    meta.title && desc && console.log(descSpaces + desc);
    typ && console.log(PREFIX + ' '.repeat(prefix.length - 5) + typ);
    def && console.log(PREFIX + ' '.repeat(prefix.length - 5) + def);
    console.log(PREFIX + ' '.repeat(prefix.length - 9) + env);
  });
}

function* parseObject(obj: Record<string, unknown>): Generator<[string, ItemSchema], void, unknown> {
  if (obj['cli']) {
    for (const entry of Object.entries(obj['cli'])) {
      yield [entry[0], { type: 'string', ...entry[1] }];
    }
    return;
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const child = obj[key] as Record<string, never>;

      if (Array.isArray(child['type'])) {
        child['type'] = 'array' as never;
      }

      if (allowedTypes.includes(child['type'] ?? '')) {
        if (child['type'] === 'array') {
          const d = child['description'];
          child['type'] = 'string' as never;
          child['description'] = (d ? arrayPrefix + '\n' + d : arrayPrefix) as never;
        }

        const k = child['cliName'] ?? key;

        if (k) {
          yield [k, child as unknown as ItemSchema];
        }
      } else if (typeof child === 'object') {
        yield* parseObject(child);
      }
    }
  }
}

function camelToUnderline(value: string) {
  const re = new RegExp(/([A-Z])/);
  let parsed = value;
  while (re.test(parsed)) {
    const index = re.exec(parsed)?.index ?? -1;
    parsed = parsed.substring(0, index) + '_' + parsed.charAt(index).toLowerCase() + parsed.substring(index + 1);
  }

  return parsed;
}
