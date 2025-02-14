import path from 'node:path';
import { Config } from './config.js';
import { BumperError } from './errors.js';
import { Tag } from './factories.js';
import { DeepPartial, IConfig, IProcess, ITemplate } from './interfaces.js';
import { askQuestion, readFile, startDebug, startVerbose } from './io.js';
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
    checkRemoteTag: 'check-remote-tag',
    wantedTicket: 'wanted-ticket',
    diffFromChangelog: 'diff-from-clog',
    askToVerifyContent: 'ask-to-verify-content',
    askToChooseTag: 'ask-to-choose-tag',
    useSemanticGroups: 'semantic-groups',
    useSemanticTag: 'semantic-tag',
    useReleaseCandidateTag: 'rc-tag',
  },
  hook: {
    afterVerified: ['hook-after-verified[]'],
    replacements: [
      {
        paths: ['hook-repl[]paths[]'],
        pattern: 'hook-repl[]pattern',
        replacement: 'hook-repl[]repl',
      },
    ],
    afterAll: ['hook-after-all[]'],
  },
  changelog: {
    enable: 'clog',
    destination: 'clog-dest',
    destinationDebug: 'clog-dest-debug',
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
    repo: 'pr-repo',
    head: 'pr-head',
    headFrom: 'pr-head-from',
    base: 'pr-base',
    labels: ['pr-labels[]'],
    reviewers: ['pr-reviewers[]'],
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
      onlyPrIndices: ['tag[]only-pr[]'],
      from: [
        {
          name: 'tag[]from[]name',
          replaceFrom: 'tag[]from[]replace-from',
          replaceTo: 'tag[]from[]replace-to',
        },
      ],
      prs: [
        {
          repo: 'tag[]pr[]repo',
          head: 'tag[]pr[]head',
          headFrom: 'tag[]pr[]head-from',
          base: 'tag[]pr[]base',
          labels: ['tag[]pr[]labels[]'],
          reviewers: ['tag[]pr[]reviewers[]'],
          title: 'tag[]pr[]title',
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
  last: 'l',
};

export function loadConfigFromFile(args: string[]): IConfig {
  const name = process.env['BUMPER_CONFIG'] ?? getValueFromArgs('config', args) ?? DEFAULT_CONFIG_PATH;
  const file = path.resolve(name);

  verbose(`Start loading config from ${file}.`);
  const content = readFile(file);
  if (!content) {
    verbose(`[cfg] config file ${file} not found, ignore it.`);
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
    const wanted: string[][] = [];
    args.forEach((arg, idx) => {
      if (!arg.startsWith(`--${prefix}[]`)) {
        return;
      }

      const v = [arg];
      // check if next arg is value, not flag
      if (args[idx + 1]?.startsWith('-') === false) {
        v.push(args[idx + 1]!);
      }

      wanted.push(v);
    });

    const result: string[][] = [];
    let parts: string[] = [];
    for (const arg of wanted) {
      const idx = arg[0]!.substring(prefix.length + 4).indexOf('[]');
      // check if this is not pure key-value pair
      if (idx !== -1) {
        parts.push(...arg);
        continue;
      }

      if (parts.indexOf(arg[0]!) !== -1) {
        result.push(parts);
        parts = [];
      }
      parts.push(...arg);
    }

    result.push(parts);
    return result.filter((r) => r.length > 0);
  }

  getB('verbose') && startVerbose();
  getB('debug') && startDebug();

  // only mode
  const processInfo: Partial<IProcess> = {};
  if (getB('only-pr') || getB('only-release')) {
    processInfo.pr = getB('only-pr') ?? false;
    processInfo.release = getB('only-release') ?? false;

    processInfo.bump = false;
    processInfo.checkTag = false;
    processInfo.checkRemoteTag = false;
    processInfo.push = false;
    processInfo.askToVerifyContent = false;
  }

  return {
    repo: {
      link: getV(configArgsMap.repo!.link!),
    },
    process: {
      bump: processInfo.bump ?? getB(configArgsMap.process!.bump!),
      push: processInfo.push ?? getB(configArgsMap.process!.push!),
      pr: processInfo.pr ?? getB(configArgsMap.process!.pr!),
      release: processInfo.release ?? getB(configArgsMap.process!.release!),
      checkTag: processInfo.checkTag ?? getB(configArgsMap.process!.checkTag!),
      checkRemoteTag: processInfo.checkRemoteTag ?? getB(configArgsMap.process!.checkRemoteTag!),
      diffFromChangelog: getB(configArgsMap.process!.diffFromChangelog!),
      askToVerifyContent: processInfo.askToVerifyContent ?? getB(configArgsMap.process!.askToVerifyContent!),
      askToChooseTag: getB(configArgsMap.process!.askToChooseTag!),
      useSemanticGroups: getB(configArgsMap.process!.useSemanticGroups!),
      useSemanticTag: getB(configArgsMap.process!.useSemanticTag!),
      useReleaseCandidateTag: getB(configArgsMap.process!.useReleaseCandidateTag!),
    },
    hook: {
      afterVerified: getArrayFromArgs(configArgsMap.hook!.afterVerified![0]!, args),
      replacements: splitArrayArgs(args, 'hook-repl').map((ha) => {
        const repl = configArgsMap.hook!.replacements![0]!;
        return {
          paths: getArrayFromArgs(repl.paths![0]!, ha),
          pattern: getV(repl.pattern!, ha),
          replacement: getTemplate(repl.replacement!, ha),
        };
      }),
      afterAll: getArrayFromArgs(configArgsMap.hook!.afterAll![0]!, args),
    },
    changelog: {
      enable: getB(configArgsMap.changelog!.enable!),
      destination: getV(configArgsMap.changelog!.destination!),
      destinationDebug: getV(configArgsMap.changelog!.destinationDebug!),
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
      repo: getV(configArgsMap.pr!.repo!),
      head: getV(configArgsMap.pr!.head!),
      headFrom: getV(configArgsMap.pr!.headFrom!),
      base: getV(configArgsMap.pr!.base!),
      labels: getArrayFromArgs(configArgsMap.pr!.labels![0]!, args),
      reviewers: getArrayFromArgs(configArgsMap.pr!.reviewers![0]!, args),
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
        onlyPrIndices: getArrayFromArgs(tag.onlyPrIndices![0]!, ca).map((v) => Number(v)),
        from: splitArrayArgs(ca, 'tag[]from').map((fa) => {
          const from = tag.from![0]!;
          return {
            name: getV(from.name!, fa),
            replaceFrom: getV(from.replaceFrom!, fa),
            replaceTo: getV(from.replaceTo!, fa),
          };
        }),
        prs: splitArrayArgs(ca, 'tag[]pr').map((pra) => {
          const pr = tag.prs![0]!;
          return {
            repo: getV(pr.repo!, pra),
            head: getV(pr.head!, pra),
            headFrom: getV(pr.headFrom!, pra),
            base: getV(pr.base!, pra),
            labels: getArrayFromArgs(pr.labels![0]!, pra),
            reviewers: getArrayFromArgs(pr.reviewers![0]!, pra),
            title: getTemplate(pr.title!, pra),
            commitMessage: getTemplate(pr.commitMessage!, pra),
            replacements: splitArrayArgs(pra, 'tag[]pr[]repl').map((repl) => {
              const r = pr.replacements![0]!;
              return {
                paths: getArrayFromArgs(r.paths![0]!, repl),
                pattern: getV(r.pattern!, repl),
                replacement: getTemplate(r.replacement!, repl),
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

/**
 * Step 1: Find wanted Tag by the name or simply using first.
 * Step 2: Find the version to bump.
 *   - From the arguments
 *   - From the TagFrom
 *   - Ask the user
 * Step 3: Verify the version and update the last tag if needed.
 * Step 4: Find the ticket number if needed.
 */
export async function askForWantedVars(
  args: string[],
  cfg: Config,
): Promise<{ tag: Tag; version: string; ticket: string; versionLast: string }> {
  // Step1: find the wanted tag
  let chosen: string | undefined;
  if (cfg.process.askToChooseTag) {
    const tags = cfg.tags.map((t, i) => `${t.name}(${i})`).join(', ');
    const tag = await askQuestion(`Please choose the tag to bump: ${tags}\n`);
    chosen = cfg.tags.find((t) => t.name === tag)?.name ?? cfg.tags[Number(tag)]?.name;
  }

  const tagName = chosen ?? getValueFromArgs('tag', args) ?? cfg.tags[0]?.name;
  const tag = cfg.tags.find((t) => t.name === tagName);

  if (!tag) {
    throw new BumperError(`Tag ${tagName} not found in the configuration.`);
  }

  // Step2: find the version
  let version = args[0] ?? '';
  let last = (tag.lastTag = getValueFromArgs('last', args) ?? (await tag.findLastTag()));
  verbose(`[tag]: last tag found: ${last}`);

  if (!version || version.startsWith('-')) {
    const nameInfo = tag.name ? `${tag.name} ` : '';
    const lastInfo = last ? `(last version is ${last})` : '(no previous version found)';
    const tagFrom = await tag.findTagFrom();
    if (tagFrom) {
      version = tagFrom.from.replace(tagFrom.tag);
      log(`Found tag ${version} from previous ${tagFrom.from.name} tag: ${tagFrom.tag}`);
    } else {
      version = await askQuestion(`Enter new ${nameInfo}version ${lastInfo} with pattern: ${tag.pattern}\n`);
    }
  }

  // Step3: verify the version
  if (!tag.verify(version)) {
    throw new BumperError(`Version ${version} does not match the pattern ${tag.pattern}`);
  }

  if (cfg.process.checkTag) {
    if (!tag.sort.firstIsGreaterThanSecond(version, last)) {
      throw new BumperError(`Version ${version} is not greater than the last version ${last}`);
    }
  } else if (!getValueFromArgs('last', args) && version === last) {
    // if no user specific setting, check if the version is same as last
    last = await tag.updateLastTag(version);
  }

  // Step4: find the ticket
  let ticket = getValueFromArgs('ticket', args);
  if (cfg.process.wantedTicket && !ticket) {
    ticket = await askQuestion('Please provide the ticket number:\n');
  }

  return { version, ticket: ticket ?? '', tag, versionLast: last };
}

function getValueFromArgs(key: string, args: string[]): string | undefined {
  const alias = argsAliases[key];
  const index = args.findIndex((v) => {
    if (alias && (v === '-' + alias || v.startsWith('-' + alias + '='))) return true;
    return v === '--' + key || v.startsWith('--' + key + '=');
  });
  if (index === -1) return;

  const arg = args[index];
  if (arg?.includes('=')) return breaker(arg, 1, '=')[1];

  return args[index + 1];
}

function getBoolFromArgs(key: string, args: string[]): boolean | undefined {
  const alias = argsAliases[key];
  const index = args.findIndex((v) => {
    if (alias && (v === '-' + alias || v.startsWith('-' + alias + '='))) return true;
    return v === '--' + key || v === '--no-' + key;
  });
  if (index === -1) return undefined;

  const arg = args[index]!;
  if (arg.includes('=')) return breaker(arg, 1, '=')[1] !== 'false';

  return arg === '--' + key || arg === '-' + alias;
}

function getArrayFromArgs(key: string, args: string[]): string[] {
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

type ConfigArguments<T> = T extends ITemplate
  ? string
  : T extends Record<string, any> | undefined
    ? {
        [P in keyof T]?: ConfigArguments<T[P]>;
      }
    : string;
