import assert from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { command } from './command';
import { GitCommit, GitDatabase } from './git';
import {
  IAutoLink,
  IChangelog,
  IDiff,
  IDiffGroup,
  IPR,
  IPRBranch,
  IProcess,
  IPRReplace,
  IRelease,
  IRepo,
  ITag,
  ITemplate,
  ITemplateGitHub,
} from './interfaces';
import { log, verbose } from './logger';

export class Repo implements IRepo {
  constructor(readonly link: string) {}

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

export class Process implements IProcess {
  protected readonly onlyMode: boolean;
  readonly throwErrorIfTagExist: boolean;

  constructor(
    readonly prOnly: boolean,
    readonly releaseOnly: boolean,
    readonly noPush: boolean,
    throwErrorIfTagExist?: boolean,
  ) {
    this.onlyMode = prOnly || releaseOnly;
    this.throwErrorIfTagExist = throwErrorIfTagExist ?? !this.onlyMode;
  }

  get wantCommit(): boolean {
    return !this.onlyMode;
  }

  get wantChangelog(): boolean {
    return !this.onlyMode;
  }

  get wantPR(): boolean {
    return !this.releaseOnly;
  }

  get wantRelease(): boolean {
    return !this.prOnly;
  }
}

export class Changelog implements IChangelog {
  constructor(
    readonly disable: boolean,
    readonly destination: string,
    readonly template: Template,
  ) {}

  async getTemplate(): Promise<string> {
    return this.template.fetchContent();
  }

  write(content: string): void {
    writeFileSync(this.destination, content);
  }
}

export class AutoLink implements IAutoLink {
  /**
   * Regular Expression pattern to match the commit title.
   */
  readonly targets: RegExp;

  static readonly inLink = /^[^\\[]*\\]/;

  constructor(
    readonly matches: string[],
    readonly link: string,
  ) {
    const v = matches.join('|');
    // patterns must start with whitespace/newline or in first char of line
    this.targets = new RegExp(`(^|[\\n\\r\\s]{1})(${v})(\\d*)?`, 'mi');
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

  /**
   * Extract ticket from the content.
   */
  extract(content: string): string | undefined {
    const result = this.targets.exec(content);
    if (!result) return;

    const [_, __, target, num] = result;
    return num ? target!.concat(num) : target!;
  }
}

export class PR implements IPR {
  constructor(
    readonly title: Template,
    readonly body: Template,
  ) {}

  async formatTitle(
    v: Partial<{
      version: string;
      versionName: string;
      ticket: string;
    }>,
  ): Promise<string> {
    const title = await this.title.fetchContent();
    return title
      .replace(/{version}/g, v.version ?? '')
      .replace(/{versionName}/g, v.versionName ?? '')
      .replace(/{ticket}/g, v.ticket ?? '');
  }

  async formatBody(
    v: Partial<{
      version: string;
      versionName: string;
      ticket: string;
      content: string;
      diffLink: string;
    }>,
  ): Promise<string> {
    const body = await this.body.fetchContent();
    return body
      .replace(/{version}/g, v.version ?? '')
      .replace(/{versionName}/g, v.versionName ?? '')
      .replace(/{ticket}/g, v.ticket ?? '')
      .replace(/{content}/g, v.content ?? '')
      .replace(/{diffLink}/g, v.diffLink ?? '');
  }
}

export class Diff implements IDiff {
  constructor(
    readonly groups: DiffGroup[],
    readonly fallbackGroupTitle: string,
    readonly template: Template,
    readonly scopeNames: Record<string, string>,
    readonly ignored: string[],
    readonly autoLinks: AutoLink[],
  ) {}

  async parseContent(commits: GitCommit[]): Promise<string> {
    const template = await this.template.fetchContent();

    const groups: Record<string, string[]> = {};
    const fallbackGroup = new DiffGroup([], this.fallbackGroupTitle);
    for (const commit of commits) {
      const group = this.groups.find((g) => g.verify(commit.title)) ?? fallbackGroup;
      const content = template
        .replace(/{title}/g, commit.title)
        .replace(/{titleFull}/g, commit.titleFull)
        .replace(/{message}/g, commit.message)
        .replace(/{author}/g, commit.author)
        .replace(/{hash}/g, commit.hash)
        .replace(/{hashFull}/g, commit.hashFull)
        .replace(/{pr}/g, commit.pr)
        .replace(/{scope}/g, commit.scope)
        .replace(/{ticket}/g, commit.parseTicket(this.autoLinks));

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
  ) {
    this.matchesRegExp = matches.map((m) => new RegExp(m));
  }

  verify(title: string): boolean {
    return this.matchesRegExp.some((m) => m.test(title));
  }
}

export class Tag implements ITag {
  constructor(
    readonly name: string,
    readonly pattern: string,
    readonly withChangelog: boolean,
    readonly release: Release,
    readonly prBranches: Branch[],
  ) {}

  get wantPR(): boolean {
    return this.prBranches.length > 0;
  }

  /**
   * Check if the tag is matched.
   */
  verify(tag: string): boolean {
    return new RegExp(this.pattern).test(tag);
  }

  /**
   * Using `gh` command to create release.
   *
   * Proxy to `Release.formatTitle` and `Release.formatBody`.
   */
  async createRelease(v: { version: string; ticket?: string; content: string; diffLink: string }): Promise<void> {
    const title = await this.release.formatTitle({
      version: v.version,
      versionName: this.name,
      ticket: v.ticket,
    });
    const body = await this.release.formatBody({
      version: v.version,
      versionName: this.name,
      ticket: v.ticket,
      content: v.content,
      diffLink: v.diffLink,
    });

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

  async createPR(pr: PR, v: { version: string; ticket: string; content: string; diffLink: string }): Promise<void> {
    if (!this.wantPR) return;

    verbose(`[pr] Creating commits to designated branches for PR`);
    for await (const branch of this.prBranches) {
      await branch.createCommits({ version: v.version, versionName: this.name, ticket: v.ticket });
    }

    const title = await pr.formatTitle({
      version: v.version,
      versionName: this.name,
      ticket: v.ticket,
    });
    const body = await pr.formatBody({
      version: v.version,
      versionName: this.name,
      ticket: v.ticket,
      content: v.content,
      diffLink: v.diffLink,
    });

    for await (const branch of this.prBranches) {
      log(`[bump] Creating PR for ${this.name}: ${branch.head} -> ${branch.base}`);
      await branch.createPR({ name: this.name, title, body });
    }
  }
}

export class Release implements IRelease {
  constructor(
    readonly enable: boolean,
    readonly title: Template,
    readonly body: Template,
    readonly preRelease: boolean,
    readonly draft: boolean,
  ) {}

  async formatTitle(
    v: Partial<{
      version: string;
      versionName: string;
      ticket: string;
    }>,
  ): Promise<string> {
    const title = await this.title.fetchContent();
    return title
      .replace(/{version}/g, v.version ?? '')
      .replace(/{versionName}/g, v.versionName ?? '')
      .replace(/{ticket}/g, v.ticket ?? '');
  }

  async formatBody(
    v: Partial<{
      version: string;
      versionName: string;
      ticket: string;
      content: string;
      diffLink: string;
    }>,
  ): Promise<string> {
    const body = await this.body.fetchContent();
    return body
      .replace(/{version}/g, v.version ?? '')
      .replace(/{versionName}/g, v.versionName ?? '')
      .replace(/{ticket}/g, v.ticket ?? '')
      .replace(/{content}/g, v.content ?? '')
      .replace(/{diffLink}/g, v.diffLink ?? '');
  }
}

export class Branch implements IPRBranch {
  readonly git: GitDatabase;

  constructor(
    readonly repo: string,
    readonly head: string,
    readonly base: string,
    readonly labels: string[],
    readonly reviewers: string[],
    readonly replacements: PRReplace[],
    readonly commitMessage?: Template,
  ) {
    assert(
      commitMessage || replacements.every((e) => e.commitMessage),
      "At least one of commitMessage or all replacements' commitMessage should be set",
    );
    this.git = new GitDatabase(repo, head);
  }

  formatHead(v: Partial<{ name: string }>): string {
    const ts = new Date().getTime();
    return this.head.replace(/{name}/g, v.name ?? '').replace(/{timestamp}/g, ts.toString());
  }

  formatBase(v: Partial<{ name: string }>): string {
    return this.base.replace(/{name}/g, v.name ?? '');
  }

  async createCommits(v: { version: string; versionName: string; ticket: string }): Promise<void> {
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

      const msg = (await replace.commitMessage!.fetchContent())
        .replace(/{version}/g, v.version)
        .replace(/{versionName}/g, v.versionName)
        .replace(/{ticket}/g, v.ticket);
      await this.git.createCommit(baseTree, tree, msg);
    }

    // then create commit all replacements
    if (this.commitMessage) {
      const replacements = this.replacements.filter((e) => !e.commitMessage);
      const files = [];
      for await (const replace of replacements) {
        files.push(...(await replace.replaceFiles(this.git)));
      }

      const tree = await this.git.updateFiles(
        baseTree,
        replacements.flatMap((e) => e.paths),
        files,
      );

      const msg = (await this.commitMessage.fetchContent())
        .replace(/{version}/g, v.version)
        .replace(/{versionName}/g, v.versionName)
        .replace(/{ticket}/g, v.ticket);
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
      ...(this.labels.map((e) => ['--label', e]).flat() ?? []),
    ]);
  }
}

export class PRReplace implements IPRReplace {
  constructor(
    readonly paths: string[],
    readonly pattern: string,
    readonly replacement: string,
    readonly commitMessage?: Template,
  ) {}

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

export class Template implements ITemplate {
  constructor(
    readonly file: string,
    readonly value: string,
    readonly github?: ITemplateGitHub,
  ) {
    assert(file || value || github, 'At least one of file, value, or github should be set');
  }

  protected _content: string | undefined;

  async fetchContent(): Promise<string> {
    if (this._content) return this._content;

    if (this.value) {
      return (this._content = this.value);
    }

    if (this.file) {
      return (this._content = readFileSync(this.file, 'utf-8'));
    }

    const gh = new GitDatabase(this.github!.repo, this.github!.branch);
    const result = await gh.fetchFiles([this.github!.path]);
    return (this._content = result[0]!);
  }
}
