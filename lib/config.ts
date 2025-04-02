import { ChangelogIO } from './changelog.js';
import { command } from './command.js';
import { askForWantedVars } from './config-loader.js';
import { BumperError } from './errors.js';
import {
  AutoLink,
  Changelog,
  ChangelogTemplate,
  ContentTemplate,
  Diff,
  Hook,
  PR,
  Repo,
  Tag,
  VersionedTemplate,
} from './factories.js';
import { GitDatabase } from './git.js';
import { DeepPartial, IConfig, IDiffGroup, IProcess, ITag } from './interfaces.js';
import { isDebug } from './io.js';
import { breaker } from './util.js';

export const DEFAULTS: IConfig = {
  repo: { link: '' },
  process: {
    bump: true,
    push: true,
    pr: true,
    release: true,
    checkTag: true,
    checkRemoteTag: false,
    wantedTicket: false,
    diffFromChangelog: false,
    useSemanticGroups: true,
    useSemanticTag: true,
    useReleaseCandidateTag: false,
    askToVerifyContent: true,
    askToChooseTag: false,
  },
  hook: {
    afterVerified: [],
    afterAll: [],
  },
  changelog: {
    enable: true,
    destination: 'CHANGELOG.md',
    section: {
      value: '[{version}] - {date}\n\n{Ticket: "ticket"<NL><NL>}{content}',
    },
    commit: {
      message: {
        value: 'chore: bump to {version}',
      },
      addAll: true,
    },
  },
  autoLinks: [],
  pr: {
    base: 'main',
    headFrom: 'main',
    head: 'bump-version',
    title: {
      value: '{"ticket" - }Bump version {version}',
    },
    body: {
      value: `This PR is auto-generated from [bumper](https://github.com/evan361425/version-bumper).
{<NL>- ticket: "ticket"}
- version: [{version}]({repo}/releases/tag/{version})
- [{versionLast} - {version}]({diffLink})

{content}
`,
    },
  },
  diff: {
    groups: [],
    item: {
      value: `- ({#"prLink.prefixInLink"|hashLink}{|"autoLink"}) {"scope": }{title}{ - @"author"}`,
    },
    scopeNames: {},
    ignored: [],
    othersTitle: 'Others',
    ignoreOthers: true,
  },
  tags: [],
};
const SEMANTIC_GROUPS: IDiffGroup[] = [
  { matches: ['^fix'], title: 'Fixed', priority: 0 },
  { matches: ['^feat', '^add'], title: 'Added', priority: 0 },
  { matches: ['^[\w\(\)]+!', 'BREAKING CHANGE'], title: 'Changed', priority: 1 },
];
const SEMANTIC_TAG: ITag = {
  name: 'semantic',
  pattern: '^v\\d+\\.\\d+\\.\\d+$',
  from: [],
  prs: [],
  release: {
    enable: true,
    draft: false,
    preRelease: false,
  },
  withChangelog: true,
  sort: {
    separator: '.',
    fields: ['1,1', '2,2', '3,3'],
  },
};
const RELEASE_CANDIDATE_TAG: ITag = {
  name: 'release-candidate',
  pattern: '^v\\d+\\.\\d+\\.\\d+-rc\\.\\d+$',
  prs: [],
  release: { enable: false },
  withChangelog: false,
  sort: {
    separator: '.',
    fields: ['1,1', '2,2', '3,3', '4.4'],
  },
};

export class Config {
  #tag!: Tag;
  version!: string;
  versionLast!: string;
  ticket!: string;

  readonly process: Required<IProcess>;
  readonly hook: Hook;
  readonly repo: Repo;
  readonly changelog: Changelog;
  readonly pr: PR;
  readonly diff: Diff;
  readonly autoLinks: AutoLink[];
  readonly tags: Tag[];
  readonly git: GitDatabase;

  /**
   * @param others Fallback options, the later one will override the previous one.
   */
  constructor(...others: DeepPartial<IConfig>[]) {
    const cfg: IConfig = JSON.parse(JSON.stringify(DEFAULTS));
    for (const o of others) {
      softMerge(cfg as Record<string, unknown>, o as Record<string, unknown>);
    }

    if (cfg.process!.useSemanticGroups) {
      cfg.diff!.groups = cfg.diff!.groups!.concat(SEMANTIC_GROUPS);
    }
    if (cfg.process!.useSemanticTag) {
      if (cfg.process!.useReleaseCandidateTag) {
        SEMANTIC_TAG.from?.push({
          name: RELEASE_CANDIDATE_TAG.name,
          replaceFrom: '^(v\\d+\\.\\d+\\.\\d+)-rc\\.\\d+$',
          replaceTo: '$1',
        });
      }

      cfg.tags!.push(SEMANTIC_TAG);
    }
    if (cfg.process!.useReleaseCandidateTag) {
      cfg.tags!.push(RELEASE_CANDIDATE_TAG);
    }

    // combine tags
    const tags: Record<string, ITag[]> = {};
    for (const tag of cfg.tags!) {
      (tags[tag.name ?? ''] ??= []).push(tag);
    }

    this.process = cfg.process! as Required<IProcess>;
    this.hook = Hook.fromCfg(cfg.hook!);
    this.repo = Repo.fromCfg(cfg.repo!);
    this.changelog = Changelog.fromCfg(cfg.changelog!);
    this.autoLinks = cfg.autoLinks!.map((a) => AutoLink.fromCfg(a));
    this.pr = PR.fromCfg(cfg.pr!);
    this.diff = Diff.fromCfg(cfg.diff!, this.autoLinks);
    this.tags = combineTags(tags)
      .map((t) => Tag.fromCfg(t, this.pr))
      .filter(Boolean) as Tag[];
    this.git = new GitDatabase(this.repo.name);
  }

  get tag(): Tag {
    return this.#tag;
  }

  set tag(tag: Tag) {
    this.#tag = tag;
  }

  /**
   * Get the last tag diff link.
   *
   * It must call after `askForWantedVars` for last tag fetching.
   */
  get diffLink(): string {
    return this.repo.compareLink({ from: this.#tag.lastTag, to: this.version });
  }

  get versionTemplate(): VersionedTemplate {
    return {
      repo: this.repo.link,
      version: this.version,
      versionName: this.#tag.name,
      versionLast: this.versionLast,
      ticket: this.ticket,
    };
  }

  get contentTemplate(): ContentTemplate {
    return {
      ...this.versionTemplate,
      diffLink: this.diffLink,
      content: this.diff.content,
    };
  }

  get changelogTemplate(): ChangelogTemplate {
    const date = new Date().toISOString().split('T')[0]!;
    const time = new Date().toISOString().split('T')[1]!.split('.')[0]!;

    return {
      ...this.contentTemplate,
      date,
      time,
    };
  }

  async init(args: string[]): Promise<void> {
    await this.initRepo();
    await this.initVars(args);
  }

  injectAutoLinks(content: string): string {
    for (const autoLink of this.autoLinks) {
      content = autoLink.inject(content);
    }
    return content;
  }

  async bumpChangelog(): Promise<void> {
    function getDebugDefaultPath(path: string) {
      const idx = path.lastIndexOf('.');
      return idx === -1 ? path + '.debug' : path.slice(0, idx) + '.debug' + path.slice(idx);
    }
    const clog = new ChangelogIO(
      this.changelog.destination,
      isDebug()
        ? (this.changelog.destinationDebug ?? getDebugDefaultPath(this.changelog.destination))
        : this.changelog.destination,
    );

    clog.bump(this.repo, {
      key: this.version,
      link: this.diffLink,
      content: this.changelog.section.formatted,
    });

    await this.changelog.addAndCommit(this.versionTemplate);
  }

  async initRepo(): Promise<void> {
    if (!this.repo.link) {
      const repo = await command('git', ['remote', 'get-url', 'origin']);

      // for https://github.com/evan361425/version-bumper.git
      let [_, rawRepoName] = breaker(repo, 1, 'github.com/');
      if (!rawRepoName) {
        // for git@github.com:evan361425/version-bumper.git
        let [_, two] = breaker(repo, 1, 'github.com:');
        rawRepoName = two;
      }
      const repoName = rawRepoName?.split('.')[0];
      if (!repoName) {
        throw new BumperError(`Cannot parse repo name: ${repo}`);
      }

      this.repo.link = `https://github.com/${repoName}`;
      this.git.repo = repoName;
    }

    for (const tag of this.tags) {
      for (const pr of tag.prs) {
        if (!pr.repo) {
          pr.updateRepo(this.repo.name);
        }
      }
    }
  }

  async initVars(args: string[]): Promise<void> {
    // === Input ===
    // Ask for wanted vars if not set
    const input = await askForWantedVars(args, this);
    this.version = input.version;
    this.versionLast = input.versionLast;
    this.ticket = input.ticket;
    this.#tag = input.tag;
  }
}

/**
 * Merge two objects.
 *
 * If find array, concat them.
 */
function softMerge<T extends Record<string, unknown>>(obj1: T, obj2: T): T {
  for (const key of Object.keys(obj2) as (keyof T)[]) {
    const v2 = obj2[key];
    if (v2 === undefined) {
      continue;
    }

    const value = obj1[key];
    if (typeof value !== 'object') {
      obj1[key] = v2;
      continue;
    }

    if (Array.isArray(v2)) {
      (obj1[key] as unknown[]).push(...v2);
      continue;
    }

    obj1[key] = softMerge(value as never, obj2[key] as never);
  }

  return obj1;
}

function combineTags(tags: Record<string, ITag[]>): ITag[] {
  const result: ITag[] = [];
  for (const tag of Object.values(tags)) {
    const t = tag[0]!;
    if (tag.length === 1) {
      result.push(t);
      continue;
    }

    for (const tag2 of tag.slice(1)) {
      softMerge(t as unknown as Record<string, unknown>, tag2 as unknown as Record<string, unknown>);
    }
    result.push(t);
  }

  return result;
}

type Required<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined>;
};
