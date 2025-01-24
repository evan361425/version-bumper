import { writeFileSync } from 'node:fs';
import { Repo } from './factories.js';
import { readFile } from './io.js';
import { log, verbose } from './logger.js';
import { breaker } from './util.js';

const DEFAULT_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

export class ChangelogIO {
  protected _content?: ChangelogContent;

  constructor(
    readonly src: string,
    readonly dst: string,
  ) {}

  get content(): ChangelogContent {
    return (this._content ??= ChangelogContent.fromString(readFile(this.src)));
  }

  bump(repo: Repo, data: { key: string; link: string; content: string }) {
    const section = ChangelogSection.fromString(data.content);
    section.link = data.link;
    verbose(`[changelog] bumping ${data.key} with header: ${section.header}`);
    verbose(`[changelog] body: ${section.body}`);

    this.content.bump(repo, data.key);
    this.content.prepend(section);

    this.write();
  }

  /**
   * Write content to the destination file.
   */
  write(): void {
    writeFileSync(this.dst, this.content.toString());
  }
}

class ChangelogContent {
  constructor(
    readonly header: string,
    readonly suffix: string,
    readonly footers: ChangelogFooter[],
    readonly sections: ChangelogSection[],
    readonly unreleased?: ChangelogSection,
  ) {}

  static fromString(content: string): ChangelogContent {
    const headerIdx = content.search(/\n## /);
    const footerIdx = content.search(/\n\[[^\]]+\]:/);

    let footers: ChangelogFooter[] = [];
    let suffix = '';
    if (footerIdx !== -1) {
      const footer = content.substring(footerIdx).trim();
      footers = footer.split('\n').map(ChangelogFooter.fromString).filter(Boolean) as ChangelogFooter[];
      const unreleasedIdx = footers.findIndex((footer) => footer.key.toLowerCase() === 'unreleased');
      footers = footers.filter((_, idx) => idx !== unreleasedIdx);

      const lastIdx = footer.search(/\n\n/);
      suffix = lastIdx === -1 ? '' : footer.substring(lastIdx).trim();
    } else {
      verbose('[changelog] No footers found');
    }

    if (headerIdx === -1) {
      log('[changelog] No sections found');
      return new ChangelogContent(DEFAULT_HEADER, suffix, footers, []);
    }

    const header = content.substring(0, headerIdx).trim();
    const sections = content
      .substring(headerIdx, footerIdx === -1 ? undefined : footerIdx)
      .split('\n## ')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => ChangelogSection.fromString(e));

    let unreleased: ChangelogSection | undefined;
    if (sections[0]?.linkedKey?.toLowerCase() === 'unreleased') {
      unreleased = sections.shift();
    }

    return new ChangelogContent(header, suffix, footers, sections, unreleased);
  }

  bump(repo: Repo, key: string): void {
    if (this.unreleased) {
      this.unreleased.link = repo.compareLink({ from: key });
    }
  }

  prepend(section: ChangelogSection) {
    this.sections.splice(0, 0, section);
    this.footers.splice(0, 0, new ChangelogFooter(section.linkedKey, section.link!));
  }

  toString(): string {
    const sections = this.sections
      .map((section) => section.toString().trim())
      .filter(Boolean)
      .join('\n\n');
    const footers = this.footers
      .map((footer) => footer.toString().trim())
      .filter(Boolean)
      .join('\n');

    return [
      this.header.trim(),
      this.unreleased?.toString(),
      sections,
      (this.unreleased ? `[unreleased]: ${this.unreleased!.link}\n` : '') + footers,
      this.suffix.trim(),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}

class ChangelogSection {
  link?: string;

  protected _linkedKey?: string;

  constructor(
    readonly header: string,
    readonly body: string,
  ) {}

  static fromString(content: string): ChangelogSection {
    const [header, body] = breaker(content.trim());

    return new ChangelogSection((header ?? '').trim(), (body ?? '').trim());
  }

  get linkedKey(): string {
    if (this._linkedKey) return this._linkedKey;

    // for example: [v3.7.3-rc1] - 2022-08-30, should get `v3.7.3-rc1`
    const match = /\[([^\[\]]+)\]( |$)/.exec(this.header);
    return (this._linkedKey ??= match?.[1] ?? '');
  }

  set linkedKey(value: string) {
    this._linkedKey = value;
  }

  toString(): string {
    return '## ' + this.header + '\n\n' + this.body;
  }
}

class ChangelogFooter {
  constructor(
    readonly key: string,
    public link: string,
  ) {}

  static fromString(content: string): ChangelogFooter | undefined {
    const match = /\[([^\]]+)\]: *([^\s]+)/.exec(content);
    if (!match) {
      return undefined;
    }

    return new ChangelogFooter(match[1]!, match[2]!);
  }

  toString(): string {
    return `[${this.key}]: ${this.link}`;
  }
}
