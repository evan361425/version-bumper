import assert from 'node:assert';
import { command } from './command.js';
import { IAutoLink, IAutoLinkMatch } from './interfaces.js';
import { verbose } from './logger.js';
import { removeMarkdownLinks } from './util.js';

export class GitCommit {
  protected _pr: string | undefined;
  protected _scope: string | undefined;
  protected _title: string | undefined;
  protected _titleTail: string | undefined;

  constructor(
    readonly hashFull: string,
    readonly titleFull: string,
    readonly author: string,
  ) {}

  get hash(): string {
    return this.hashFull.substring(0, 7);
  }

  get titleTail(): string {
    if (this._titleTail) return this._titleTail;

    const idx = this.titleFull.indexOf(':');
    return (this._titleTail = idx === -1 ? this.titleFull : this.titleFull.substring(idx + 1).trim());
  }

  get pr(): string {
    return (this._pr ??= this.titleFull.match(/\(?#(\d+)\)?/)?.[1] ?? this.hash);
  }

  get scope(): string {
    return (this._scope ??= this.titleFull.match(/^\w+\((\w+)\)/)?.[1] ?? '');
  }

  parseAutoLink(autoLinks: IAutoLink[]): IAutoLinkMatch | undefined {
    for (const link of autoLinks) {
      const match = link.extract(this.titleFull);
      if (match) return match;
    }

    return;
  }

  parseTitle(autoLinks: IAutoLink[]): string {
    if (this._title) return this._title;

    let title = this.titleTail.replace(/\(?#\d+\)?/, '');

    const match = this.parseAutoLink(autoLinks);
    if (match) {
      title = title.replace(match.target, '').trim();
    }

    // avoid double space
    return (this._title = title.replace(/ +/g, ' ').trim());
  }
}

export class GitDatabase {
  constructor(
    /**
     * Repository name in the format of `owner/repo`.
     */
    public repo: string,
    /**
     * Source branch name.
     *
     * This branch will be used to create new branches.
     */
    readonly branch: string = '',
  ) {}

  async tag(version: string, content: string): Promise<void> {
    await command('git', ['tag', version, '-m', removeMarkdownLinks(content)]);
  }

  async push(hasCommit: boolean): Promise<void> {
    if (hasCommit) {
      await command('git', ['push', '--no-verify']);
    }
    await command('git', ['push', '--tags', '--no-verify']);
  }

  /**
   * Create a new branch from the `branch`.
   */
  async createBranch(src: string): Promise<string> {
    const sha = await this.getRefSha(src);
    verbose(`[git] Creating branch '${this.branch}' in ${this.repo} from ${src}(${sha})`);

    return await command('gh', [
      'api',
      '-X',
      'POST',
      `repos/${this.repo}/git/refs`,
      '-f',
      `ref=refs/heads/${this.branch}`,
      '-f',
      `sha=${sha}`,
      '--jq',
      '.object.sha',
    ]);
  }

  getRefSha(ref?: string): Promise<string> {
    return command('gh', ['api', `repos/${this.repo}/git/refs/heads/${ref ?? this.branch}`, '--jq', '.object.sha']);
  }

  /**
   * Fetch files from the repository.
   *
   * @returns Contents (base64 decoded) of the files.
   */
  async fetchFiles(paths: string[]): Promise<string[]> {
    verbose(`[git] Getting files in ${this.repo} ${this.branch} in paths: ${paths.join(', ')}`);

    const result = [];
    for await (const path of paths) {
      const resp = await command('gh', [
        'api',
        `repos/${this.repo}/contents/${path}?ref=${this.branch}`,
        '--jq',
        '.content',
      ]);
      result.push(Buffer.from(resp, 'base64').toString());
    }

    return result;
  }

  /**
   * Update files in the repository.
   *
   * @returns new tree sha
   */
  async updateFiles(baseTree: string, paths: string[], contents: string[]): Promise<string> {
    assert(paths.length === contents.length, 'Paths and contents must have the same length');
    verbose(`[git] Updating files in ${this.repo} ${this.branch} in paths: ${paths.join(', ')}`);

    const contentShas = [];
    for await (const content of contents) {
      const sha = await command('gh', [
        'api',
        '-X',
        'POST',
        `repos/${this.repo}/git/blobs`,
        '-f',
        `content=${Buffer.from(content).toString('base64')}`,
        '-f',
        `encoding=base64`,
        '--jq',
        '.sha',
      ]);
      contentShas.push(sha);
    }

    const apis = [];
    for (let i = 0; i < paths.length; i++) {
      apis.push('-f', `tree[][path]=${paths[i]}`);
      apis.push('-f', `tree[][mode]=100644`);
      apis.push('-f', `tree[][type]=blob`);
      apis.push('-f', `tree[][sha]=${contentShas[i]}`);
    }

    return await command('gh', [
      'api',
      '-X',
      'POST',
      `repos/${this.repo}/git/trees`,
      '-f',
      `base_tree=${baseTree}`,
      ...apis,
      '--jq',
      '.sha',
    ]);
  }

  /**
   * Create a new commit in the repository.
   *
   * @returns new commit sha
   */
  async createCommit(baseTree: string, tree: string, message: string): Promise<string> {
    verbose(`[git] Creating commit in ${this.repo} ${this.branch} with message: ${message}`);

    return await command('gh', [
      'api',
      '-X',
      'POST',
      `repos/${this.repo}/git/commits`,
      '-f',
      `message='${message}'`,
      '-f',
      `tree=${tree}`,
      '-f',
      `parents[]=${baseTree}`,
      '--jq',
      '.sha',
    ]);
  }

  async hasTag(tag: string, checkRemote: boolean): Promise<boolean> {
    try {
      const local = await command('git', ['tag', '-l', tag]);
      if (local.includes(tag)) {
        return true;
      }

      if (checkRemote) {
        const remote = await command('gh', ['api', `repos/${this.repo}/git/ref/tags/${tag}`]);
        if (remote.includes(`"refs/tags/${tag}"`)) {
          return true;
        }
      }
    } catch (error) {
      verbose(`[git] Tag ${tag} not found: ${error}`);
    }

    return false;
  }
}
