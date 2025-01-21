import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { command } from './command.js';
import { GitCommit, GitDatabase } from './git.js';
import {
  IAutoLink,
  IChangelog,
  IChangelogCommit,
  IDiff,
  IDiffGroup,
  IPR,
  IPRReplace,
  IRelease,
  IRepo,
  ITag,
  ITagPR,
  ITagSort,
  ITemplate,
  ITemplateGitHub,
} from './interfaces.js';
import { log, verbose } from './logger.js';
import { breaker, SortField } from './util.js';

export class Repo implements IRepo {
  constructor(public link: string) {}

  static fromCfg(cfg: IRepo): Repo {
    return new Repo(cfg.link);
  }

  get name(): string {
    const name = this.link.substring('https://github.com/'.length);
    return name.replace('^/', '').replace('.git$', '').replace('/$', '');
  }

  commitLink(hash: string): string {
    return `${this.link}/commit/${hash}`;
  }

  compareLink(compare: Partial<{ from: string; to: string }>): string {
    if (compare.from && compare.to) {
      return `${this.link}/compare/${compare.from}...${compare.to}`;
    }
    if (compare.from) {
      return `${this.link}/compare/${compare.from}...HEAD`;
    }
    if (compare.to) {
      return `${this.link}/commits/${compare.to}`;
    }
    return this.link;
  }

  prLink(pr: number): string {
    return `${this.link}/pull/${pr}`;
  }
}

export class Changelog implements IChangelog {
  constructor(
    readonly enable: boolean,
    readonly destination: string,
    readonly section: Template<ChangelogTemplate>,
    readonly commit: ChangelogCommit,
  ) {}

  static fromCfg(cfg: IChangelog): Changelog {
    return new Changelog(
      cfg.enable!,
      cfg.destination!,
      Template.fromCfg(cfg.section!),
      ChangelogCommit.fromCfg(cfg.commit!),
    );
  }

  /**
   * Add and commit the changes.
   */
  async addAndCommit(v: VersionedTemplate): Promise<void> {
    const msg = await this.commit.formatMessage(v);
    const addTarget = this.commit.addAll ? '.' : this.destination;

    await command('git', ['add', addTarget]);
    await command('git', ['commit', '-m', msg]);
  }
}

export class ChangelogCommit implements IChangelogCommit {
  constructor(
    readonly message: Template<VersionedTemplate>,
    readonly addAll: boolean,
  ) {}

  static fromCfg(cfg: IChangelogCommit): ChangelogCommit {
    return new ChangelogCommit(Template.fromCfg(cfg.message!), cfg.addAll!);
  }

  async formatMessage(v: VersionedTemplate): Promise<string> {
    return this.message.formatContent(v);
  }
}

export class AutoLink implements IAutoLink {
  static readonly inLink = /^[^\\[]*\\]/;

  /**
   * Regular Expression pattern to match the commit title.
   *
   * This contains all the matches and will be used to find the ticket number.
   */
  readonly targets: RegExp;

  constructor(
    readonly matches: string[],
    readonly link: string,
  ) {
    const v = matches.join('|');
    // patterns must start with whitespace/newline or in first char of line
    this.targets = new RegExp(`(^|[\\n\\r\\s]{1})(${v})(\\d*)?`, 'mi');
  }

  static fromCfg(cfg: IAutoLink): AutoLink {
    return new AutoLink(cfg.matches, cfg.link);
  }

  /**
   * Inject link to the content.
   */
  inject(content: string): string {
    let result = '';

    do {
      const index = content.search(this.targets);
      if (index === -1) {
        return result + content;
      }

      const [hit, prefix, target, num] = this.targets.exec(content.substring(index))!;
      verbose(`[auto-links] hit(${hit}), target(${target}), num(${num})`);
      const rest = index + hit.length;
      const isInLink = AutoLink.inLink.test(content.substring(rest));

      result += content.substring(0, isInLink ? rest : index);

      // only add link if not in link
      if (!isInLink) {
        verbose(`[auto-links] start add link`);
        const link = this.link.replace(/{num}/g, num ?? '');
        const targetWithNum = num ? target!.concat(num) : target!;
        result += `${prefix}[${targetWithNum}](${link})`;
      }

      content = content.substring(rest);
    } while (content !== '');

    return result;
  }

  extract(content: string): string | undefined {
    const result = this.targets.exec(content);
    if (!result) return;

    const [_, __, target, num] = result;
    return num ? target!.concat(num) : target!;
  }
}

export class PR implements IPR {
  constructor(
    readonly title: Template<VersionedTemplate>,
    readonly body: Template<ContentTemplate>,
  ) {}

  static fromCfg(cfg: IPR): PR {
    return new PR(Template.fromCfg(cfg.title!), Template.fromCfg(cfg.body!));
  }

  formatTitle(v: VersionedTemplate): Promise<string> {
    return this.title.formatContent(v);
  }

  formatBody(v: {
    version: string;
    versionName: string;
    ticket: string;
    content: string;
    diffLink: string;
  }): Promise<string> {
    return this.body.formatContent(v);
  }
}

export class Diff implements IDiff {
  protected _content: string | undefined;

  constructor(
    readonly groups: DiffGroup[],
    readonly item: Template<CommitTemplate>,
    readonly scopeNames: Record<string, string>,
    readonly ignored: string[],
    readonly ignoreOthers: boolean,
    readonly othersTitle: string,
    readonly autoLinks: AutoLink[],
  ) {}

  static fromCfg(cfg: IDiff, autoLinks: AutoLink[]): Diff {
    return new Diff(
      cfg.groups!.map((g) => DiffGroup.fromCfg(g)),
      Template.fromCfg(cfg.item!),
      cfg.scopeNames!,
      cfg.ignored!,
      cfg.ignoreOthers!,
      cfg.othersTitle!,
      autoLinks,
    );
  }

  get content(): string {
    if (!this._content) {
      // not bumper error, this should be a developer error
      throw new Error('Content is not prepared yet');
    }

    return this._content;
  }

  async prepareContent(tag: Tag): Promise<void> {
    if (this._content) return;

    const result = await this.fetchCommits(tag);
    if (result.firstTag) {
      this._content = 'Initial tag.';
      return;
    }

    if (result.commits.length === 0) {
      this._content = 'No commits found.';
      return;
    }

    this._content = await this.formatCommit(result.commits);
  }

  /**
   * Fetch commits by given tag.
   *
   * It will find the latest same pattern tag and diff the commits between them.
   */
  async fetchCommits(tag: Tag): Promise<{ firstTag: boolean; commits: GitCommit[] }> {
    const wanted = await tag.findLastTag();
    if (!wanted) {
      return { firstTag: true, commits: [] };
    }

    const diff = await command('git', ['log', '--pretty=%H %al %s', `HEAD...${wanted}`]);
    const commits = diff
      .split('\n')
      .map((e) => {
        const [hash, rest] = breaker(e.trim(), 1, ' ');
        if (!hash || !rest) return;
        const [name, title] = breaker(rest.trim(), 1, ' ');

        if (!name || !title) return;

        return new GitCommit(hash, title.trim(), name.trim());
      })
      .filter((e) => e) as GitCommit[];

    return { firstTag: false, commits };
  }

  /**
   * Format each commit.
   */
  async formatCommit(commits: GitCommit[]): Promise<string> {
    const groups: Record<string, string[]> = {};
    const others = new DiffGroup([], this.othersTitle);
    const ignored = this.ignored.map((i) => new RegExp(i));
    for await (const commit of commits) {
      if (ignored.some((i) => i.test(commit.titleFull))) {
        verbose(`[diff] Ignored commit: ${commit.titleFull}`);
        continue;
      }

      const group = this.groups
        .filter((g) => g.verify(commit.titleFull))
        .reduce((a, b) => (a.priority > b.priority ? a : b), others);
      if (this.ignoreOthers && group === others) {
        verbose(`[diff] Ignored others: ${commit.titleFull}`);
        continue;
      }

      const content = await this.item.formatContent({
        title: commit.parseTitle(this.autoLinks),
        titleTail: commit.titleTail,
        titleFull: commit.titleFull,
        author: commit.author,
        hash: commit.hash,
        hashFull: commit.hashFull,
        pr: commit.pr,
        scope: commit.scope,
        autoLink: commit.parseAutoLink(this.autoLinks),
      });

      groups[group.title] ??= [];
      groups[group.title]!.push(content);
    }

    return Object.entries(groups)
      .map(([title, listItems]) => {
        const items = listItems.map((e) => `- ${e}`).join('\n');
        return `### ${title}\n\n${items}`;
      })
      .join('\n\n');
  }
}

export class DiffGroup implements IDiffGroup {
  protected readonly matchesRegExp: RegExp[];

  constructor(
    readonly matches: string[],
    readonly title: string,
    readonly priority = 0,
  ) {
    this.matchesRegExp = matches.map((m) => new RegExp(m));
  }

  static fromCfg(cfg: IDiffGroup): DiffGroup {
    return new DiffGroup(cfg.matches, cfg.title, cfg.priority);
  }

  verify(title: string): boolean {
    return this.matchesRegExp.some((m) => m.test(title));
  }
}

export class Tag implements ITag {
  protected _lastTag?: string;

  constructor(
    readonly name: string = '',
    readonly pattern: string,
    readonly withChangelog: boolean = true,
    readonly release: Release,
    readonly prs: TagPR[] = [],
    readonly sort: TagSort,
  ) {}

  static fromCfg(cfg: ITag, repoLink: string): Tag {
    return new Tag(
      cfg.name,
      cfg.pattern,
      cfg.withChangelog,
      Release.fromCfg(cfg.release ?? {}),
      cfg.prs?.map((e) => TagPR.fromCfg(e, repoLink)),
      TagSort.fromCfg(cfg.sort ?? {}),
    );
  }

  get wantPR(): boolean {
    return this.prs.length > 0;
  }

  get mustLastTag(): string {
    if (!this._lastTag) {
      // not bumper error, this should be a developer error
      throw new Error('Last tag is not ready');
    }

    return this._lastTag;
  }

  /**
   * Check if the tag is matched.
   */
  verify(tag: string): boolean {
    return new RegExp(this.pattern).test(tag);
  }

  /**
   * Find the last same pattern tag.
   */
  async findLastTag(): Promise<string> {
    if (this._lastTag) return this._lastTag;

    const tag = await command('git', ['tag', '--list', '--sort=-v:refname'], (e) => this.verify(e.trim()));
    return (this._lastTag = tag?.trim() ?? '');
  }

  /**
   * Using `gh` command to create release.
   *
   * Proxy to `Release.formatTitle` and `Release.formatBody`.
   */
  async createRelease(v: ContentTemplate): Promise<void> {
    if (!this.release.enable) return;

    const title = await this.release.formatTitle(v);
    const body = await this.release.formatBody(v);

    log(`[bump] Creating GitHub release ${title}`);
    await command('gh', [
      'release',
      'create',
      v.version,
      '--title',
      title,
      `--prerelease=${this.release.preRelease}`,
      `--draft=${this.release.draft}`,
      '--notes',
      body,
    ]);
  }

  async createPR(pr: PR, v: ContentTemplate): Promise<void> {
    if (!this.wantPR) return;

    verbose(`[pr] Creating commits to designated branches for PR`);
    for await (const branch of this.prs) {
      await branch.createCommits({ version: v.version, versionName: this.name, ticket: v.ticket });
    }

    const title = await pr.formatTitle(v);
    const body = await pr.formatBody(v);

    for await (const branch of this.prs) {
      log(`[bump] Creating PR for ${this.name}: ${branch.head} -> ${branch.base}`);
      await branch.createPR({ name: this.name, title, body });
    }
  }
}

export class Release implements IRelease {
  constructor(
    readonly enable: boolean = true,
    readonly title?: Template<VersionedTemplate>,
    readonly body?: Template<ContentTemplate>,
    readonly preRelease: boolean = false,
    readonly draft: boolean = false,
  ) {
    if (this.enable) {
      assert(this.title, 'Release title is required');
      assert(this.body, 'Release body is required');
    }
  }

  static fromCfg(cfg: IRelease): Release {
    return new Release(
      cfg.enable,
      cfg.title ? Template.fromCfg(cfg.title) : new Template('{version}'),
      cfg.body ? Template.fromCfg(cfg.body) : new Template('{Ticket: "ticket"<NL><NL>}{content}'),
      cfg.preRelease,
      cfg.draft,
    );
  }

  formatTitle(v: VersionedTemplate): Promise<string> {
    return this.title!.formatContent(v);
  }

  formatBody(v: {
    version: string;
    versionName: string;
    ticket: string;
    content: string;
    diffLink: string;
  }): Promise<string> {
    return this.body!.formatContent(v);
  }
}

export class TagPR implements ITagPR {
  readonly git: GitDatabase;

  constructor(
    public repo: string,
    readonly head: string = 'main',
    readonly base: string,
    readonly labels: string[] = [],
    readonly reviewers: string[] = [],
    readonly replacements: PRReplace[] = [],
    readonly commitMessage?: Template<VersionedTemplate>,
  ) {
    assert(
      commitMessage || replacements.every((e) => e.commitMessage),
      "At least one of commitMessage or all replacements' commitMessage should be set",
    );
    this.git = new GitDatabase(repo, head);
  }

  static fromCfg(cfg: ITagPR, repoLink: string): TagPR {
    return new TagPR(
      cfg.repo ?? repoLink,
      cfg.head,
      cfg.base,
      cfg.labels,
      cfg.reviewers,
      cfg.replacements?.map((e) => PRReplace.fromCfg(e)),
      cfg.commitMessage ? Template.fromCfg(cfg.commitMessage) : undefined,
    );
  }

  formatHead(v: { name: string }): string {
    const ts = new Date().getTime();
    return this.head.replace(/{name}/g, v.name).replace(/{timestamp}/g, ts.toString());
  }

  formatBase(v: { name: string }): string {
    return this.base.replace(/{name}/g, v.name);
  }

  async createCommits(v: VersionedTemplate): Promise<void> {
    // check all commit messages are ready
    const promises = [
      this.commitMessage?.fetchContent(),
      this.replacements.map((e) => e.commitMessage?.fetchContent()),
    ].filter((e) => Boolean(e));
    await Promise.all(promises);

    const baseTree = await this.git.createBranch(this.base);

    // first create separate commit for replacement if needed
    for await (const replace of this.replacements.filter((e) => e.commitMessage)) {
      const tree = await replace.createTree(this.git, baseTree);
      const msg = await replace.commitMessage!.formatContent(v);

      await this.git.createCommit(baseTree, tree, msg);
    }

    // then create commit all replacements
    if (this.commitMessage) {
      const replacements = this.replacements.filter((e) => !e.commitMessage);
      const files = [];
      for await (const replace of replacements) {
        files.push(...(await replace.replaceFiles(this.git)));
      }

      const msg = await this.commitMessage.formatContent(v);
      const tree = await this.git.updateFiles(
        baseTree,
        replacements.flatMap((e) => e.paths),
        files,
      );

      await this.git.createCommit(baseTree, tree, msg);
    }
  }

  async createPR(v: { name: string; title: string; body: string }): Promise<void> {
    await command('gh', [
      'pr',
      'create',
      '--title',
      v.title,
      '--body',
      v.body,
      '--assignee',
      '@me',
      '--base',
      this.formatBase({ name: v.name }),
      '--head',
      this.formatHead({ name: v.name }),
      '--repo',
      this.repo,
      ...this.reviewers.map((e) => ['--reviewer', e]).flat(),
      ...this.labels.map((e) => ['--label', e]).flat(),
    ]);
  }
}

export class PRReplace implements IPRReplace {
  constructor(
    readonly paths: string[],
    readonly pattern: string,
    readonly replacement: string,
    readonly commitMessage?: Template<VersionedTemplate>,
  ) {}

  static fromCfg(cfg: IPRReplace): PRReplace {
    return new PRReplace(
      cfg.paths,
      cfg.pattern,
      cfg.replacement,
      cfg.commitMessage ? Template.fromCfg(cfg.commitMessage) : undefined,
    );
  }

  async replaceFiles(git: GitDatabase): Promise<string[]> {
    const pattern = new RegExp(this.pattern);

    const files = await git.fetchFiles(this.paths);
    return files.map((f) => f.replace(pattern, this.replacement));
  }

  async createTree(git: GitDatabase, baseTree: string): Promise<string> {
    const files = await this.replaceFiles(git);

    return await git.updateFiles(baseTree, this.paths, files);
  }
}

export class TagSort implements ITagSort {
  protected _sortFields: SortField[] | undefined;

  constructor(
    readonly separator: string = '.',
    readonly fields: string[] = ['1,1n'],
  ) {}

  static fromCfg(cfg: ITagSort): TagSort {
    return new TagSort(cfg.separator, cfg.fields);
  }

  get sortFields(): SortField[] {
    if (!this._sortFields) {
      this._sortFields = this.fields.map((f) => SortField.fromString(f));
    }

    return this._sortFields;
  }

  firstIsGreaterThanSecond(first: string, second?: string): boolean {
    if (!second) return true;

    const f1 = first.split(this.separator);
    const f2 = second.split(this.separator);

    for (const field of this.sortFields) {
      if (field.firstIsGreaterThanSecond(f1, f2)) return true;
    }

    return false;
  }
}

export class Template<T extends Record<string, string>> implements ITemplate {
  protected _content: string | undefined;
  protected _formatted: string | undefined;

  constructor(
    readonly value?: string,
    readonly file?: string,
    readonly github?: ITemplateGitHub,
  ) {
    assert(file || value || github, 'At least one of file, value, or github should be set');
  }

  static fromCfg<T extends Record<string, string>>(cfg: ITemplate): Template<T> {
    return new Template(cfg.value, cfg.file, cfg.github);
  }

  /**
   * Get last formatted content.
   */
  get formatted(): string {
    if (!this._formatted) {
      // not bumper error, this should be a developer error
      throw new Error('Formatted content is not prepared yet');
    }

    return this._formatted;
  }

  async formatContent(data: T): Promise<string> {
    let content = await this.fetchContent();

    Object.entries(data).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\{[^"}]*"?(${key})"?[^"}]*\}`, 'g'), (key) => {
        if (!value) {
          return '';
        }

        // remove the curly braces
        let [prefix, name, suffix] = key.slice(1, -1).split('"');
        // not using quote mode
        if (!name || !prefix) {
          return value;
        }

        prefix = prefix.replace(/<NL>/g, '\n');
        suffix = suffix?.replace(/<NL>/g, '\n') ?? '';
        return `${prefix}${value}${suffix}`;
      });
    });

    return (this._formatted = content);
  }

  async fetchContent(): Promise<string> {
    if (this._content) return this._content;

    if (this.value) {
      return (this._content = this.value);
    }

    if (this.file) {
      return (this._content = readFileSync(this.file, 'utf-8'));
    }

    const gh = new GitDatabase(this.github!.repo, this.github!.branch ?? 'main');
    const result = await gh.fetchFiles([this.github!.path]);
    return (this._content = result[0]!);
  }
}

export type VersionedTemplate = {
  version: string;
  versionName: string;
  ticket: string;
};
export type ContentTemplate = VersionedTemplate & {
  content: string;
  diffLink: string;
};
export type ChangelogTemplate = VersionedTemplate & {
  date: string;
  time: string;
};
export type CommitTemplate = {
  title: string;
  titleTail: string;
  titleFull: string;
  author: string;
  hash: string;
  hashFull: string;
  pr: string;
  autoLink: string;
  scope: string;
};
