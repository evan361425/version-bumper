import assert from 'node:assert';
import { after, afterEach, before, describe, it } from 'node:test';
import { mockCommandResponse, resetMocked } from '../lib/command.js';
import { askForWantedVars } from '../lib/config-loader.js';
import { Config } from '../lib/config.js';
import { startDebug, startVerbose, stopDebug } from '../lib/io.js';

void describe('Config Loader', function () {
  before(() => {
    startDebug();
    startVerbose();
  });

  after(() => {
    stopDebug();
  });

  afterEach(() => {
    resetMocked();
  });

  void it('ask for wanted vars by TagFrom', async function () {
    const cfg = new Config({
      process: {
        askToChooseTag: false,
        checkTag: true,
        wantedTicket: false,
        useSemanticTag: true,
        useReleaseCandidateTag: true,
      },
    });

    mockCommandResponse('v1.1.0\nv1.1.1-rc.1\n1.1.2-rc.2');
    mockCommandResponse('v1.1.0\nv1.1.1-rc.1\n1.1.2-rc.2');
    const vars = await askForWantedVars([], cfg);

    assert.strictEqual(vars.version, 'v1.1.1');
    assert.strictEqual(vars.versionLast, 'v1.1.0');
  });
});
