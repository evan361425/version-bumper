import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Tag } from '../lib/tag.js';

void describe('Tag', function () {
  void it('should create from changelog', function () {
    const testData = [
      ['[v3.7.3-rc1] - 2022-08-30\n\nabc\n\ndef', 'v3.7.3-rc1', '2022-08-30', 'abc\n\ndef'],
      ['[3.7.3]\n\nabc\n\ndef', '3.7.3', '', 'abc\n\ndef'],
      ['3.7.3-some-123', '3.7.3-some-123', '', ''],
    ];

    for (const data of testData) {
      const [src, ver, date, body] = data;
      const tag = Tag.fromString(src ?? '');

      assert.deepStrictEqual(tag.key, ver);
      assert.deepStrictEqual(tag.createdDate, date);
      assert.deepStrictEqual(tag.body, body);
    }
  });
});
