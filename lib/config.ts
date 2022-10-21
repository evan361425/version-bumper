import path from 'node:path';
import { breaker, git, parseMarkdown, readFile, startDebug } from './helper.js';
import { info } from './logger.js';

type BranchInfo = {
  head: string;
  base: string;
  reviewers: string[];
  versionPattern?: string;
  labels: string[];
};

type Branches = Record<string, BranchInfo>;

type ChangelogInfo = {
  disable: boolean;
  ticketPrefix: string;
  header: string;
};

type FileInfo = {
  changelog: string;
  latestVersion: string;
  prTemplate: string;
};

type LatestInfo = { version: string; body: string; ticket?: string };

export class Config {
  static #instance: Config;
  repoLink: string;
  prRepo: string;
  readonly commitMessage: string;
  readonly baseBranch: string;
  readonly prodOtherPr?: string;
  readonly productionName: string;
  readonly stage: string;
  readonly prOnly: boolean;
  readonly changelogInfo: ChangelogInfo;
  readonly files: FileInfo;
  readonly latestInfo: LatestInfo;
  readonly autoLinks: Record<string, string>;
  readonly branches: Branches;

  static get instance() {
    if (!this.#instance) {
      this.#instance = new Config(loadConfig());
    }

    return this.#instance;
  }

  constructor(config: Record<string, never>) {
    getBoolConfig('debug') && startDebug();

    this.repoLink = getConfig('repo_link') ?? '';
    this.prRepo = getConfig('pr_repo') ?? '';
    this.commitMessage = getConfig(
      'commit_message',
      'chore: bump to <version>'
    );
    this.baseBranch = getConfig('base_branch', 'main');
    this.prodOtherPr = getConfig('prod_other_pr');
    this.prOnly = getBoolConfig('pr_only');
    this.productionName = getConfig('production_name', 'production');

    const ch: Partial<ChangelogInfo> = config['changelog'] ?? {};
    ch.disable ??= getBoolConfig('changelog_disable');
    ch.ticketPrefix ??= getConfig('changelog_ticket_prefix', '單號：');
    ch.header ??= getConfig(
      'changelog_header',
      '# Changelog\n\n所有本專案的版本紀錄將於此說明之\n\n' +
        '文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) ' +
        '內所描述的格式撰寫，版本號碼依照 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。'
    );

    this.changelogInfo = ch as ChangelogInfo;

    const fls: Partial<FileInfo> = config['files'] ?? {};
    fls.changelog ??= getConfig('file_changelog', 'CHANGELOG.md');
    fls.latestVersion ??= getConfig(
      'file_latest_version',
      'docs/LATEST_VERSION.md'
    );
    fls.prTemplate ??= getConfig('file_pr_template', 'docs/PR_TEMPLATE.md');
    this.files = fls as FileInfo;

    this.latestInfo = getLatestInfo(this.files.latestVersion);
    this.autoLinks = getAutoLinks();
    this.branches = getBranches(this.baseBranch);

    this.stage =
      getConfig('stage') ??
      getStageFrom(this.latestInfo.version, this.branches) ??
      this.baseBranch;

    // ================ helpers =====================

    function getLatestInfo(file: string): LatestInfo {
      const [fMeta, fBody] = parseMarkdown(file);
      const version = getConfig('latest_version') ?? fMeta?.version;
      const ticket = getConfig('latest_ticket') ?? fMeta?.ticket;
      const body = getConfig('latest_content') ?? fBody;

      if (!version) {
        throw new Error(`Missing required 'version' in config`);
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

    function getBranches(fallbackBaseBranch: string): Branches {
      const branches: Record<string, Partial<BranchInfo>> = config[
        'branches'
      ] ?? {};
      const names = stf(getConfig('branch_names', 'staging,production'));
      const heads = stf(
        getConfig('branch_heads', 'deploy/staging,deploy/production')
      );
      const bases = stf(
        getConfig('branch_bases', 'deploy/develop,deploy/staging')
      );
      const reviewers = stf(getConfig('branch_reviewers')) ?? [];
      const patterns = stf(getConfig('branch_patterns')) ?? [];
      const labels = stf(getConfig('branch_labels')) ?? [];

      names.forEach((n, i) => {
        const ori = branches[n];
        branches[n] = {
          head: ori?.head ?? heads[i],
          base: ori?.base ?? bases[i],
          reviewers: ori?.reviewers ?? stf(reviewers[i], '/'),
          versionPattern: ori?.versionPattern ?? patterns[i],
          labels: ori?.labels ?? stf(labels[i], ' '),
        };
      });

      Object.entries(branches).forEach(([k, meta]) => {
        meta.head ??= `deploy/${k}`;
        meta.base ??= fallbackBaseBranch;
        meta.reviewers ??= [];
        meta.labels ??= [];
      });

      return branches as Branches;
    }

    function getStageFrom(v: string, branches: Branches): string | undefined {
      const hit = Object.entries(branches).find((e) => {
        if (!e[1].versionPattern) return;

        if (new RegExp(e[1].versionPattern).test(v)) return true;

        return;
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

    if (!this.prRepo) {
      this.prRepo = breaker(this.repoLink, 3, '/')[3] ?? 'example/example';
    }

    info(JSON.stringify(this));
  }

  get isProduction() {
    return this.stage === this.productionName;
  }

  get isNotProduction() {
    return !this.isProduction;
  }

  branchBy(stage: string | null): BranchInfo {
    return (
      this.branches[stage ?? this.stage] ?? {
        base: this.baseBranch,
        head: `deploy/${stage}`,
        reviewers: [],
        labels: [],
      }
    );
  }

  get changelog(): string {
    return readFile(this.files.changelog);
  }

  get prTemplate(): string {
    const temp = readFile(this.files.prTemplate);
    return temp ? temp : 'This PR is auto-generated from bumper';
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
    'bumper.json';

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
