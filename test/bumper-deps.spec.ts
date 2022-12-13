/* eslint-disable mocha/no-hooks-for-single-case */
import { expect } from 'chai';
import Sinon from 'sinon';
import api from '../lib/api.js';
import { Config } from '../lib/config.js';
import { mockCommand, mockFile, startDebug, stopDebug } from '../lib/helper.js';
import { resetEnv, setupEnv } from './warm-up.js';

describe('Bump deps', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    Sinon.restore();
    setupEnv();
  });

  it('example', async function () {
    const config = new Config({
      deps: {
        ignored: ['ignored*', 'exactIgnored'],
        output: 'output',
        saveExact: true,
        latestDeps: ['latest*', 'exactLatest'],
        preCommands: ['do some pre thing', ['do', 'some', 'pre thing']],
        postCommands: ['do some post thing', ['do', 'some', 'post thing']],
        dev: {
          preCommands: [],
        },
      },
    } as unknown as never);

    Sinon.stub(Config, 'instance').get(() => config);
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

    const stdout = Sinon.stub(console, 'log');
    startDebug();
    await api.bumpDeps();
    stopDebug();

    const calls = stdout.getCalls().map((call) => call.args[0]);
    const call1 = JSON.parse(calls.shift()).deps;
    expect(call1).to.eql({
      allLatest: false,
      appendOnly: false,
      devInfo: {
        oneByOne: false,
        preCommands: [],
        postCommands: ['do some post thing', ['do', 'some', 'post thing']],
      },
      ignored: ['ignored*', 'exactIgnored'],
      latestDeps: ['latest*', 'exactLatest'],
      output: 'output',
      postCommands: ['do some post thing', ['do', 'some', 'post thing']],
      preCommands: ['do some pre thing', ['do', 'some', 'pre thing']],
      saveExact: false,
    });

    const pre = [
      "[cmd]: do 'some' 'pre' 'thing'",
      "[cmd]: do 'some' 'pre thing'",
    ];
    const post = [
      "[cmd]: do 'some' 'post' 'thing'",
      "[cmd]: do 'some' 'post thing'",
    ];

    expect(calls.filter(Boolean)).to.eql([
      "[cmd]: npm 'outdated'",
      '========== Start Dependencies ==========\n',
      'Start getting repo links',
      "[cmd]: npm 'repo' 'latest1' 'exactLatest' 'dep1' 'dep2' '--no-browser'",
      '|Package|Old|New|\n|-|-|-|\n',
      ...[
        ['latest1', '2.0.0'],
        ['exactLatest', '2.0.0'],
        ['dep1', '1.1.0'],
        ['dep2', '1.1.0'],
      ]
        .map((p) => [
          `| ${p[0]} | 1.0.0 | ${p[1]} |\n`,
          `${p[0]} 1.0.0 -> ${p[1]}`,
          ...pre,
          `[cmd]: npm 'install' '--registry=https://registry.npmjs.org/' '${p[0]}@${p[1]}'`,
          ...post,
        ])
        .flat(),
      '\n========== Start Dev Dependencies ==========\n',
      'Start getting repo links',
      "[cmd]: npm 'repo' 'latest2' 'devDep1' 'devDep2' '--no-browser'",
      '\n|Package|Old|New|\n|-|-|-|\n',
      ...[
        ['latest2', '2.0.0'],
        ['devDep1', '1.1.0'],
        ['devDep2', '1.1.0'],
      ]
        .map((p) => [
          `| ${p[0]} | 1.0.0 | ${p[1]} |\n`,
          `${p[0]} 1.0.0 -> ${p[1]}`,
        ])
        .flat(),
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
    ]);
  });
});
