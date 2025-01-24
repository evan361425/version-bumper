import { BumperError } from './errors.js';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function breaker(value: string, length = 1, separator = '\n'): string[] {
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    const index = value.indexOf(separator);
    result.push(value.substring(0, index));
    value = value.substring(index + separator.length);
  }
  result.push(value);

  return result;
}

export function removeMarkdownLinks(body: string): string {
  const linker = new RegExp(`\\[([^\\]]+)\\]\\([^\\)\\s]+\\)`, 'mi');
  let result = '';

  do {
    const index = body.search(linker);
    if (index === -1) {
      result += body;
      break;
    }

    const [hit, text] = linker.exec(body.substring(index)) as unknown as [string, string];
    const rest = index + hit.length;

    result += body.substring(0, index) + text;
    body = body.substring(rest);
  } while (body !== '');

  return result;
}

export class SortField {
  constructor(
    readonly ignoreLeadingCase: boolean,
    readonly dictionaryOrder: boolean,
    readonly ignoreCase: boolean,
    readonly monthSort: boolean,
    readonly numericSort: boolean,
    readonly field1: number,
    readonly field2: number,
    readonly column1?: number,
    readonly column2?: number,
  ) {}

  static fromString(v: string): SortField {
    const [v1, v2] = v.split(',');
    if (!v1) {
      throw new BumperError(`sort field should have at least one field, we got: ${v}`);
    }

    const [field1s, setting1] = v1.split('.');
    const [field2s, setting2] = (v2 ?? '').split('.');
    if (!field1s) {
      throw new BumperError(`sort field should have at least one field, we got: ${v}`);
    }

    const oneIfNotNumber = (v: string): number => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    };
    const parseColumn = (v: string): number | undefined => {
      const match = /^[0-9]+/.exec(v);
      return match ? parseInt(match[0], 10) : undefined;
    };
    const parseOption = (v: string): string | undefined => {
      const match = /^[0-9]*([bdfMn]+)/.exec(v);
      return match ? match[1] : undefined;
    };

    const field1 = oneIfNotNumber(field1s);
    const field2 = field2s ? oneIfNotNumber(field2s) : field1;

    const column1 = setting1 ? parseColumn(setting1) : undefined;
    const column2 = setting2 ? parseColumn(setting2) : undefined;

    const option1 = setting1 ? parseOption(setting1) : undefined;
    const option2 = setting2 ? parseOption(setting2) : undefined;
    const option = (option1 && option2 ? option2 : option1 || option2) ?? 'n';

    return new SortField(
      option.includes('b'),
      option.includes('d'),
      option.includes('f'),
      option.includes('M'),
      option.includes('n'),
      field1,
      field2,
      column1,
      column2,
    );
  }

  firstIsGreaterThanSecond(a: string[], b: string[]): boolean {
    let v1 = a[this.field1 - 1];
    let v2 = b[this.field2 - 1];
    if (!v1) return false;
    if (!v2) return true;

    if (this.numericSort) {
      const match1 = /[0-9]+/.exec(v1);
      const match2 = /[0-9]+/.exec(v2);
      if (!match1) return false;
      if (!match2) return true;

      const n1 = parseInt(match1[0], 10);
      const n2 = parseInt(match2[0], 10);
      return n1 > n2;
    }

    if (this.ignoreCase) {
      v1 = v1.toLowerCase();
      v2 = v2.toLowerCase();
    }

    if (this.ignoreLeadingCase) {
      v1 = v1.trimStart();
      v2 = v2.trimStart();
    }

    if (this.monthSort) {
      const idx1 = months.indexOf(v1);
      const idx2 = months.indexOf(v2);

      return idx1 > idx2;
    }

    if (this.dictionaryOrder) {
      const match1 = /[ a-zA-Z]+/.exec(v1);
      const match2 = /[ a-zA-Z]+/.exec(v2);
      if (!match1) return false;
      if (!match2) return true;

      v1 = match1[0];
      v2 = match2[0];
    }

    return v1 > v2;
  }
}
