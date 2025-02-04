import assert from 'node:assert';
import { describe, it } from 'node:test';
import { HookCommand } from '../lib/factories.js';

void describe('Hook', function () {
  void it('template should be same', async function () {
    const cmd = new HookCommand(`echo '{"version.noPrefix"}'`);
    const result = await cmd.run(
      { version: 'v1.2.3', versionLast: 'v1.2.2', versionName: 'name', repo: 'repo', ticket: 'ticket' },
      0,
    );

    assert.strictEqual(result, '1.2.3\n');
  });
});
