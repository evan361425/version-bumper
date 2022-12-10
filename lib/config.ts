import path from 'node:path';
import { breaker, git, parseMarkdown, readFile, startDebug } from './helper.js';
import { info } from './logger.js';

const DEFAULTS = {
  configFile: 'bumper.json',
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
  },
};

export class Config {
  static #instance: Config;

  repoLink: string;
  readonly stage?: string;
  readonly prOnly: boolean;

  readonly files: FilesInfo;
  readonly commitInfo: CommitInfo;
  readonly changelogInfo: ChangelogInfo;
  readonly latestInfo: LatestInfo;
  readonly prInfo: PRInfo;

  readonly autoLinks: Record<string, string>;

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
    getBoolConfig('debug') && startDebug();

    this.repoLink = getConfig('repo_link') ?? '';
    this.prOnly = getBoolConfig('pr_only');

    this.commitInfo = getCommitInfo();
    this.changelogInfo = getChangelogInfo();
    this.files = getFilesInfo();
    this.prInfo = gitPRInfo();
    this.latestInfo = getLatestInfo(this.files.latestVersion);

    this.autoLinks = getAutoLinks();

    this.stage = getStage(this.latestInfo.version, this.prInfo);

    // ================ helpers =====================

    function getCommitInfo() {
      const cm: Partial<CommitInfo> = config['commit'] ?? {};
      cm.noPush ??= getBoolConfig('commit_no_push');
      cm.message ??= getConfig('commit_message', 'chore: bump to {version}');
      return cm as CommitInfo;
    }

    function getChangelogInfo() {
      const ch: Partial<ChangelogInfo> = config['changelog'] ?? {};
      const df = DEFAULTS.changelog;
      ch.disable ??= getBoolConfig('changelog_disable');
      ch.ticketPrefix ??= getConfig('changelog_ticket_prefix', df.ticketPrefix);
      ch.header ??= getConfig('changelog_header', df.header);

      return ch as ChangelogInfo;
    }

    function getFilesInfo() {
      const fls: Partial<FilesInfo> = config['files'] ?? {};
      const df = DEFAULTS.files;
      fls.changelog ??= getConfig('file_changelog', df.changelog);
      fls.latestVersion ??= getConfig('file_latest_version', df.latestVersion);
      fls.prTemplate ??= getConfig('file_pr_template', df.prTemplate);

      return fls as FilesInfo;
    }

    function gitPRInfo(): PRInfo {
      const pr: Partial<PRInfo> = config['pr'] ?? {};
      pr.repo = getConfig('pr_repo', '');

      const names = stf(getConfig('branch_names'));
      const patterns = stf(getConfig('branch_patterns'));
      const changelogs = stf(getConfig('branch_changelog')) ?? [];
      const heads = stf(getConfig('branch_heads'));
      const bases = stf(getConfig('branch_bases'));
      const reviewers = stf(getConfig('branch_reviewers')) ?? [];
      const labels = stf(getConfig('branch_labels')) ?? [];

      if (names && patterns && bases) {
        // overwrite it! since env take higher procedure
        if (pr.branches) pr.branches = {};

        const ml = Math.min(names.length, patterns.length, bases.length);
        for (let i = 0; i < ml; i++) {
          // @ts-expect-error Type 'undefined' cannot be used as an index type.
          pr.branches[names[i]] = {
            patterns: patterns[i],
            changelogs: changelogs[i] ?? false,
            head: heads[i],
            base: bases[i],
            reviewers: stf(reviewers[i], '/'),
            labels: stf(labels[i], ' '),
          };
        }
      }

      if (pr.branches) {
        Object.entries(pr.branches).forEach(([k, meta]) => {
          if (!meta.base || !meta.pattern) {
            throw new Error('每個 PR 的 Branch 都必須要有 `base` 和 `pattern`');
          }

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
      const version = getConfig('latest_version') ?? fMeta?.version;
      const ticket = getConfig('latest_ticket') ?? fMeta?.ticket;
      const body = getConfig('latest_content') ?? fBody;

      if (!version) {
        throw new Error(`Missing required 'latestVersion' in config`);
      }

      return { version, ticket, body };
    }

    function getAutoLinks(): Record<string, string> {
      const result: Record<string, string> = {};
      const autoLinks: Record<string, string> = config['autoLinks'] ?? {};
      if (getConfig('auto_link_keys') && getConfig('auto_link_values')) {
        const keys = stf(getConfig('auto_link_keys')) as string[];
        const values = stf(getConfig('auto_link_values')) as string[];
        for (let i = 0, l = Math.min(keys.length, values.length); i < l; i++) {
          autoLinks[`${keys[i]}`] = `${values[i]}`;
        }
      }

      Object.entries(autoLinks).forEach((e) => {
        const allowed = /[a-zA-Z\-]+/.test(e[0]);
        if (!allowed) {
          throw new Error(
            `The key of auto link (${e[0]}) should not contains other character beside alphabet, dash(-)`
          );
        }
        result[e[0]] = e[1];
      });

      return result;
    }

    function getStage(v: string, pr: PRInfo): string | undefined {
      const stage = getConfig('stage');
      if (stage && pr.branches[stage]) return stage;

      const hit = Object.entries(pr.branches).find((e) => {
        if (!e[1].pattern) return;

        return new RegExp(e[1].pattern).test(v);
      });

      return hit ? hit[0] : hit;
    }

    function getConfig<T>(
      key: string,
      other?: T
    ): T extends string ? string : string | undefined {
      const k = key
        .split('_')
        .map((v, i) => (i === 0 ? v : v.charAt(0).toUpperCase() + v.slice(1)))
        .join('');

      const result =
        process.env['BUMPER_' + key.toUpperCase()] ??
        getOptionFromArgs(k) ??
        (config[k] ? String(config[k]) : undefined) ??
        other;

      return result as never;
    }

    function getBoolConfig(key: string): boolean {
      if (process.env['BUMPER_' + key.toUpperCase()]) return true;

      const k = key
        .split('_')
        .map((v, i) => (i === 0 ? v : v.charAt(0).toUpperCase() + v.slice(1)))
        .join('');
      if (process.argv.indexOf('--' + k) !== -1) return true;

      return config[k] === undefined ? false : Boolean(config[k]);
    }
  }

  async init() {
    if (!this.repoLink) {
      // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'string'.
      const repoUrl = await git(true, 'remote', 'get-url', 'origin');
      const [rawVendor, rawRepoName] = breaker(repoUrl, 1, ':');
      const vendor = rawVendor?.split('@')[1] ?? 'github.com';
      const repoName = rawRepoName?.split('.')[0] ?? 'example/example';
      this.repoLink = `https://${vendor}/${repoName}`;
    }

    if (!this.prInfo.repo) {
      this.prInfo.repo = breaker(this.repoLink, 3, '/')[3] ?? 'example/example';
    }

    info(JSON.stringify(this, undefined, 2));
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
  const index = process.argv.indexOf('--' + key);
  if (index === -1) return;

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
  delimiter = ','
): T extends string ? string[] : undefined {
  return (
    typeof a === 'string' ? a.split(delimiter).map((e) => e.trim()) : undefined
  ) as never;
}

export type BaseBranchInfo = {
  name: string;
  head: string;
  base: string;
  labels: string[];
  reviewers: string[];
};
type BranchInfo = BaseBranchInfo & {
  pattern: string;
  changelog: boolean;
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
type CommitInfo = { message: string; noPush: boolean };
type LatestInfo = { version: string; body: string; ticket?: string };
