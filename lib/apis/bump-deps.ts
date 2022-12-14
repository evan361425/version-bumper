import { Config } from '../config.js';
import {
  appendFile,
  breaker,
  createCommand,
  npm,
  writeFile,
} from '../helper.js';
import { info, notice } from '../logger.js';
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
  let output = '';

  if (deps.length) {
    notice(`${SEPARATOR} Start Dependencies ${SEPARATOR}\n`);
    await setUpRepo(deps);

    if (!config.appendOnly) {
      config.output && writeFile(config.output, TABLE_PREFIX);
    }

    for (const dep of deps) {
      writeDep(dep);
      await update(config, dep);
    }
  }

  if (devDeps.length) {
    notice(`\n${SEPARATOR} Start Dev Dependencies ${SEPARATOR}\n`);
    await setUpRepo(devDeps);

    config.output && appendFile(config.output, '\n' + TABLE_PREFIX);
    const newPkg = new PackageJson();

    for (const dep of devDeps) {
      writeDep(dep);
      if (config.devInfo.oneByOne) {
        await update(config.devInfo, dep);
      } else {
        notice(dep.toString());
        newPkg.fixDev(dep.name, dep.target);
      }
    }

    if (!config.devInfo.oneByOne) {
      newPkg.writeBackToFile();
      await update(config.devInfo);
    }
  }

  if (!config.output) {
    console.log(output);
  }

  function writeDep(dep: OutdatedPackage) {
    const [name, current, target, link] = dep.properties;
    const nWL = link ? `[${name}](${link})` : name;
    if (config.output) {
      appendFile(config.output, `| ${nWL} | ${current} | ${target} |\n`);
    } else {
      output += `${name}\t${current}\t${target}\t${link}\n`;
    }
  }
}

class OutdatedPackage {
  readonly name: string;

  readonly current: string;

  readonly target: string;

  isDev = false;

  link: string | undefined;

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

  get properties(): string[] {
    const p = [this.name, this.current, this.target];
    if (this.link) p.push(this.link);

    return p;
  }

  markDev() {
    this.isDev = true;
    return this;
  }

  setLink(link: string) {
    info(`[dep] found ${this.name}'s link ${link}`);
    this.link = link;
    return this;
  }

  toString(): string {
    return `${this.name} ${this.current} -> ${this.target}`;
  }
}

async function update(info: PrePost, dep?: OutdatedPackage) {
  dep && notice(dep.toString());
  for (const cmd of info.preCommands) {
    await execCommand(cmd, dep);
  }

  const cmd = ['install', '--registry=https://registry.npmjs.org/'];
  if (dep) cmd.push(`${dep.name}@${dep.target}`);
  if (Config.instance.deps.saveExact) cmd.push('--save-exact');
  if (dep?.isDev) cmd.push('--save-dev');

  const response = await npm(...cmd);
  response && notice(response);

  for (const cmd of info.postCommands) {
    await execCommand(cmd, dep);
  }
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
    notice(await createCommand(exec, parsed));
  }
}

async function setUpRepo(deps: OutdatedPackage[]) {
  info('[dep] start getting repo links');
  const names = deps.map((d) => d.name);

  /**
   * example:
   * got repo available at the following URL:
   *   https://github.com/sindresorhus/got
   *
   * redis repo available at the following URL:
   *   https://github.com/redis/node-redis
   */
  const result = await npm('repo', ...[...names, '--no-browser']);
  const lines = result
    .split('\n')
    .map((e) => e.trim())
    .filter(Boolean);

  for (const d of deps) {
    const idx = lines.indexOf(`${d.name} repo available at the following URL:`);
    const url = lines[idx + 1];
    if (url?.startsWith('https:/')) {
      d.setLink(url);
    }
  }
}

type PrePost = {
  preCommands: string[] | string[][];
  postCommands: string[] | string[][];
};
