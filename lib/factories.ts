import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { command } from './command.js';
import { BumperError } from './errors.js';
import { GitCommit, GitDatabase } from './git.js';
import {
  IAutoLink,
  IAutoLinkMatch,
  IChangelog,
  IChangelogCommit,
  IDiff,
  IDiffGroup,
  IHook,
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
      return `${this.link}/releases/tag/${compare.to}`;
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
    readonly destinationDebug: string | undefined,
    readonly section: Template<ChangelogTemplate>,
    readonly commit: ChangelogCommit,
  ) {}

  static fromCfg(cfg: IChangelog): Changelog {
    return new Changelog(
      cfg.enable!,
      cfg.destination!,
      cfg.destinationDebug,
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
  readonly #targets: RegExp;

  constructor(
    readonly matches: string[],
    readonly link: string,
  ) {
    const v = matches
      .map((e) =>
        e
          .replaceAll('@', '')
          .replaceAll('{num}', '@')
          .replaceAll(/[^\w@-]/g, '')
          .replaceAll('@', '(\\d+)'),
      )
      .join('|');
    // patterns must start with whitespace/newline or in first char of line
    this.#targets = new RegExp(`(^|[\\s|([]{1})(${v})`, 'mi');
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
      const index = content.search(this.#targets);
      if (index === -1) {
        return result + content;
      }

      const match = this.extract(content.substring(index))!;
      verbose(`[auto-links] hit: ${match.hit}, target: ${match.target}`);
      const rest = index + match.hit.length;
      const isInLink = AutoLink.inLink.test(content.substring(rest));

      result += content.substring(0, isInLink ? rest : index);

      // only add link if not in link
      if (!isInLink) {
        verbose(`[auto-links] start add link`);
        result += `${match.prefix}[${match.target}](${match.link})`;
      }

      content = content.substring(rest);
    } while (content !== '');

    return result;
  }

  extract(content: string): IAutoLinkMatch | undefined {
    const result = this.#targets.exec(content);
    if (!result) return;

    const [hit, prefix, target, ...numList] = result;
    const link = this.link
      .replaceAll('{num}', numList.find((e) => e) ?? '') // find the first number
      .replaceAll('{value}', target!);
    return { hit, prefix: prefix!, target: target!, link };
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

  formatBody(v: ContentTemplate): Promise<string> {
    return this.body.formatContent(v);
  }
}

export class Diff implements IDiff {
  #content: string | undefined;
  #autoLinks: AutoLink[];

  constructor(
    readonly groups: DiffGroup[],
    readonly item: Template<CommitTemplate>,
    readonly scopeNames: Record<string, string>,
    readonly ignored: string[],
    readonly ignoreOthers: boolean,
    readonly othersTitle: string,
    autoLinks: AutoLink[],
  ) {
    this.#autoLinks = autoLinks;
  }

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
    if (!this.#content) {
      // not bumper error, this should be a developer error
      throw new Error('Content is not prepared yet');
    }

    return this.#content;
  }

  set content(v: string) {
    this.#content = v;
  }

  async prepareContent(tag: Tag, repo: Repo): Promise<void> {
    if (this.#content) return;

    const result = await this.fetchCommits(tag);
    if (result.firstTag) {
      this.#content = 'Initial version.';
      return;
    }

    if (result.commits.length === 0) {
      this.#content = 'No commits found.';
      return;
    }

    this.#content = await this.formatCommit(result.commits, repo);
  }

  /**
   * Fetch commits by given tag.
   *
   * It will find the latest same pattern tag and diff the commits between them.
   */
  async fetchCommits(tag: Tag): Promise<{ firstTag: boolean; commits: GitCommit[] }> {
    const wanted = await tag.findLastTag();
    if (!wanted) {
      verbose('[diff] No last tag found');
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

    verbose(`[diff] Found ${commits.length} commits between ${wanted} and HEAD`);
    return { firstTag: false, commits };
  }

  /**
   * Format each commit.
   */
  async formatCommit(commits: GitCommit[], repo: Repo): Promise<string> {
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

      const hashLink = `[${commit.hash}](${repo.commitLink(commit.hashFull)})`;
      const autoLink = commit.parseAutoLink(this.#autoLinks);
      const content = await this.item.formatContent({
        title: commit.parseTitle(this.#autoLinks),
        titleTail: commit.titleTail,
        titleFull: commit.titleFull,
        author: commit.author,
        hash: commit.hash,
        hashLink,
        hashFull: commit.hashFull,
        pr: commit.pr,
        prLink: commit.pr === commit.hash ? hashLink : `[${commit.pr}](${repo.prLink(Number(commit.pr))})`,
        scope: this.scopeNames[commit.scope] ?? commit.scope,
        autoLink: autoLink ? `[${autoLink.target}](${autoLink.link})` : '',
      });

      groups[group.title] ??= [];
      groups[group.title]!.push(content);
    }

    return Object.entries(groups)
      .map(([title, listItems]) => {
        const items = listItems.join('\n');
        return `### ${title}\n\n${items}`;
      })
      .join('\n\n');
  }
}

export class DiffGroup implements IDiffGroup {
  readonly #matchesRegExp: RegExp[];

  constructor(
    readonly matches: string[],
    readonly title: string,
    readonly priority = 0,
  ) {
    this.#matchesRegExp = matches.map((m) => new RegExp(m));
  }

  static fromCfg(cfg: IDiffGroup): DiffGroup {
    return new DiffGroup(cfg.matches, cfg.title, cfg.priority);
  }

  verify(title: string): boolean {
    return this.#matchesRegExp.some((m) => m.test(title));
  }
}

export class Tag implements ITag {
  #lastTag?: string;

  constructor(
    readonly name: string = '',
    readonly pattern: string,
    readonly withChangelog: boolean = true,
    readonly release: Release,
    readonly prs: TagPR[] = [],
    readonly sort: TagSort,
  ) {}

  static fromCfg(cfg: ITag): Tag | undefined {
    if (!cfg.pattern) return;

    return new Tag(
      cfg.name,
      cfg.pattern,
      cfg.withChangelog,
      Release.fromCfg(cfg.release ?? {}),
      cfg.prs?.map((e) => TagPR.fromCfg(e, cfg.name ?? '')).filter(Boolean) as TagPR[],
      TagSort.fromCfg(cfg.sort ?? {}),
    );
  }

  get wantPR(): boolean {
    return this.prs.length > 0 && this.prs.some((e) => e.repo);
  }

  get mustLastTag(): string {
    if (this.#lastTag === undefined) {
      // not bumper error, this should be a developer error
      throw new Error('Last tag is not ready');
    }

    return this.#lastTag;
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
    if (this.#lastTag !== undefined) return this.#lastTag;

    const tag = await command('git', ['tag', '--list', '--sort=-v:refname'], (e) => this.verify(e.trim()));
    return (this.#lastTag = tag?.trim() ?? '');
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

    const prs = this.prs.filter((e) => e.repo);
    log(`[pr] Start process ${prs.length} PR for ${this.name}`);

    for await (const pr of prs) {
      await pr.replaceFiles(v);
    }
    verbose(`[pr] Done replacing files`);

    const title = await pr.formatTitle(v);
    const body = await pr.formatBody(v);

    for await (const pr of prs) {
      await pr.createPR({ title, body });
      log(`[bump] Created ${this.name} PR (${pr.head} -> ${pr.base})`);
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
      Template.exist(cfg.title) ? Template.fromCfg(cfg.title!) : new Template('{version}'),
      Template.exist(cfg.body) ? Template.fromCfg(cfg.body!) : new Template('{Ticket: "ticket"<NL><NL>}{content}'),
      cfg.preRelease,
      cfg.draft,
    );
  }

  formatTitle(v: VersionedTemplate): Promise<string> {
    return this.title!.formatContent(v);
  }

  formatBody(v: ContentTemplate): Promise<string> {
    return this.body!.formatContent(v);
  }
}

export class TagPR implements ITagPR {
  #git: GitDatabase;
  #repl?: PRReplace[];

  constructor(
    public repo: string,
    public head: string = 'main',
    public headFrom: string = '',
    public base: string,
    readonly labels: string[] = [],
    readonly reviewers: string[] = [],
    readonly replacements: PRReplace[] = [],
    readonly commitMessage?: Template<VersionedTemplate>,
  ) {
    assert(
      commitMessage || replacements.every((e) => e.commitMessage),
      "At least one of commitMessage or all replacements' commitMessage should be set",
    );
    this.#git = new GitDatabase(repo, head);
  }

  static fromCfg(cfg: ITagPR, tagName: string): TagPR | undefined {
    if (!cfg.base) return;

    const ts = new Date().getTime();
    return new TagPR(
      cfg.repo ?? '',
      cfg.head?.replaceAll('{name}', tagName).replaceAll('{timestamp}', ts.toString()),
      cfg.headFrom?.replaceAll('{name}', tagName),
      cfg.base.replaceAll('{name}', tagName),
      cfg.labels,
      cfg.reviewers,
      cfg.replacements?.map((e) => PRReplace.fromCfg(e)),
      Template.fromCfg(Template.exist(cfg.commitMessage) ? cfg.commitMessage! : { value: 'chore: bump to {version}' }),
    );
  }

  get repl(): PRReplace[] {
    return (
      this.#repl ??
      (this.#repl = this.replacements.filter((e) => !e.isEmpty(`${this.repo} ${this.head} -> ${this.base}`)))
    );
  }

  updateRepo(repo: string): void {
    this.repo = repo;
    this.#git.repo = repo;
  }

  async replaceFiles(v: VersionedTemplate): Promise<void> {
    if (this.repl.length === 0) return;

    // check all commit messages are ready
    const promises = [
      this.commitMessage?.fetchContent(), // commit message
      this.repl.map((e) => e.commitMessage?.fetchContent()), // replacements
    ].filter((e) => Boolean(e));
    await Promise.all(promises);

    let baseTree = await (this.headFrom ? this.#git.createBranch(this.headFrom) : this.#git.getRefSha());
    // first create separate commit for replacement if needed
    for await (const replace of this.repl.filter((e) => e.commitMessage)) {
      log(`[pr] Start process PR for commit: ${replace.commitMessage!.formatted}`);
      const tree = await replace.createTree(this.#git, baseTree, v);
      const msg = await replace.commitMessage!.formatContent(v);

      baseTree = await this.#git.createCommit(baseTree, tree, msg);
    }

    // then create commit all replacements
    const replacements = this.repl.filter((e) => !e.commitMessage);
    if (this.commitMessage && replacements.length > 0) {
      const msg = await this.commitMessage.formatContent(v);
      log(`[pr] Start process PR for commit: ${msg}`);

      const files = [];
      const paths = replacements.flatMap((e) => e.paths);
      for await (const replace of replacements) {
        files.push(...(await replace.replaceFiles(this.#git, v)));
      }

      const tree = await this.#git.updateFiles(baseTree, paths, files);
      await this.#git.createCommit(baseTree, tree, msg);
    }
  }

  async createPR(v: { title: string; body: string }): Promise<void> {
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
      this.base,
      '--head',
      this.head,
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
    readonly replacement: Template<VersionedTemplate>,
    readonly commitMessage?: Template<VersionedTemplate>,
  ) {}

  static fromCfg(cfg: IPRReplace): PRReplace {
    return new PRReplace(
      cfg.paths,
      cfg.pattern,
      Template.fromCfg(cfg.replacement),
      Template.exist(cfg.commitMessage) ? Template.fromCfg(cfg.commitMessage!) : undefined,
    );
  }

  isEmpty(name: string): boolean {
    if (this.paths.length === 0) {
      log(`[pr] No PR replace paths found in ${name}, skip it`);
      return true;
    }

    if (!this.pattern) {
      log(`[pr] No PR replace pattern found in ${name}, skip it`);
      return true;
    }

    if (!Template.exist(this.replacement)) {
      log(`[cfg] No PR replace replacement found in ${name}, skip it`);
      return true;
    }

    return false;
  }

  async replaceFiles(git: GitDatabase, v: VersionedTemplate): Promise<string[]> {
    const pattern = new RegExp(this.pattern, 'm');

    const files = await git.fetchFiles(this.paths);
    const content = await this.replacement.formatContent(v);

    return files.map((f) => f.replace(pattern, content));
  }

  async createTree(git: GitDatabase, baseTree: string, v: VersionedTemplate): Promise<string> {
    const files = await this.replaceFiles(git, v);

    return await git.updateFiles(baseTree, this.paths, files);
  }
}

export class TagSort implements ITagSort {
  #sortFields: SortField[] | undefined;

  constructor(
    readonly separator: string = '.',
    readonly fields: string[] = ['1,1n'],
  ) {}

  static fromCfg(cfg: ITagSort): TagSort {
    return new TagSort(cfg.separator, cfg.fields);
  }

  get sortFields(): SortField[] {
    if (!this.#sortFields) {
      this.#sortFields = this.fields.map((f) => SortField.fromString(f));
    }

    return this.#sortFields;
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

export class Hook implements IHook {
  readonly #afterVerified: HookCommand[];
  readonly #afterAll: HookCommand[];

  constructor(
    readonly afterVerified: string[] = [],
    readonly afterAll: string[] = [],
  ) {
    this.#afterVerified = afterVerified.map((c) => new HookCommand(c));
    this.#afterAll = afterAll.map((c) => new HookCommand(c));
  }

  static fromCfg(cfg: IHook): Hook {
    return new Hook(cfg.afterVerified, cfg.afterAll);
  }

  async runAfterVerified(v: VersionedTemplate): Promise<void> {
    let i = 1;
    for await (const hook of this.#afterVerified) {
      await hook.run(v, i++);
    }
  }

  async runAfterAll(v: VersionedTemplate): Promise<void> {
    let i = 1;
    for await (const hook of this.#afterAll) {
      await hook.run(v, i++);
    }
  }
}

export class HookCommand {
  #splitted?: string[];

  constructor(readonly command: string) {}

  async run(v: VersionedTemplate, idx: number): Promise<void> {
    let [cmd, ...args] = this.split();
    if (cmd) {
      args = args.map((a) => {
        Object.entries(v).forEach(([key, value]) => {
          a = a.replaceAll(`{${key}}`, value);
        });

        return a;
      });

      try {
        const result = await command(cmd, args);
        log(`[hook] #${idx} ${cmd} result: ${result.trim()}`);
      } catch (error) {
        throw new BumperError(`Hook#${idx} ${error}`);
      }
    }
  }

  protected split(): string[] {
    return (this.#splitted ??=
      this.command.match(/"([^"]+)"|'([^']+)'|\S+/g)?.map(
        (token) => token.replace(/^['"]|['"]$/g, ''), // 移除引號
      ) ?? []);
  }
}

export class Template<T extends Record<string, string>> implements ITemplate {
  #content: string | undefined;
  #formatted: string | undefined;

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
  static exist(cfg?: ITemplate): boolean {
    return !!(cfg?.value || cfg?.file || (cfg?.github?.repo && cfg?.github?.path));
  }

  /**
   * Get last formatted content.
   */
  get formatted(): string {
    if (!this.#formatted) {
      // not bumper error, this should be a developer error
      throw new Error('Formatted content is not prepared yet');
    }

    return this.#formatted;
  }

  set formatted(v: string) {
    this.#formatted = v;
  }

  async formatContent(data: T): Promise<string> {
    let content = await this.fetchContent();

    Object.entries(data).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\{([^"}]*"(${key})"[^"}]*|${key})\}`, 'g'), (key) => {
        if (!value) {
          return '';
        }

        // remove the curly braces
        let [prefix, name, suffix] = key.slice(1, -1).split('"');
        // not using quote mode
        if (!name) {
          return value;
        }

        prefix = prefix?.replaceAll('<NL>', '\n') ?? '';
        suffix = suffix?.replaceAll('<NL>', '\n') ?? '';
        return `${prefix}${value}${suffix}`;
      });
    });

    return (this.#formatted = content);
  }

  async fetchContent(): Promise<string> {
    if (this.#content) return this.#content;

    if (this.value) {
      return (this.#content = this.value);
    }

    if (this.file) {
      return (this.#content = readFileSync(this.file, 'utf-8'));
    }

    const gh = new GitDatabase(this.github!.repo, this.github!.branch ?? 'main');
    verbose(`[template] Fetching content from ${this.github!.repo}:${this.github!.path}`);
    const result = await gh.fetchFiles([this.github!.path]);
    return (this.#content = result[0]!);
  }
}

export type VersionedTemplate = {
  version: string;
  versionName: string;
  versionLast: string;
  versionNoPrefix: string;
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
  hashLink: string;
  hashFull: string;
  pr: string;
  prLink: string;
  autoLink: string;
  scope: string;
};
