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

  constructor(readonly file: string) {}

  get content(): ChangelogContent {
    return (this._content ??= ChangelogContent.fromString(readFile(this.file)));
  }

  bump(repo: Repo, data: { key: string; link: string; content: string }) {
    const section = ChangelogSection.fromString(data.content);
    section.link = data.link;
    log(`[changelog] bumping ${data.key} with content:
${section.header}

${section.body}`);

    this.content.bump(repo, data.key);
    this.content.prepend(section);

    this.write();
  }

  /**
   * Write content to the destination file.
   */
  write(): void {}
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
}

// export class Changelog {
//   get firstIsUnreleased(): boolean {
//     return this.firstTagKey.toLowerCase() === Tag.veryFirstTagKey.toLowerCase();
//   }

//   get latestTag(): Tag | undefined {
//     if (!this.firstIsUnreleased) {
//       return this.tags[0];
//     }

//     return this.tags.find((tag) => {
//       return tag.key.toLowerCase() !== this.firstTagKey.toLowerCase();
//     });
//   }

//   getTagByKey(key: string): Tag | undefined {
//     key = key.toLowerCase();

//     return this.tags.find((tag) => tag.key.toLowerCase() === key);
//   }

//   addTag(tag: Tag) {
//     if (this.getTagByKey(tag.key)) {
//       throw new Error(`tag ${tag.key} exist, should not add again`);
//     }

//     const first = this.getTagByKey(this.firstTagKey);
//     first && first.setDiffLink(tag.key, 'HEAD');

//     tag.setDiffLink(this.latestTag?.key).setBody(tag.body).setIsNew(true);

//     this.tags.splice(this.firstIsUnreleased ? 1 : 0, 0, tag);

//     return this;
//   }

//   toString(): string {
//     const content = [
//       this.header,
//       ...this.tags.map((tag) => {
//         let body = tag.toString();
//         if (tag.isNew) {
//           const ignoreStart = '<!-- bumper-changelog-ignore-start -->';
//           const ignoreEnd = '<!-- bumper-changelog-ignore-end -->';
//           while (tag) {
//             const start = body.search(ignoreStart);
//             if (start === -1) break;

//             const end = body.search(ignoreEnd);
//             const r = end === -1 ? '' : body.substring(end + ignoreEnd.length) + '\n';
//             body = body.substring(0, start).trim() + r.trim();
//           }
//         }
//         return body;
//       }),
//     ];

//     const footer = this.tags
//       .map((tag) => tag.toLink())
//       .filter((link) => Boolean(link))
//       .join('\n');

//     const result = content.join('\n\n## ').trim() + '\n\n' + footer + '\n';
//     return this.redundant ? `${result}\n${this.redundant}\n` : result;
//   }
// }
