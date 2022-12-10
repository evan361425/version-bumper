import { BaseBranchInfo, Config } from './config.js';

type TagConfig = {
  createdDate: string;
  link: string;
  ticket: string;
};

export class Tag {
  readonly key: string;
  body: string;
  readonly ticket?: string;
  link?: string;
  createdDate!: string;

  constructor(key: string, body: string, config: Partial<TagConfig> = {}) {
    this.key = key.trim();
    this.body = body.trim();
    this.ticket = config.ticket;

    this.setCreatedDate(config.createdDate);
    this.setLink(config.link);
  }

  static fromString(value: string): Tag {
    const raw = value.trim();
    const splitter = raw.indexOf('\n');

    const header = raw.substring(0, splitter === -1 ? undefined : splitter);
    // for example: [v3.7.3-rc1] - 2022-08-30, should get `v3.7.3-rc1` & `2022-08-30`
    const vd = /\[?([^\[\]]+)\]?[ \-]*([0-9]{4}-[0-9]{2}-[0-9]{2})?/;
    const [, version, date] = vd.exec(header) ?? ['', header];

    return new Tag(
      version ?? '',
      splitter === -1 ? '' : raw.substring(splitter + 1).trim(),
      { createdDate: date ?? '' }
    );
  }

  static veryFirst() {
    return new Tag(this.veryFirstTagKey, 'Please check git diff.', {
      createdDate: '',
      link: Config.instance.repoLink + '/commits',
    });
  }

  static readonly veryFirstTagKey = 'Unreleased';

  getPrTitle(branch: BaseBranchInfo) {
    return this.ticket
      ? `${this.ticket} - ${this.key}(${branch.name})`
      : `${this.key}(${branch.name})`;
  }

  get parsedBody() {
    let body = this.body;

    if (this.ticket && !this.body.includes(this.ticket)) {
      const pre = Config.instance.changelogInfo.ticketPrefix + this.ticket;
      body = `${pre}\n\n${this.body}`;
    }
    return body
      .replace(/{version}/g, this.key)
      .replace(/{stage}/g, Config.instance.stage ?? '')
      .replace(/{ticket}/g, this.ticket ?? '');
  }

  setLink(link?: string): Tag {
    if (link && link.startsWith('https://')) {
      this.link = link;
    }

    return this;
  }

  setCreatedDate(createdDate?: string): Tag {
    if (createdDate === undefined) {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = '0'.concat((now.getMonth() + 1).toString()).slice(-2);
      const date = '0'.concat(now.getDate().toString()).slice(-2);
      this.createdDate = `${year}-${month}-${date}`;
    } else {
      this.createdDate = createdDate;
    }

    return this;
  }

  setDiffLink(ref?: string, base?: string) {
    base = base ? base : this.key;
    if (ref) {
      this.setLink(Config.instance.repoLink + '/compare/' + base + '...' + ref);
    } else {
      this.setLink(Config.instance.repoLink + '/commits/' + this.key);
    }

    return this;
  }

  toString(): string {
    const header = this.link ? `[${this.key}]` : this.key;
    const date = this.createdDate ? ` - ${this.createdDate}` : '';

    return header + date + '\n\n' + this.parsedBody;
  }

  toLink(): string {
    return this.link ? `[${this.key.toLowerCase()}]: ${this.link}` : '';
  }
}
