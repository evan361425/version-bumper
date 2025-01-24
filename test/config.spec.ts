import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { mockCommandResponse, resetMocked } from '../lib/command.js';
import { Config } from '../lib/config.js';
import { mockAskContent, startDebug } from '../lib/io.js';

void describe('Config', function () {
  afterEach(() => {
    resetMocked();
  });

  void it('lower version', async function () {
    const cfg = new Config({ repo: { link: 'https://github.com/a/b' } });

    startDebug();

    mockAskContent('v1.2.3');
    mockCommandResponse('v1.2.4');

    await assert.rejects(cfg.init([]), {
      name: 'BumperError',
      message: 'Version v1.2.3 is not greater than the last version v1.2.4',
    });
  });
});
