import { Config } from './config.js';
import { info } from './logger.js';
import { Tag } from './tag.js';

export class Changelog {
  readonly tags: Tag[];

  readonly header: string;

  readonly firstTagKey: string;

  constructor(origin: string) {
    this.tags = [Tag.veryFirst()];
    this.header = Config.instance.changelogInfo.header;
    this.firstTagKey = Tag.veryFirstTagKey;
    if (typeof origin !== 'string' || origin === '') {
      info('[changelog] No need parse');
      return;
    }

    info('[changelog] Start parsing');

    const headerIdx = origin.search(/\n## \[/);
    const footerIdx = origin.search(/\n\[[^\]]+\]:/);

    if (headerIdx === -1) {
      this.header = origin;
      info('[changelog] Not found any tags');
      return;
    }

    // parse tags
    this.header = origin.substring(0, headerIdx).trim();
    this.tags = origin
      .substring(headerIdx, footerIdx === -1 ? undefined : footerIdx)
      .split('\n## ')
      .map((e) => e.trim())
      .filter((e) => Boolean(e))
      .map((e) => Tag.fromString(e));
    this.tags.length === 0 && this.tags.push(Tag.veryFirst());
    this.firstTagKey = this.tags[0]?.key ?? Tag.veryFirstTagKey;

    // parse footer links
    if (footerIdx === -1) {
      info('[changelog] Not found footer');
      return;
    }
    origin
      .substring(footerIdx)
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

  get firstIsUnreleased(): boolean {
    return this.firstTagKey.toLowerCase() === Tag.veryFirstTagKey.toLowerCase();
  }

  get latestTag(): Tag | undefined {
    if (!this.firstIsUnreleased) {
      return this.tags[0];
    }

    return this.tags.find((tag) => {
      return tag.key.toLowerCase() !== this.firstTagKey.toLowerCase();
    });
  }

  getTagByKey(key: string): Tag | undefined {
    key = key.toLowerCase();

    return this.tags.find((tag) => tag.key.toLowerCase() === key);
  }

  addTag(tag: Tag) {
    if (this.getTagByKey(tag.key)) {
      throw new Error(`tag ${tag.key} exist, should not add again`);
    }

    const first = this.getTagByKey(this.firstTagKey);
    first && first.setDiffLink(tag.key, 'HEAD');

    tag.setDiffLink(this.latestTag?.key).setBody(tag.body).setIsNew(true);

    this.tags.splice(this.firstIsUnreleased ? 1 : 0, 0, tag);

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
        body.substring(index),
      ) as unknown as [string, string, string, string];
      info(`[auto-links] hit(${hit}), target(${target}), num(${num})`);
      const rest = index + hit.length;
      const isInLink = inLink.test(body.substring(rest));

      result += body.substring(0, isInLink ? rest : index);

      // only add link if not in link
      if (!isInLink) {
        info(`[auto-links] is not in link`);
        const rawLink = casedLinks[target.toLowerCase()];
        const link = rawLink?.replace(/{num}/g, num ?? '');
        const origin = num ? target.concat(num) : target;
        result += `${prefix}[${origin}](${link})`;
      }

      body = body.substring(rest);
    } while (body !== '');

    return result;
  }
}
