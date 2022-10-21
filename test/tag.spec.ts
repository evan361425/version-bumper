import { expect } from 'chai';
import { Tag } from '../lib/tag.js';

describe('Tag', function () {
  it('should create from changelog', function () {
    const testData = [
      [
        '[v3.7.3-rc1] - 2022-08-30\n\nabc\n\ndef',
        'v3.7.3-rc1',
        '2022-08-30',
        'abc\n\ndef',
      ],
      ['[3.7.3]\n\nabc\n\ndef', '3.7.3', '', 'abc\n\ndef'],
      ['3.7.3-some-123', '3.7.3-some-123', '', ''],
    ];

    for (const data of testData) {
      const [src, ver, date, body] = data;
      const tag = Tag.fromString(src ?? '');

      expect(tag.key).eq(ver);
      expect(tag.createdDate).eq(date);
      expect(tag.body).eq(body);
    }
  });
});
