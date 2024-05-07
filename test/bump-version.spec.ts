import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import bumpVersion from '../lib/apis/version.js';
import { Config } from '../lib/config.js';
import { startDebug, stopDebug } from '../lib/helper.js';
import { resetEnv, setupEnv } from './warm-up.js';

void describe('Bump version', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    setupEnv();
    mock.restoreAll();
  });

  void it('example', async function () {
    const now = new Date('2022-12-1');
    mock.timers.enable();
    mock.timers.setTime(now.getTime());
    const config = new Config({
      repoLink: 'https://github.com/example/example',
      beforeScripts: [['a', '"{content}qq"'], 'c de{tag}f'],
      latestInfo: {
        version: 'v1.0.2',
        ticket: 'TICKET-200',
        content: 'This is my new release\n\nWith version: {version}\nstage: {stage}\nticket: {ticket}',
      },
      beforeCommit: ['npm version --no-commit-hooks --no-git-tag-version {tag}'],
      changelog: {
        header: 'test default header',
        template: 'ticket prefix: {ticket}\n\n{content}',
      },
      files: { latestVersion: 'non-exit-file' },
      autoLinks: {
        'ticket-': 'replace-{num}',
        'sub-ticket-': 'replace-sub-{num}',
      },
      tags: {
        test: {
          pattern: '^v1.0.\\d+$',
          changelog: true,
          packageJson: true,
          release: {
            enable: true,
          },
        },
      },
      pr: {
        template: 'Test PR body\n\nWith ticket: {ticket}\nstage: {stage}\nversion: {version}\ndiff: {diff}',
        branches: {
          test: {
            head: 'test-head',
            base: 'test-base',
            reviewers: ['r1', 'r2'],
            labels: ['label-1', 'label-2'],
            siblings: {
              dr: { head: 'deploy/dr' },
            },
          },
        },
      },
    } as unknown as never);

    Config.instance = config;
    mock.getter(Config.instance, 'changelog').mock.mockImplementation(
      () => `# Changelog

This is my test header

Hi there, try correct this!

## [Unreleased]

- 請看 git diff。

## [v1.0.1] - 2022-11-30

單號：[TICKET-100](http://example.com/browse/TICKET-100)

- SUB-TICKET-1001 Add some feature
- SUB-TICKET-1002 Fix some bug

## [v1.0.0] - 2022-01-30

First Release

[unreleased]: https://github.com/example/example/compare/v1.0.1...HEAD
[v1.0.1]: https://github.com/example/example/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/example/example/commits/v1.0.0`,
    );

    const stdout = mock.method(console, 'log');
    startDebug();
    await bumpVersion();
    stopDebug();

    const calls = stdout.mock.calls.map((call) => call.arguments[0]);
    const call1 = calls.shift();
    const cfg = JSON.parse(call1);
    assert.deepStrictEqual(cfg.repoLink, 'https://github.com/example/example');
    assert.deepStrictEqual(cfg.tagsInfo, {
      test: {
        pattern: '^v1.0.\\d+$',
        changelog: true,
        packageJson: true,
        release: {
          enable: true,
          draft: false,
          preRelease: false,
        },
      },
    });
    assert.deepStrictEqual(cfg.prInfo, {
      repo: 'example/example',
      title: '{ticket} - {version}({stage})',
      template: 'Test PR body\n\nWith ticket: {ticket}\nstage: {stage}\nversion: {version}\ndiff: {diff}',
      branches: {
        test: {
          name: 'test',
          head: 'test-head',
          base: 'test-base',
          reviewers: ['r1', 'r2'],
          labels: ['label-1', 'label-2'],
          siblings: {
            dr: {
              name: 'dr',
              base: 'test-base',
              head: 'deploy/dr',
              labels: ['label-1', 'label-2'],
              reviewers: ['r1', 'r2'],
            },
          },
        },
      },
    });
    assert.deepStrictEqual(cfg.changelogInfo, {
      header: 'test default header',
      template: 'ticket prefix: {ticket}\n\n{content}',
      disable: false,
      commitMessage: 'chore: bump to {version}\n\nticket: {ticket}\nstage: {stage}',
      file: 'CHANGELOG.md',
    });
    assert.deepStrictEqual(cfg.latestInfo.version, 'v1.0.2');
    assert.deepStrictEqual(cfg.latestInfo.ticket, 'TICKET-200');
    assert.deepStrictEqual(
      cfg.latestInfo.content,
      'This is my new release\n\nWith version: {version}\nstage: {stage}\nticket: {ticket}',
    );
    assert.deepStrictEqual(cfg.autoLinks, {
      'ticket-': 'replace-{num}',
      'sub-ticket-': 'replace-sub-{num}',
    });
    assert.deepStrictEqual(cfg.stage, 'test');
    assert.deepStrictEqual(calls, [
      '[changelog] Start parsing',
      '[cmd]: a \'"ticket prefix: TICKET-200\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: TICKET-200qq"\'',
      "[bump] Execute command 'a' done, output:\n",
      "[cmd]: c 'dev1.0.2f'",
      "[bump] Execute command 'c' done, output:\n",
      '[bump] Requirements checked',
      "[cmd]: git 'update-index' '--refresh'",
      "[cmd]: npm 'version' '--no-commit-hooks' '--no-git-tag-version' 'v1.0.2'",
      "[bump] Execute command 'npm' done, output:\n",
      '[bump] Start updating changelog',
      '[auto-links] hit( TICKET-200), target(TICKET-), num(200)',
      '[auto-links] is not in link',
      '[auto-links] hit( TICKET-200), target(TICKET-), num(200)',
      '[auto-links] is not in link',
      `# Changelog

This is my test header

Hi there, try correct this!

## [Unreleased]

- 請看 git diff。

## [v1.0.2] - 2022-12-01

ticket prefix: [TICKET-200](replace-200)

This is my new release

With version: v1.0.2
stage: test
ticket: [TICKET-200](replace-200)

## [v1.0.1] - 2022-11-30

單號：[TICKET-100](http://example.com/browse/TICKET-100)

- SUB-TICKET-1001 Add some feature
- SUB-TICKET-1002 Fix some bug

## [v1.0.0] - 2022-01-30

First Release

[unreleased]: https://github.com/example/example/compare/v1.0.2...HEAD
[v1.0.2]: https://github.com/example/example/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/example/example/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/example/example/commits/v1.0.0
`,
      '[bump] Add tag v1.0.2:\nticket prefix: [TICKET-200](replace-200)\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: [TICKET-200](replace-200)',
      "[cmd]: git 'commit' '.' '-m' 'chore: bump to v1.0.2\n\nticket: TICKET-200\nstage: test' '--no-verify'",
      "[cmd]: git 'tag' 'v1.0.2' '-m' 'ticket prefix: TICKET-200\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: TICKET-200'",
      '[bump] Pushing commit and tag',
      "[cmd]: git 'push' '--no-verify'",
      "[cmd]: git 'push' '--tag' '--no-verify'",
      '[auto-links] hit( TICKET-200), target(TICKET-), num(200)',
      '[auto-links] is not in link',
      '[pr] Creating branch test in example/example (test-head -> test-base)',
      [
        "[cmd]: gh 'pr' 'create'",
        "'--title' 'TICKET-200 - v1.0.2(test)'",
        "'--body' 'Test PR body\n\nWith ticket: [TICKET-200](replace-200)\nstage: test\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.1...v1.0.2\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.1...v1.0.2'",
        "'--assignee' '@me'",
        "'--base' 'test-base'",
        "'--head' 'test-head'",
        "'--repo' 'example/example'",
        "'--reviewer' 'r1' '--reviewer' 'r2'",
        "'--label' 'label-1' '--label' 'label-2'",
      ].join(' '),
      '[auto-links] hit( TICKET-200), target(TICKET-), num(200)',
      '[auto-links] is not in link',
      '[pr] Creating branch dr in example/example (deploy/dr -> test-base)',
      [
        "[cmd]: gh 'pr' 'create'",
        "'--title' 'TICKET-200 - v1.0.2(dr)'",
        "'--body' 'Test PR body\n\nWith ticket: [TICKET-200](replace-200)\nstage: dr\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.1...v1.0.2\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.1...v1.0.2'",
        "'--assignee' '@me'",
        "'--base' 'test-base'",
        "'--head' 'deploy/dr'",
        "'--repo' 'example/example'",
        "'--reviewer' 'r1' '--reviewer' 'r2'",
        "'--label' 'label-1' '--label' 'label-2'",
      ].join(' '),
      '[bump] Creating GitHub release v1.0.2',
      [
        "[cmd]: gh 'release' 'create' 'v1.0.2'",
        "'--title' 'v1.0.2'",
        "'--prerelease=false'",
        "'--draft=false'",
        "'--notes' 'ticket prefix: [TICKET-200](replace-200)\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: [TICKET-200](replace-200)'",
      ].join(' '),
    ]);
  });
});
