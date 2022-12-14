import path from 'node:path';
import {
  breaker,
  git,
  parseMarkdown,
  readFile,
  startDebug,
  startVerbose,
} from './helper.js';
import { error, info } from './logger.js';

const DEFAULTS = {
  configFile: 'bumper.json',
  commit: {
    message: 'chore: bump to {version}',
  },
  prTemplate: `This PR is auto-generated from bumper

-   ticket: {ticket}
-   stage: {stage}
-   version: {version}
-   [diff]({diff})

{content}
`,
  changelog: {
    ticketPrefix: '單號：',
    header: `# Changelog

所有本專案的版本紀錄將於此說明之。

文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 內所描述的格式撰寫，版本號碼依照 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。`,
  },
  files: {
    changelog: 'CHANGELOG.md',
    latestVersion: 'docs/LATEST_VERSION.md',
    prTemplate: 'docs/PR_TEMPLATE.md',
    latestDeps: 'docs/LATEST_DEPS.md',
  },
};

export class Config {
  static #instance: Config;

  readonly files: FilesInfo;

  // ====== For bump version =======

  repoLink: string;
  readonly stage?: string;
  readonly prOnly: boolean;
  readonly releaseOnly: boolean;

  readonly commitInfo: CommitInfo;
  readonly changelogInfo: ChangelogInfo;
  readonly latestInfo: LatestInfo;
  readonly tagsInfo: TagsInfo;
  readonly prInfo: PRInfo;
  readonly releaseInfo: ReleaseInfo;

  readonly autoLinks: Record<string, string>;

  // ====== For bump deps =======

  readonly deps: DepsInfo;

  static get instance() {
    if (!this.#instance) {
      this.#instance = new Config(loadConfig());
    }

    return this.#instance;
  }

  static set instance(v: Config) {
    this.#instance = v;
  }

  constructor(config: Record<string, never>) {
    getBoolConfig('verbose') && startVerbose();
    getBoolConfig('debug') && startDebug();

    // ================ bump versions ================
    this.repoLink = getConfig('repo_link') ?? '';
    this.prOnly = getBoolConfig('pr_only');
    this.releaseOnly = getBoolConfig('release_only');

    this.commitInfo = getCommitInfo();
    this.changelogInfo = getChangelogInfo();
    this.files = getFilesInfo();
    this.tagsInfo = getTagsInfo();
    this.prInfo = getPRInfo();
    this.latestInfo = getLatestInfo(this.files.latestVersion);
    this.autoLinks = getAutoLinks();
    this.releaseInfo = getReleaseInfo();
    this.stage = getStage(this.latestInfo.version, this.tagsInfo);

    // ================ bump deps ===================

    const depsCfg: Record<string, never> = config['deps'] ?? {};
    const deps: Partial<DepsInfo> = {};
    deps.ignored = getListConfig('ignored', depsCfg, []);
    deps.output = getConfig('output', undefined, depsCfg);
    deps.appendOnly = getBoolConfig('append_only', undefined, depsCfg);
    deps.saveExact = getBoolConfig('use_exact', undefined, depsCfg);
    deps.latestDeps = getListConfig('latest_deps', depsCfg, []);
    deps.allLatest = deps.latestDeps.some((e) => e === '*');
    deps.preCommands = getListConfig('pre_commands', depsCfg, []);
    deps.postCommands = getListConfig('post_commands', depsCfg, []);
    deps.devInfo = getDevInfo(depsCfg, deps.preCommands, deps.postCommands);
    this.deps = deps as DepsInfo;

    // ================ helpers =====================

    function getCommitInfo() {
      const cm: Partial<CommitInfo> = config['commit'] ?? {};
      const df = DEFAULTS.commit;
      cm.noPush = getBoolConfig('commit_no_push', cm.noPush);
      cm.message = getConfig('commit_message', cm.message ?? df.message);
      return cm as CommitInfo;
    }

    function getChangelogInfo() {
      const ch: Partial<ChangelogInfo> = config['changelog'] ?? {};
      const df = DEFAULTS.changelog;
      ch.disable = getBoolConfig('changelog_disable', ch.disable);
      ch.ticketPrefix = getConfig(
        'changelog_ticket_prefix',
        ch.ticketPrefix ?? df.ticketPrefix,
      );
      ch.header = getConfig('changelog_header', ch.header ?? df.header);

      return ch as ChangelogInfo;
    }

    function getFilesInfo() {
      const fls: Partial<FilesInfo> = config['files'] ?? {};
      const df = DEFAULTS.files;
      fls.changelog = getConfig(
        'file_changelog',
        fls.changelog ?? df.changelog,
      );
      fls.latestVersion = getConfig(
        'file_latest_version',
        fls.latestVersion ?? df.latestVersion,
      );
      fls.prTemplate = getConfig(
        'file_pr_template',
        fls.prTemplate ?? df.prTemplate,
      );

      return fls as FilesInfo;
    }

    function getTagsInfo(): TagsInfo {
      let tags: TagsInfo = config['tags'] ?? {};

      const names = stf(getConfig('tag_names'));
      const patterns = stf(getConfig('tag_patterns'));
      const changelogs = stf(getConfig('tag_changelogs'));

      if (names && patterns) {
        tags = {};
        const ml = Math.min(names.length, patterns.length);
        for (let i = 0; i < ml; i++) {
          // @ts-expect-error Type 'undefined' cannot be used as an index type.
          tags[names[i]] = {
            pattern: patterns[i],
            changelog: changelogs ? Boolean(changelogs[i]) : false,
          };
        }
      }

      Object.entries(tags).forEach(([, tag]) => {
        tag.changelog ??= false;
      });

      return tags;
    }

    function getPRInfo(): PRInfo {
      const pr: Partial<PRInfo> = config['pr'] ?? {};
      pr.repo = getConfig('pr_repo', pr.repo);

      const names = stf(getConfig('branch_names'));
      const heads = stf(getConfig('branch_heads'));
      const bases = stf(getConfig('branch_bases'));
      const reviewers = stf(getConfig('branch_reviewers')) ?? [];
      const labels = stf(getConfig('branch_labels')) ?? [];

      if (names && bases) {
        // overwrite it! since env take higher procedure
        pr.branches = {};

        const ml = Math.min(names.length, bases.length);
        for (let i = 0; i < ml; i++) {
          const b: Partial<BaseBranchInfo> = {
            head: heads[i],
            base: bases[i],
            reviewers: stf(reviewers[i], '/'),
            labels: stf(labels[i], ' '),
          };

          // @ts-expect-error Type 'undefined' cannot be used as an index type.
          pr.branches[names[i]] = b;
        }
      }

      if (pr.branches) {
        Object.entries(pr.branches).forEach(([k, meta]) => {
          meta.name = k;
          meta.head ??= `deploy/${k}`;
          meta.reviewers ??= [];
          meta.labels ??= [];
          meta.siblings ??= {};

          Object.entries(meta.siblings).forEach(([k, s]) => {
            s.name = k;
            s.base ??= meta.base;
            s.head ??= meta.head;
            s.labels ??= meta.labels;
            s.reviewers ??= meta.reviewers;
          });
        });
      } else {
        pr.branches = {};
      }

      return pr as PRInfo;
    }

    function getLatestInfo(file: string): LatestInfo {
      const [fMeta, fBody] = parseMarkdown(file);
      const version = getConfig('latest_version') ?? fMeta?.version ?? '';
      const ticket = getConfig('latest_ticket') ?? fMeta?.ticket;
      const body = getConfig('latest_content') ?? fBody;

      return { version, ticket, body };
    }

    function getAutoLinks(): Record<string, string> {
      const result: Record<string, string> = {};
      let autoLinks: Record<string, string> = config['autoLinks'] ?? {};
      if (getConfig('auto_link_keys') && getConfig('auto_link_values')) {
        autoLinks = {};
        const keys = stf(getConfig('auto_link_keys')) as string[];
        const values = stf(getConfig('auto_link_values')) as string[];
        for (let i = 0, l = Math.min(keys.length, values.length); i < l; i++) {
          autoLinks[`${keys[i]}`] = `${values[i]}`;
        }
      }

      Object.entries(autoLinks).forEach((e) => {
        const allowed = /[a-zA-Z\-]+/.test(e[0]);
        if (!allowed) {
          error(
            `The key of auto link (${e[0]}) should not contains other character beside alphabet, dash(-)`,
          );
          return;
        }
        result[e[0]] = e[1];
      });

      return result;
    }

    function getReleaseInfo(): ReleaseInfo {
      const info: Partial<ReleaseInfo> = config['release'] ?? {};
      info.preRelease = getBoolConfig('release_pre', info.preRelease);
      info.draft = getBoolConfig('release_draft', info.draft);

      return info as ReleaseInfo;
    }

    function getStage(v: string, tags: TagsInfo): string | undefined {
      const stage = getConfig('stage');
      if (stage && tags[stage]) return stage;

      const hit = Object.entries(tags).find((e) => {
        if (!e[1].pattern) return;

        return new RegExp(e[1].pattern).test(v);
      });

      return hit ? hit[0] : hit;
    }

    function getDevInfo(
      deps: Record<string, never>,
      pre: Commands,
      post: Commands,
    ) {
      const dev: Partial<DevInfo> = deps['dev'] ?? {};
      const d = dev as Record<string, never>;

      dev.oneByOne = getBoolConfig('one_by_one', undefined, d);
      dev.preCommands = getListConfig('pre_commands', d) ?? pre;
      dev.postCommands = getListConfig('post_commands', d) ?? post;

      return dev as DevInfo;
    }

    function getConfig<T>(
      key: string,
      other?: T,
      cfg?: Record<string, never>,
    ): T extends string ? string : string | undefined {
      const k = underLine2Camel(key);

      cfg ??= config;
      const result =
        process.env['BUMPER_' + key.toUpperCase()] ??
        getOptionFromArgs(k) ??
        (cfg[k] ? String(cfg[k]) : undefined) ??
        other;

      return result as never;
    }

    function getListConfig(
      key: string,
      cfg: Record<string, never>,
      other?: string[],
    ): string[] {
      return stf(getConfig(key)) ?? cfg[underLine2Camel(key)] ?? other;
    }

    function getBoolConfig(
      key: string,
      other = false,
      cfg?: Record<string, never>,
    ): boolean {
      if (process.env['BUMPER_' + key.toUpperCase()]) return true;

      const k = underLine2Camel(key);
      if (process.argv.indexOf('--' + k) !== -1) return true;

      cfg ??= config;
      return cfg[k] === undefined ? other : Boolean(cfg[k]);
    }
  }

  async init(command: AllowedCommand) {
    if (command === 'version') {
      if (!this.repoLink) {
        // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'string'.
        const repoUrl = await git(true, 'remote', 'get-url', 'origin');
        const [rawVendor, rawRepoName] = breaker(repoUrl, 1, ':');
        const vendor = rawVendor?.split('@')[1] ?? 'github.com';
        const repoName = rawRepoName?.split('.')[0] ?? 'example/example';
        this.repoLink = `https://${vendor}/${repoName}`;
      }

      if (!this.prInfo.repo) {
        this.prInfo.repo =
          breaker(this.repoLink, 3, '/')[3] ?? 'example/example';
      }
    }

    this.verify(command);

    info(JSON.stringify(this, undefined, 2));

    return this;
  }

  verify(command: AllowedCommand) {
    if (command === 'version') {
      if (!this.latestInfo.version) {
        throw new Error(`Missing required 'latestVersion' in config`);
      }

      for (const tag of Object.values(this.tagsInfo)) {
        if (!tag.pattern) {
          throw new Error('Required `pattern` in tags config');
        }
      }

      for (const [key, meta] of Object.entries(this.prInfo.branches)) {
        if (!this.tagsInfo[key]) {
          throw new Error(
            `Missing ${key} in tags config, PR.branches should mappable to tags' keys`,
          );
        }
        if (!meta.base) {
          throw new Error('Required `base` in PR.branches config');
        }
      }
    }
  }

  get tag(): TagInfo | undefined {
    if (!this.stage) return;
    return this.tagsInfo[this.stage];
  }

  get branch(): BranchInfo | undefined {
    if (!this.stage) return;
    return this.prInfo.branches[this.stage];
  }

  get changelog(): string {
    return readFile(this.files.changelog);
  }

  get prTemplate(): string {
    const temp = readFile(this.files.prTemplate);
    return temp ? temp : DEFAULTS.prTemplate;
  }
}

function getOptionFromArgs(key: string): string | undefined {
  const index = process.argv.findIndex((v) => {
    return v === '--' + key || v.startsWith('--' + key + '=');
  });
  if (index === -1) return;

  const arg = process.argv[index];
  if (arg && arg.includes('=')) return breaker(arg, 1, '=')[1];

  const value = process.argv[index + 1];
  if (!value || value.startsWith('-')) return;

  return value;
}

function loadConfig() {
  const name =
    process.env['BUMPER_CONFIG'] ??
    getOptionFromArgs('config') ??
    DEFAULTS.configFile;

  info(`Start loading config from ${path.resolve(name)}`);
  const content = readFile(path.resolve(name));
  if (!content) return {};

  try {
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

function stf<T>(
  a?: T,
  delimiter = ',',
): T extends string ? string[] : undefined {
  return (
    typeof a === 'string' ? a.split(delimiter).map((e) => e.trim()) : undefined
  ) as never;
}

function underLine2Camel(key: string) {
  return key
    .split('_')
    .map((v, i) => (i === 0 ? v : v.charAt(0).toUpperCase() + v.slice(1)))
    .join('');
}

type TagInfo = {
  pattern: string;
  changelog: boolean;
};
export type BaseBranchInfo = {
  name: string;
  head: string;
  base: string;
  labels: string[];
  reviewers: string[];
};
type BranchInfo = BaseBranchInfo & {
  siblings: Record<string, BaseBranchInfo>;
};
type ChangelogInfo = {
  disable: boolean;
  ticketPrefix: string;
  header: string;
};
type FilesInfo = {
  changelog: string;
  latestVersion: string;
  prTemplate: string;
};
type PRInfo = { repo: string; branches: Record<string, BranchInfo> };
type TagsInfo = Record<string, TagInfo>;
type CommitInfo = { message: string; noPush: boolean };
type LatestInfo = { version: string; body: string; ticket?: string };
type DevInfo = {
  oneByOne: boolean;
  preCommands: Commands;
  postCommands: Commands;
};
type AllowedCommand = 'version' | 'deps';
type Commands = string[] | string[][];
type DepsInfo = {
  ignored: string[];
  output?: string;
  appendOnly: boolean;
  saveExact: boolean;
  allLatest: boolean;
  latestDeps: string[];
  devInfo: DevInfo;
  preCommands: Commands;
  postCommands: Commands;
};
type ReleaseInfo = { preRelease: boolean; draft: boolean };
