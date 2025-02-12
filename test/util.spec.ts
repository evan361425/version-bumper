import assert from 'node:assert';
import { describe, it } from 'node:test';
import { SortField } from '../lib/util.js';

void describe('Util', function () {
  void it('sort release candidate', async function () {
    const fields = [
      SortField.fromString('1,1'), // major
      SortField.fromString('2,2'), // minor
      SortField.fromString('3,3'), // patch
      SortField.fromString('4,4'), // rc
    ];

    function compare(s1: string, s2: string): number {
      const f1 = s1.split('.');
      const f2 = s2.split('.');

      let index = 1;
      for (const field of fields) {
        if (field.firstIsGreaterThanSecond(f1, f2)) {
          return index;
        }
        index++;
      }
      return -1;
    }

    assert.strictEqual(compare('v0.0.0-rc.1', 'v0.0.0-rc.2'), -1);
    assert.strictEqual(compare('v0.0.0-rc.1', 'v0.0.1-rc.1'), -1);
    assert.strictEqual(compare('v0.0.0-rc.1', 'v0.1.0-rc.1'), -1);
    assert.strictEqual(compare('v0.0.0-rc.1', 'v1.0.0-rc.1'), -1);
    assert.strictEqual(compare('v1.0.0-rc.1', 'v0.0.0-rc.1'), 1);
    assert.strictEqual(compare('v0.1.0-rc.1', 'v0.0.0-rc.1'), 2);
    assert.strictEqual(compare('v0.0.1-rc.1', 'v0.0.0-rc.1'), 3);
    assert.strictEqual(compare('v0.0.0-rc.2', 'v0.0.0-rc.1'), 4);
  });
});
