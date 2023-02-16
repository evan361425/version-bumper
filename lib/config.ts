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
  pr: {
    title: '{ticket} - {version}({stage})',
    template: `This PR is auto-generated from bumper

- ticket: {ticket}
- stage: {stage}
- version: {version}
- [diff]({diff})

{content}
`,
  },
  changelog: {
    file: 'CHANGELOG.md',
    commitMessage:
      'chore: bump to {version}\n\nticket: {ticket}\nstage: {stage}',
    template: '單號: {ticket}\n\n{content}',
    header: `# Changelog

所有本專案的版本紀錄將於此說明之。

文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 內所描述的格式撰寫，版本號碼依照 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。`,
  },
  latestInfo: {
    file: 'docs/LATEST_VERSION.md',
  },
};

export class Config {
  static #instance: Config;

  // ====== For bump version =======

  repoLink: string;
  readonly stage?: string;
  readonly prOnly: boolean;
  readonly releaseOnly: boolean;
  readonly noPush: boolean;

  readonly changelogInfo: ChangelogInfo;
  readonly latestInfo: LatestInfo;
  readonly tagsInfo: TagsInfo;
  readonly prInfo: PRInfo;

  readonly autoLinks: Record<string, string>;

  readonly beforeScripts: string[] | string[][];

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
    getBoolConfig('verbose', false, undefined, ['v']) && startVerbose();
    getBoolConfig('debug', false, undefined, ['d']) && startDebug();

    // ================ bump versions ================
    this.repoLink = getConfig('repo_link') ?? '';
    this.prOnly = getBoolConfig('pr_only');
    this.releaseOnly = getBoolConfig('release_only');
    this.noPush = getBoolConfig('no_push');

    this.changelogInfo = getChangelogInfo();
    this.tagsInfo = getTagsInfo();
    this.prInfo = getPRInfo();
    this.latestInfo = getLatestInfo();
    this.autoLinks = getAutoLinks();
    this.beforeScripts = getBeforeScripts();

    this.stage = getStage(this.latestInfo.version, this.tagsInfo);

    // ================ bump deps ===================

    const depsCfg: Record<string, never> = config['deps'] ?? {};
    const deps: Partial<DepsInfo> = {};
    deps.ignored = getListConfig('ignored', depsCfg, []);
    deps.outputFile = getConfig('output_file', undefined, depsCfg);
    deps.appendOnly = getBoolConfig('append_only', undefined, depsCfg);
    deps.saveExact = getBoolConfig('use_exact', undefined, depsCfg);
    deps.latestDeps = getListConfig('latest_deps', depsCfg, []);
    deps.allLatest = deps.latestDeps.some((e) => e === '*');
    deps.preCommands = getListConfig('pre_commands', depsCfg, []);
    deps.postCommands = getListConfig('post_commands', depsCfg, []);
    deps.devInfo = getDevInfo(depsCfg, deps.preCommands, deps.postCommands);
    this.deps = deps as DepsInfo;

    // ================ helpers =====================

    function getChangelogInfo() {
      const ch: Partial<ChangelogInfo> = config['changelog'] ?? {};
      const d = DEFAULTS.changelog;
      ch.commitMessage = getConfig(
        'changelog_commit_message',
        ch.commitMessage ?? d.commitMessage,
      );
      ch.disable = getBoolConfig('changelog_disable', ch.disable);
      ch.file = getConfig('changelog_file', ch.file ?? d.file);
      ch.header = getConfig('changelog_header', ch.header ?? d.header);
      ch.template = getConfig('changelog_template', ch.template ?? d.template);

      return ch as ChangelogInfo;
    }

    function getTagsInfo(): TagsInfo {
      let tags: TagsInfo = config['tags'] ?? {};

      const names = stf(getConfig('tag_names'));
      const patterns = stf(getConfig('tag_patterns'));
      const changelog = getBoolConfig('tag_changelog');

      if (names && patterns) {
        tags = {};
        const ml = Math.min(names.length, patterns.length);
        for (let i = 0; i < ml; i++) {
          // @ts-expect-error Type 'undefined' cannot be used as an index type.
          tags[names[i]] = {
            pattern: patterns[i],
          };
        }
      }

      Object.entries(tags).forEach(([, tag]) => {
        tag.changelog ??= changelog;
        tag.packageJson ??= getBoolConfig('tag_package_json');
        tag.release = getReleaseInfo(tag);
      });

      return tags;
    }

    function getPRInfo(): PRInfo {
      const pr: Partial<PRInfo> = config['pr'] ?? {};
      const d = DEFAULTS.pr;

      const file = getConfig('pr_template_file', pr.templateFile);
      let dTemplate = d.template;
      if (file) {
        const content = readFile(file);
        dTemplate = content ? content : dTemplate;
      }

      pr.repo = getConfig('pr_repo', pr.repo);
      pr.template = getConfig('pr_template', pr.template ?? dTemplate);
      pr.title = getConfig('pr_title', pr.title ?? d.title);

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

    function getLatestInfo(): LatestInfo {
      const li: Partial<LatestInfo> = config['latestInfo'] ?? {};

      li.diff ??= { enable: false, allowed: [], ignored: [] };
      li.diff.enable =
        getBoolConfig('latest_diff_enable') ||
        (!getConfig('latest_content') && li.diff.enable);
      li.diff.allowed = getListConfig(
        'latest_diff_allowed',
        {},
        li.diff.allowed ?? [],
      );
      li.diff.ignored = getListConfig(
        'latest_diff_ignored',
        {},
        li.diff.ignored ?? [],
      );

      li.file = getConfig('latest_file', DEFAULTS.latestInfo.file);
      const [fMeta, fBody] = li.file ? parseMarkdown(li.file) : [];

      li.version = getConfig('latest_version') ?? li.version ?? fMeta?.version;
      li.ticket = getConfig('latest_ticket') ?? li.ticket ?? fMeta?.ticket;
      li.content = getConfig('latest_content') ?? li.content ?? fBody;

      return li as LatestInfo;
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

    function getBeforeScripts(): string[] {
      return config['beforeScripts'] ?? [];
    }

    function getReleaseInfo(data: { release?: unknown }): ReleaseInfo {
      const info: Partial<ReleaseInfo> = data['release'] ?? {};
      info.enable = getBoolConfig('release_enable', info.enable);
      info.title = getConfig('release_title', info.title);
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
      dev.preCommands = dev.preCommands ?? pre;
      dev.postCommands = dev.postCommands ?? post;

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
      aliases?: string[],
    ): boolean {
      if (process.env['BUMPER_' + key.toUpperCase()]) return true;

      const k = underLine2Camel(key);
      if (process.argv.indexOf('--' + k) !== -1) return true;
      if (aliases !== undefined) {
        for (const alias of aliases) {
          if (process.argv.indexOf('-' + alias) !== -1) return true;
        }
      }

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

      if (this.latestInfo.diff.enable) {
        // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'string'.
        const t = (await git(true, 'describe', '--abbrev=0')).trim();
        // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'string'.
        const d = await git(true, 'log', '--pretty=%H "%an" %s', `HEAD...${t}`);

        const commits = d
          .split('\n')
          .map((e) => {
            const [hash, rest] = breaker(e.trim(), 1, ' "');
            if (!hash || !rest) return;
            const [name, title] = breaker(rest, 1, '" ');

            return name && title ? [hash, name, title] : undefined;
          })
          .filter((e) => {
            if (!e) return;

            const title = e[2] ?? '';
            const igs = this.latestInfo.diff.ignored;
            if (igs.some((ig) => title.startsWith(ig))) {
              return;
            }
            const als = this.latestInfo.diff.allowed;
            return als.length ? als.some((al) => title.startsWith(al)) : true;
          })
          .map((e) => {
            const [hash, name, title] = e as [string, string, string];
            const h = hash.substring(0, 7);
            const l = `${this.repoLink}/commit/${hash}`;
            return `-   ([${h}](${l})) ${title} - ${name}`;
          }) as string[];

        if (commits.length) {
          this.latestInfo.content = commits.join('\n');
        }
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
    return readFile(this.changelogInfo.file);
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
  if (!value) return;

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
  packageJson: boolean;
  release: ReleaseInfo;
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
  file: string;
  template: string;
  header: string;
  commitMessage: string;
};
type PRInfo = {
  repo: string;
  title: string;
  template: string;
  templateFile: string;
  branches: Record<string, BranchInfo>;
};
type TagsInfo = Record<string, TagInfo>;
type LatestInfo = {
  version: string;
  content: string;
  ticket?: string;
  file: string;
  diff: {
    enable: boolean;
    allowed: string[];
    ignored: string[];
  };
};
type DevInfo = {
  oneByOne: boolean;
  preCommands: Commands;
  postCommands: Commands;
};
type AllowedCommand = 'version' | 'deps';
type Commands = string[] | string[][];
type DepsInfo = {
  ignored: string[];
  outputFile?: string;
  appendOnly: boolean;
  saveExact: boolean;
  allLatest: boolean;
  latestDeps: string[];
  devInfo: DevInfo;
  preCommands: Commands;
  postCommands: Commands;
};
export type ReleaseInfo = {
  enable: boolean;
  title?: string;
  preRelease: boolean;
  draft: boolean;
};
