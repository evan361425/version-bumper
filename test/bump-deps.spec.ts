import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import api from '../lib/api.js';
import { Config } from '../lib/config.js';
import { mockCommand, mockFile, startDebug, stopDebug } from '../lib/util.js';
import { resetEnv, setupEnv } from './warm-up.js';

void describe('Bump deps', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    setupEnv();
    mock.restoreAll();
  });

  void it('example', async function () {
    const config = new Config({
      deps: {
        ignored: ['ignored*', 'exactIgnored'],
        saveExact: true,
        latestDeps: ['latest*', 'exactLatest'],
        preCommands: ['do some pre thing', ['do', 'some', 'pre thing']],
        postCommands: ['do some post thing', ['do', 'some', 'post thing']],
        dev: {
          preCommands: [],
        },
      },
    } as unknown as never);

    Config.instance = config;
    mockCommand(
      Promise.resolve(`Package Current Wanted Latest
    ignored1   1.0.0    1.1.0    2.0.0
    ignored2   1.0.0    1.1.0    2.0.0
    exactIgnored   1.0.0    1.1.0    2.0.0
    latest1   1.0.0    1.1.0    2.0.0
    latest2   1.0.0    1.1.0    2.0.0
    exactLatest   1.0.0    1.1.0    2.0.0
    dep1   1.0.0    1.1.0    2.0.0
    dep2   1.0.0    1.1.0    2.0.0
    devDep1   1.0.0    1.1.0    2.0.0
    devDep2   1.0.0    1.1.0    2.0.0
    `),
    );
    const pkg = JSON.stringify({
      devDependencies: {
        ignored2: '1.0.0',
        latest2: '1.0.0',
        devDep1: '1.0.0',
        devDep2: '1.0.0',
      },
    });
    mockFile(pkg);
    mockFile(pkg);

    const log = mock.method(console, 'log');
    startDebug();
    await api.deps();
    stopDebug();

    const calls = log.mock.calls.map((call) => call.arguments[0]);
    const call1 = JSON.parse(calls.shift()).deps;
    assert.deepStrictEqual(call1, {
      allLatest: false,
      appendOnly: false,
      devInfo: {
        oneByOne: false,
        preCommands: [],
        postCommands: ['do some post thing', ['do', 'some', 'post thing']],
      },
      ignored: ['ignored*', 'exactIgnored'],
      latestDeps: ['latest*', 'exactLatest'],
      postCommands: ['do some post thing', ['do', 'some', 'post thing']],
      preCommands: ['do some pre thing', ['do', 'some', 'pre thing']],
      saveExact: false,
    });

    const pre = ["[cmd]: do 'some' 'pre' 'thing'", "[cmd]: do 'some' 'pre thing'"];
    const post = ["[cmd]: do 'some' 'post' 'thing'", "[cmd]: do 'some' 'post thing'"];

    assert.deepStrictEqual(calls.filter(Boolean), [
      "[cmd]: npm 'outdated'",
      '========== Start Dependencies ==========\n',
      '[dep] start getting repo links',
      "[cmd]: npm 'repo' 'latest1' '--no-browser'",
      "[cmd]: npm 'repo' 'exactLatest' '--no-browser'",
      "[cmd]: npm 'repo' 'dep1' '--no-browser'",
      "[cmd]: npm 'repo' 'dep2' '--no-browser'",
      ...[
        ['latest1', '2.0.0'],
        ['exactLatest', '2.0.0'],
        ['dep1', '1.1.0'],
        ['dep2', '1.1.0'],
      ]
        .map((p) => [
          `${p[0]} 1.0.0 -> ${p[1]}`,
          ...pre,
          `[cmd]: npm 'install' '--registry=https://registry.npmjs.org/' '${p[0]}@${p[1]}'`,
          ...post,
        ])
        .flat(),
      '\n========== Start Dev Dependencies ==========\n',
      '[dep] start getting repo links',
      "[cmd]: npm 'repo' 'latest2' '--no-browser'",
      "[cmd]: npm 'repo' 'devDep1' '--no-browser'",
      "[cmd]: npm 'repo' 'devDep2' '--no-browser'",
      ...[
        ['latest2', '2.0.0'],
        ['devDep1', '1.1.0'],
        ['devDep2', '1.1.0'],
      ].map((p) => `${p[0]} 1.0.0 -> ${p[1]}`),
      JSON.stringify(
        {
          devDependencies: {
            ignored2: '1.0.0',
            latest2: '2.0.0',
            devDep1: '1.1.0',
            devDep2: '1.1.0',
          },
        },
        undefined,
        2,
      ),
      "[cmd]: npm 'install' '--registry=https://registry.npmjs.org/'",
      ...post,
      `latest1\t1.0.0\t2.0.0\tundefined
exactLatest\t1.0.0\t2.0.0\tundefined
dep1\t1.0.0\t1.1.0\tundefined
dep2\t1.0.0\t1.1.0\tundefined
latest2\t1.0.0\t2.0.0\tundefined
devDep1\t1.0.0\t1.1.0\tundefined
devDep2\t1.0.0\t1.1.0\tundefined
`,
    ]);
  });
});
