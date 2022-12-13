import { Config } from '../config.js';
import {
  appendFile,
  breaker,
  createCommand,
  npm,
  writeFile,
} from '../helper.js';
import { PackageJson } from '../package-json.js';

const TABLE_PREFIX = '|Package|Old|New|\n|-|-|-|\n';
const SEPARATOR = '='.repeat(10);

export default async function () {
  const config = (await Config.instance.init('deps')).deps;
  const pkg = new PackageJson();

  // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'string'
  const outdated = (await npm(true, 'outdated'))
    .split('\n')
    // remove column name and end empty line
    .slice(1, -1)
    .map((el) => new OutdatedPackage(el.split(' ').filter((e) => Boolean(e))))
    .filter((e) => e.isValid)
    .filter((e) => !match(e.name, config.ignored));

  const deps = outdated.filter((e) => !pkg.isDev(e.name));
  const devDeps = outdated.filter((e) => pkg.isDev(e.name) && e.markDev());

  if (deps.length) {
    console.log(`${SEPARATOR} Start Dependencies ${SEPARATOR}\n`);
    if (!config.appendOnly) {
      writeFile(config.output, TABLE_PREFIX);
    }

    for (const dep of deps) {
      dep.appendTo(config.output);
      await update(config, dep);
    }
  }

  if (devDeps.length) {
    console.log(`\n${SEPARATOR} Start Dev Dependencies ${SEPARATOR}\n`);
    appendFile(config.output, '\n' + TABLE_PREFIX);
    const newPkg = new PackageJson();

    for (const dep of devDeps) {
      dep.appendTo(config.output);
      if (config.devInfo.oneByOne) {
        await update(config.devInfo, dep);
      } else {
        console.log(dep.toString());
        newPkg.fixDev(dep.name, dep.target);
      }
    }

    if (!config.devInfo.oneByOne) {
      newPkg.writeBackToFile();
      await update(config.devInfo);
    }
  }
}

class OutdatedPackage {
  readonly name: string;

  readonly current: string;

  readonly target: string;

  isDev = false;

  //                Package           Current    Wanted     Latest     Location
  // element from: '@types/express', '4.17.11', '4.17.12', '4.17.13', 'my-repo'
  //                Package           Current    Latest
  //           to: ['@types/express', '4.17.11', '4.17.13']
  constructor(entry: string[]) {
    this.name = entry[0] ?? '';
    this.current = entry[1] ?? '';

    const useLatest =
      Config.instance.deps.allLatest ||
      match(this.name, Config.instance.deps.latestDeps);
    this.target = (useLatest ? entry[3] : entry[2]) ?? '';
  }

  get isValid() {
    return (
      this.name && this.current && this.target && this.current !== this.target
    );
  }

  markDev() {
    this.isDev = true;
    return this;
  }

  appendTo(fileName?: string): void {
    appendFile(
      fileName,
      // TODO: add link
      `| [${this.name}](TODO) | ${this.current} | ${this.target} |\n`,
    );
  }

  toString(): string {
    return `${this.name} ${this.current} -> ${this.target}`;
  }
}

async function update(info: PrePost, dep?: OutdatedPackage) {
  dep && console.log(dep.toString());
  for (const cmd of info.preCommands) {
    await execCommand(cmd, dep);
  }

  const cmd = ['install', '--registry=https://registry.npmjs.org/'];
  if (dep) cmd.push(`${dep.name}@${dep.target}`);
  if (Config.instance.deps.saveExact) cmd.push('--save-exact');
  if (dep?.isDev) cmd.push('--save-dev');

  const response = await npm(...cmd);
  response && console.log(response);

  for (const cmd of info.postCommands) {
    await execCommand(cmd, dep);
  }
  dep && console.log('');
}

function match(target: string, list: string[]): boolean {
  for (const e of list) {
    if (e.endsWith('*')) {
      if (target.startsWith(e.substring(0, target.length - 1))) {
        return true;
      }
    } else if (target === e) {
      return true;
    }
  }
  return false;
}

async function execCommand(cmd: string | string[], dep?: OutdatedPackage) {
  const [exec, rawArgs] = Array.isArray(cmd)
    ? [cmd[0], cmd.slice(1)]
    : breaker(cmd, 1, ' ');
  const args = Array.isArray(rawArgs) ? rawArgs : rawArgs.split(' ');
  const parsed = args.map((e) => {
    return dep
      ? e
          .replace(/{name}/g, dep.name)
          .replace(/{current}/g, dep.current)
          .replace(/{target}/g, dep.target)
      : e;
  });

  if (exec) {
    console.log(await createCommand(exec, parsed));
  }
}

type PrePost = {
  preCommands: string[] | string[][];
  postCommands: string[] | string[][];
};
