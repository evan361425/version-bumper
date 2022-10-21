import path from 'node:path';
import { readFile } from './helper.js';

const PREFIX = '\t';
const commands = {
  version: '更新版本，預設的 command',
  help: '顯示此訊息',
};

type ItemSchema = {
  title: string;
  default?: string | boolean;
  type?: string;
  underlineKey: string;
  description?: string;
};

export default function () {
  console.log('Usage: (npx) bumper <command> [args]\n');
  console.log('Commands:');

  const keyMaxLength = Object.keys(commands)
    .map((k) => k.length)
    .reduce((prev, curr) => (curr > prev ? curr : prev));

  Object.entries(commands).forEach(([key, desc]) => {
    const spaces = keyMaxLength - key.length;
    const prefix = PREFIX + key + ' '.repeat(spaces);
    console.log(prefix + ' ' + desc);
  });

  console.log('\nArgs:');
  printArgsFromSchema();
}

function printArgsFromSchema() {
  const file = getSchemaFile();
  const schema = JSON.parse(readFile(file));

  const options: Record<string, ItemSchema> = {
    config: {
      title: '設定檔的位置',
      default: './bumper.json',
      type: 'string',
      underlineKey: 'config',
    },
  };
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

function getSchemaFile() {
  const file = path.join(import.meta.url, '..', '..', 'schema.json');
  const schemaIndex = file.indexOf(':');
  if (schemaIndex === -1) return file;

  return file.substring(schemaIndex + 1);
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
