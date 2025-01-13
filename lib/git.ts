import assert from 'node:assert';
import { command } from './command';
import { IAutoLink } from './interfaces';
import { verbose } from './logger';

export class GitCommit {
  protected _pr: string | undefined;
  protected _scope: string | undefined;
  protected _title: string | undefined;
  protected _titleFull: string | undefined;

  constructor(
    readonly hashFull: string,
    readonly message: string,
    readonly author: string,
  ) {}

  get hash(): string {
    return this.hashFull.substring(0, 7);
  }

  get title(): string {
    if (this._title) return this._title;

    const idx = this.titleFull.indexOf(':');
    return (this._title = idx === -1 ? this.titleFull : this.titleFull.substring(idx + 1).trim());
  }

  get titleFull(): string {
    return (this._titleFull ??= this.message.split('\n')[0]!);
  }

  get pr(): string {
    return (this._pr ??= this.title.match(/\(?#(\d+)\)/)?.[1] ?? this.hash);
  }

  get scope(): string {
    return (this._scope ??= this.title.match(/^\w+\((\w+)\)/)?.[1] ?? '');
  }

  parseTicket(autoLinks: IAutoLink[]): string {
    for (const link of autoLinks) {
      if (link.matches.some((m) => new RegExp(m).test(this.title))) {
        return this.title.match(/\(?#(\d+)\)/)?.[1] ?? '';
      }
    }

    return '';
  }
}

export class GitDatabase {
  constructor(
    /**
     * Repository name in the format of `owner/repo`.
     */
    readonly repo: string,
    /**
     * Source branch name.
     *
     * This branch will be used to create new branches.
     */
    readonly branch: string,
  ) {}

  /**
   * Create a new branch from the `branch`.
   */
  async createBranch(name: string): Promise<string> {
    const sha = await command('gh', ['api', `repos/${this.repo}/git/refs/heads/${this.branch}`, '--jq', '.object.sha']);
    verbose(`[git] Creating branch '${name}' in ${this.repo}/${this.branch} (${sha})`);

    return await command('gh', [
      'api',
      '-X',
      'POST',
      `repos/${this.repo}/git/refs`,
      '-f',
      `ref='refs/heads/${name}'`,
      '-f',
      `sha='${sha}'`,
      '--jq',
      '.object.sha',
    ]);
  }

  /**
   * Fetch files from the repository.
   *
   * @returns Contents (base64 decoded) of the files.
   */
  async fetchFiles(paths: string[]): Promise<string[]> {
    verbose(`[git] Getting files in ${this.repo} (${this.branch}): ${paths.join(', ')}`);

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
    verbose(`[git] Updating files in ${this.repo} (${this.branch}): ${paths.join(', ')}`);

    const contentShas = [];
    for await (const content of contents) {
      const sha = await command('gh', [
        'api',
        '-X',
        'POST',
        `repos/${this.repo}/git/blobs`,
        '-f',
        `content='${Buffer.from(content).toString('base64')}'`,
        '-f',
        `encoding='base64'`,
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
    verbose(`[git] Creating commit in ${this.repo} (${this.branch}): ${message}`);

    return await command('gh', [
      'api',
      '-X',
      'POST',
      `repos/${this.repo}/git/commits`,
      '-f',
      `message='${message}'`,
      '-f',
      `tree='${tree}'`,
      '-f',
      `parents[]=${baseTree}`,
      '--jq',
      '.sha',
    ]);
  }
}
