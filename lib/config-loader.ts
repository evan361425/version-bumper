import path from 'node:path';
import { Config } from './config.js';
import { BumperError } from './errors.js';
import { Tag } from './factories.js';
import { DeepPartial, IConfig, IProcess, ITemplate } from './interfaces.js';
import { askQuestion, readFile } from './io.js';
import { log, verbose } from './logger.js';
import { breaker } from './util.js';

export const DEFAULT_CONFIG_PATH = 'bumper.json';

/**
 * This is the mapping of the command line arguments to the config keys.
 *
 * It helps auto-generate the documentation of the command.
 */
export const configArgsMap: ConfigArguments<IConfig> = {
  repo: {
    link: 'repo',
  },
  process: {
    bump: 'bump',
    push: 'push',
    pr: 'pr',
    release: 'release',
    checkTag: 'check-tag',
    wantedTicket: 'wanted-ticket',
    useSemanticGroups: 'semantic-groups',
    useSemanticTag: 'semantic-tag',
    useReleaseCandidateTag: 'rc-tag',
  },
  changelog: {
    enable: 'clog',
    destination: 'clog-dest',
    section: 'clog-section',
    commit: {
      message: 'clog-commit',
      addAll: 'clog-commit-add-all',
    },
  },
  autoLinks: [
    {
      link: 'autolink[]link',
      matches: ['autolink[]match[]'],
    },
  ],
  pr: {
    title: 'pr-title',
    body: 'pr-body',
  },
  diff: {
    groups: [
      {
        matches: ['diff-gp[]match[]'],
        title: 'diff-gp[]title',
        priority: 'diff-gp[]priority',
      },
    ],
    item: 'diff-item',
    scopeNames: 'diff-scope[]',
    ignored: ['diff-ignored[]'],
    ignoreOthers: 'diff-ignore-others',
    othersTitle: 'diff-others',
  },
  tags: [
    {
      name: 'tag[]name',
      pattern: 'tag[]pattern',
      prs: [
        {
          head: 'tag[]pr[]head',
          base: 'tag[]pr[]base',
          labels: ['tag[]pr[]labels[]'],
          reviewers: ['tag[]pr[]reviewers[]'],
          commitMessage: 'tag[]pr[]commit',
          replacements: [
            {
              paths: ['tag[]pr[]repl[]paths[]'],
              pattern: 'tag[]pr[]repl[]pattern',
              replacement: 'tag[]pr[]repl[]repl',
              commitMessage: 'tag[]pr[]repl[]commit',
            },
          ],
        },
      ],
      release: {
        enable: 'tag[]release',
        title: 'tag[]release-title',
        body: 'tag[]release-body',
        draft: 'tag[]release-draft',
        preRelease: 'tag[]release-pre-release',
      },
      withChangelog: 'tag[]with-clog',
    },
  ],
};
export const argsAliases: Record<string, string> = {
  verbose: 'v',
  debug: 'd',
  config: 'c',
  tag: 'T',
  ticket: 't',
  repo: 'r',
};

/**
 * @param key
 * @param args from `process.argv`
 * @returns
 */
export function getValueFromArgs(key: string, args: string[]): string | undefined {
  const index = args.findIndex((v) => {
    const alias = argsAliases[key];
    if (alias && (v === '-' + alias || v.startsWith('-' + alias + '='))) return true;
    return v === '--' + key || v.startsWith('--' + key + '=');
  });
  if (index === -1) return;

  const arg = args[index];
  if (arg?.includes('=')) return breaker(arg, 1, '=')[1];

  return args[index + 1];
}

export function getBoolFromArgs(key: string, args: string[]): boolean {
  const index = args.findIndex((v) => {
    const alias = argsAliases[key];
    if (alias && (v === '-' + alias || v.startsWith('-' + alias + '='))) return true;
    return v === '--' + key || v === '--no-' + key;
  });
  if (index === -1) return false;

  const arg = args[index]!;
  if (arg.includes('=')) return breaker(arg, 1, '=')[1] !== 'false';

  return arg === '--' + key;
}

export function getArrayFromArgs(key: string, args: string[]): string[] {
  const result: string[] = [];
  args.forEach((k, idx) => {
    if (k.startsWith('--' + key + '=')) {
      result.push(breaker(k, 1, '=')[1]!);
      return;
    }

    if (k === '--' + key) {
      const v = args[idx + 1];
      if (v) {
        result.push(v);
      }
    }
  });

  return result;
}

export function loadConfigFromFile(args: string[]): IConfig {
  const name = process.env['BUMPER_CONFIG'] ?? getValueFromArgs('config', args) ?? DEFAULT_CONFIG_PATH;
  const file = path.resolve(name);

  verbose(`Start loading config from ${file}.`);
  const content = readFile(file);
  if (!content) {
    log(`Config file ${file} not found, ignore it.`);
    return {};
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    log(`Failed to load config from ${file}: ${err}`);
    return {};
  }
}

export function loadConfigFromArgs(args: string[]): DeepPartial<IConfig> {
  const getV = (k: string, ca?: string[]) => getValueFromArgs(k, ca ?? args);
  const getB = (k: string, ca?: string[]) => getBoolFromArgs(k, ca ?? args);

  function getTemplate(prefix: string, ca?: string[]): DeepPartial<ITemplate> {
    return {
      value: getV(prefix + '-v', ca),
      file: getV(prefix + '-f', ca),
      github: {
        repo: getV(prefix + '-gh-repo', ca),
        branch: getV(prefix + '-gh-branch', ca),
        path: getV(prefix + '-gh-path', ca),
      },
    };
  }

  function splitArrayArgs(args: string[], prefix: string): string[][] {
    // get actual wanted args
    const wanted: string[] = [];
    args.forEach((arg, idx) => {
      if (!arg.startsWith(`--${prefix}[]`)) {
        return;
      }

      wanted.push(arg);
      // check if next arg is value, not flag
      if (args[idx + 1]?.startsWith('-') === false) {
        wanted.push(args[idx + 1]!);
      }
    });

    const result: string[][] = [];
    let parts: string[] = [];
    for (const arg of args) {
      const idx = arg.substring(prefix.length + 4).indexOf('[]');
      // check if this is not pure key-value pair
      if (idx !== -1) {
        parts.push(arg);
        continue;
      }

      if (parts.indexOf(arg) !== -1) {
        result.push(parts);
        parts = [];
      }
      parts.push(arg);
    }

    result.push(parts);
    return result;
  }

  // only mode
  const processInfo: Partial<IProcess> = {};
  if (getB('only-pr') || getB('only-release')) {
    processInfo.pr = getB('only-pr');
    processInfo.release = getB('only-release');

    processInfo.bump = false;
    processInfo.checkTag = false;
    processInfo.push = false;
  }

  return {
    repo: {
      link: getV(configArgsMap.repo!.link!),
    },
    process: {
      bump: getB(configArgsMap.process!.bump!),
      push: getB(configArgsMap.process!.push!),
      pr: getB(configArgsMap.process!.pr!),
      release: getB(configArgsMap.process!.release!),
      checkTag: getB(configArgsMap.process!.checkTag!),
      useSemanticGroups: getB(configArgsMap.process!.useSemanticGroups!),
      useSemanticTag: getB(configArgsMap.process!.useSemanticTag!),
      useReleaseCandidateTag: getB(configArgsMap.process!.useReleaseCandidateTag!),
    },
    changelog: {
      enable: getB(configArgsMap.changelog!.enable!),
      destination: getV(configArgsMap.changelog!.destination!),
      section: getTemplate(configArgsMap.changelog!.section!),
      commit: {
        message: getTemplate(configArgsMap.changelog!.commit!.message!),
        addAll: getB(configArgsMap.changelog!.commit!.addAll!),
      },
    },
    autoLinks: splitArrayArgs(args, 'autolink').map((ca) => {
      return {
        link: getV(configArgsMap.autoLinks![0]!.link!, ca),
        matches: getArrayFromArgs(configArgsMap.autoLinks![0]!.matches![0]!, ca),
      };
    }),
    pr: {
      title: getTemplate(configArgsMap.pr!.title!),
      body: getTemplate(configArgsMap.pr!.body!),
    },
    diff: {
      groups: splitArrayArgs(args, 'diff-gp').map((ca) => {
        return {
          matches: getArrayFromArgs(configArgsMap.diff!.groups![0]!.matches![0]!, ca),
          title: getV(configArgsMap.diff!.groups![0]!.title!, ca),
          priority: Number(getV(configArgsMap.diff!.groups![0]!.priority!, ca)),
        };
      }),
      item: getTemplate(configArgsMap.diff!.item!),
      scopeNames: Object.fromEntries(
        getArrayFromArgs(configArgsMap.diff!.scopeNames!, args).map((e) => breaker(e, 1, '=')),
      ),
      ignored: getArrayFromArgs(configArgsMap.diff!.ignored![0]!, args),
      ignoreOthers: getB(configArgsMap.diff!.ignoreOthers!),
      othersTitle: getV(configArgsMap.diff!.othersTitle!),
    },
    tags: splitArrayArgs(args, 'tag').map((ca) => {
      const tag = configArgsMap.tags![0]!;
      return {
        name: getV(tag.name!, ca),
        pattern: getV(tag.pattern!, ca),
        prs: splitArrayArgs(ca, 'tag[]pr').map((pra) => {
          const pr = tag.prs![0]!;
          return {
            head: getV(pr.head!, pra),
            base: getV(pr.base!, pra),
            labels: getArrayFromArgs(pr.labels![0]!, pra),
            reviewers: getArrayFromArgs(pr.reviewers![0]!, pra),
            commitMessage: getTemplate(pr.commitMessage!, pra),
            replacements: splitArrayArgs(pra, 'tag[]pr[]repl').map((repl) => {
              const r = pr.replacements![0]!;
              return {
                paths: getArrayFromArgs(r.paths![0]!, repl),
                pattern: getV(r.pattern!, repl),
                replacement: getV(r.replacement!, repl),
                commitMessage: getTemplate(r.commitMessage!, repl),
              };
            }),
          };
        }),
        release: {
          enable: getB(tag.release!.enable!, ca),
          title: getTemplate(tag.release!.title!, ca),
          body: getTemplate(tag.release!.body!, ca),
          draft: getB(tag.release!.draft!, ca),
          preRelease: getB(tag.release!.preRelease!, ca),
        },
        withChangelog: getB(tag.withChangelog!, ca),
      };
    }),
  };
}

export async function askForWantedVars(
  args: string[],
  cfg: Config,
): Promise<{ tag: Tag; version: string; ticket: string }> {
  const tagName = getValueFromArgs('tag', args) ?? cfg.tags[0]?.name;
  const tag = cfg.tags.find((t) => t.name === tagName);

  if (!tag) {
    throw new BumperError(`Tag ${tagName} not found in the configuration.`);
  }

  const last = await tag.findLastTag();

  // start asking for the version
  let version = args[0] ?? '';
  if (!version || version.startsWith('-')) {
    const nameInfo = tag.name ? `${tag.name} ` : '';
    const lastInfo = last ? `(last version is ${last})` : '(no previous version found)';
    version = await askQuestion(`Enter new ${nameInfo}version ${lastInfo}: ${tag.pattern}\n`);
  }

  if (!tag.verify(version)) {
    throw new BumperError(`Version ${version} does not match the pattern ${tag.pattern}`);
  }
  if (!tag.sort.firstIsGreaterThanSecond(version, last)) {
    throw new BumperError(`Version ${version} is not greater than the last version ${last}`);
  }

  let ticket: string = '';
  if (cfg.process.wantedTicket) {
    ticket = getValueFromArgs('ticket', args) ?? (await askQuestion('Please provide the ticket number:\n'));
  }

  return { version, ticket, tag };
}

type ConfigArguments<T> = T extends ITemplate
  ? string
  : T extends Record<string, any> | undefined
    ? {
        [P in keyof T]?: ConfigArguments<T[P]>;
      }
    : string;
