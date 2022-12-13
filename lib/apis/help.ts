import { getSchemaFile, readFile } from '../helper.js';

const PREFIX = '\t';
const commands: Record<string, string> = {
  version: '更新版本',
  deps: '更新套件',
  help: '顯示此訊息',
  init: '初始化專案',
};

type ItemSchema = {
  title: string;
  default?: string | boolean;
  type?: string;
  underlineKey: string;
  description?: string;
};

export default function (command?: string) {
  const pureCommand = !commands[command ?? ''] || command === 'help';

  if (pureCommand) {
    console.log('Usage: (npx) bumper <command> [args]\nCommands');
    printCommands();
    console.log('\nArgs:\n\t-h, --help 顯示相關 Command 的 Args');
  } else {
    console.log(`Usage: (npx) bumper ${command} [args]\nArgs:`);
    printArgsFromSchema(command ?? '');
  }
}

function printCommands() {
  const keyMaxLength = Object.keys(commands)
    .map((k) => k.length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));

  Object.entries(commands).forEach(([key, desc]) => {
    const spaces = keyMaxLength - key.length;
    const prefix = PREFIX + key + ' '.repeat(spaces);
    console.log(prefix + ' ' + desc);
  });
}

function printArgsFromSchema(command: string) {
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
    },
  };

  if (command === 'deps') {
    schema = schema.properties.deps;
  } else {
    delete schema.properties.deps;
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

  const keyMaxLength = Object.keys(options)
    .map((k) => k.length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));
  Object.entries(options).forEach(([key, meta]) => {
    const spaces = keyMaxLength - key.length;
    const prefix = '--' + key + ' '.repeat(spaces);
    const descSpaces = PREFIX + ' '.repeat(prefix.length + 1);
    const desc = meta.description?.split('\n').join('\n' + descSpaces);
    const typ = meta.type ? '類型：' + meta.type.toString() : null;
    const def = meta.default ? '預設：' + meta.default.toString() : null;
    const env = '環境變數：BUMPER_' + meta.underlineKey.toUpperCase();

    console.log(PREFIX + prefix + ' ' + meta.title);
    desc && console.log(descSpaces + desc);
    typ && console.log(PREFIX + ' '.repeat(prefix.length - 5) + typ);
    def && console.log(PREFIX + ' '.repeat(prefix.length - 5) + def);
    console.log(PREFIX + ' '.repeat(prefix.length - 9) + env);
  });
}

function* parseObject(
  obj: Record<string, unknown>
): Generator<[string, ItemSchema], void, unknown> {
  if (obj['cli']) {
    for (const entry of Object.entries(obj['cli'])) {
      yield [entry[0], { type: 'string', ...entry[1] }];
    }
    return;
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const child = obj[key] as Record<string, never>;
      if (['number', 'string', 'boolean'].includes(child['type'] ?? '')) {
        yield [child['cliName'] ?? key, child as unknown as ItemSchema];
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
    parsed =
      parsed.substring(0, index) +
      '_' +
      parsed.charAt(index).toLowerCase() +
      parsed.substring(index + 1);
  }

  return parsed;
}
