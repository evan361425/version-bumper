import { Config } from './config.js';
import { info } from './logger.js';
import { Tag } from './tag.js';

export class Changelog {
  tags: Tag[] = [];

  header: string;

  constructor(origin: string) {
    this.header = Config.instance.changelogInfo.header;
    if (typeof origin !== 'string' || origin === '') {
      info('[changelog] No need parse');
      return;
    }

    info('[changelog] Start parsing');

    const headerSplitter = origin.toLowerCase().indexOf('\n## [unreleased]');
    const footerSplitter = origin.toLowerCase().lastIndexOf('[unreleased]: ');

    const header = origin.substring(0, headerSplitter).trim();
    if (header) this.header = header;

    // parse body
    this.tags = origin
      .substring(
        headerSplitter,
        footerSplitter === -1 ? undefined : footerSplitter
      )
      .split('## ')
      .map((e) => e.trim())
      .filter((e) => Boolean(e))
      .map((e) => Tag.fromString(e));
    if (this.tags.length === 0) {
      this.tags.push(Tag.veryFirst());
    }

    // parse footer links
    origin
      .substring(footerSplitter)
      .trim()
      .split('\n')
      .forEach((e) => {
        // [tag]: link
        const [key, link] = e.split(']: ');
        if (key && link) {
          this.getTagByKey(key.substring(1))?.setLink(link);
        }
      });
  }

  get latestTag(): Tag | undefined {
    return this.tags.find((tag) => tag.key.toLowerCase() !== 'unreleased');
  }

  getTagByKey(key: string): Tag | undefined {
    key = key.toLowerCase();

    return this.tags.find((tag) => tag.key.toLowerCase() === key);
  }

  addTag(tag: Tag) {
    if (this.getTagByKey(tag.key)) {
      throw new Error(`tag ${tag.key} exist, should not add again`);
    }

    const unreleased = this.getTagByKey('unreleased');
    unreleased && unreleased.setDiffLink('HEAD', tag.key);

    tag.body = Changelog.fitAutoLinks(tag.body, Config.instance.autoLinks);
    tag.setDiffLink(this.latestTag?.key);

    this.tags.splice(unreleased ? 1 : 0, 0, tag);

    return this;
  }

  toString(): string {
    const content = [this.header, ...this.tags.map((tag) => tag.toString())];

    const footer = this.tags
      .map((tag) => tag.toLink())
      .filter((link) => Boolean(link))
      .join('\n');

    return content.join('\n\n## ').trim() + '\n\n' + footer + '\n';
  }

  static fitAutoLinks(body: string, links: Record<string, string>): string {
    if (!body || Object.keys(links).length === 0) return body;

    const casedLinks: Record<string, string> = {};
    Object.entries(links).map(([k, v]) => (casedLinks[k.toLowerCase()] = v));

    const prefixes = Object.keys(casedLinks).join('|');
    // patterns must start with whitespace/newline or in first char of line
    const linker = new RegExp(`(^|[\\n\\r\\s]{1})(${prefixes})(\\d*)?`, 'mi');
    // must not in the link
    const inLink = new RegExp(`^[^\\[]*\\]`);
    let result = '';

    do {
      const index = body.search(linker);
      if (index === -1) {
        result += body;
        break;
      }

      const [hit, prefix, target, num] = linker.exec(
        body.substring(index)
      ) as unknown as [string, string, string, string];
      info(`[auto-links] hit(${hit}), target(${target}), num(${num})`);
      const rest = index + hit.length;
      const isInLink = inLink.test(body.substring(rest));

      result += body.substring(0, isInLink ? rest : index);

      // only add link if not in link
      if (!isInLink) {
        info(`[auto-links] is not in link`);
        const rawLink = casedLinks[target.toLowerCase()];
        const link = rawLink?.replace(/<num>/g, num ?? '');
        const origin = num ? target.concat(num) : target;
        result += `${prefix}[${origin}](${link})`;
      }

      body = body.substring(rest);
    } while (body !== '');

    return result;
  }
}
