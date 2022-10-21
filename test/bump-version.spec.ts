import { expect } from 'chai';
import { stub, reset } from 'sinon';
import bumpVersion from '../lib/bump-version.js';
import { Config } from '../lib/config.js';
import { startDebug, stopDebug } from '../lib/helper.js';
import { resetEnv, setupEnv } from './warm-up.js';

describe('Bump version', function () {
  it('example', async function () {
    resetEnv();
    const config = new Config({
      repoLink: 'https://github.com/example/example',
      latestVersion: 'v1.0.2',
      latestTicket: 'TICKET-200',
      latestContent:
        'This is my new release\n\nWith version: <version>\nstage: <stage>\nticket: <ticket>',
      changelog: {
        header: 'test default header',
        ticketPrefix: 'ticket prefix:',
      },
      files: { latestVersion: 'non-exit-file' },
      autoLinks: {
        'ticket-': 'replace-<num>',
        'sub-ticket-': 'replace-sub-<num>',
      },
      branches: {
        test: {
          head: 'test-head',
          base: 'test-base',
          reviewers: ['r1', 'r2'],
          versionPattern: '^v1.0.\\d+$',
          labels: ['label-1', 'label-2'],
        },
      },
      prodOtherPr: 'dr',
    } as unknown as never);

    stub(Config, 'instance').get(() => config);
    stub(Config.instance, 'prTemplate').get(
      () =>
        'Test PR body\n\nWith ticket: <ticket>\nstage: <stage>\nversion: <version>\ndiff: <diff>'
    );
    stub(Config.instance, 'changelog').get(
      () => `# Changelog

This is my test header

Hi there, try correct this!

## [Unreleased]

-   請看 git diff。

## [v1.0.1] - 2022-11-30

單號：[TICKET-100](http://example.com/browse/TICKET-100)

-   SUB-TICKET-1001 Add some feature
-   SUB-TICKET-1002 Fix some bug

## [v1.0.0] - 2022-01-30

First Release

[unreleased]: https://github.com/example/example/compare/v1.0.1...HEAD
[v1.0.1]: https://github.com/example/example/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/104corp/vip3-auth-agent/commits/v1.0.0`
    );

    const stdout = stub(console, 'log');
    startDebug();
    await bumpVersion();
    stopDebug();

    const calls = stdout.getCalls().map((call) => call.args[0]);
    const call1 = calls.shift();
    expect(JSON.parse(call1)).to.eql({
      repoLink: 'https://github.com/example/example',
      prRepo: 'example/example',
      commitMessage: 'chore: bump to <version>',
      baseBranch: 'main',
      prodOtherPr: 'dr',
      prOnly: false,
      productionName: 'production',
      changelogInfo: {
        header: 'test default header',
        ticketPrefix: 'ticket prefix:',
        disable: false,
      },
      files: {
        latestVersion: 'non-exit-file',
        changelog: 'CHANGELOG.md',
        prTemplate: 'docs/PR_TEMPLATE.md',
      },
      latestInfo: {
        version: 'v1.0.2',
        ticket: 'TICKET-200',
        body: 'This is my new release\n\nWith version: <version>\nstage: <stage>\nticket: <ticket>',
      },
      autoLinks: {
        'ticket-': 'replace-<num>',
        'sub-ticket-': 'replace-sub-<num>',
      },
      branches: {
        test: {
          head: 'test-head',
          base: 'test-base',
          reviewers: ['r1', 'r2'],
          versionPattern: '^v1.0.\\d+$',
          labels: ['label-1', 'label-2'],
        },
        staging: {
          head: 'deploy/staging',
          base: 'deploy/develop',
          reviewers: [],
          labels: [],
        },
        production: {
          head: 'deploy/production',
          base: 'deploy/staging',
          reviewers: [],
          labels: [],
        },
      },
      stage: 'test',
    });
    expect(calls).to.eql([
      '[changelog] Start parsing',
      "[cmd]: git 'update-index' '--refresh'",
      "[cmd]: git 'tag' 'v1.0.2' '-m' 'ticket prefix:TICKET-200\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: TICKET-200'",
      "[cmd]: git 'log' '-q' 'origin/main..HEAD'",
      "[cmd]: git 'push' '--tag' '--no-verify'",
      '[pr] body: Test PR body\n\nWith ticket: TICKET-200\nstage: test\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.2...v1.0.1\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.2...v1.0.1',
      '[pr] Creating in example/example(test) test-base -> test-head',
      [
        "[cmd]: gh 'pr' 'create'",
        "'--title' 'TICKET-200 - v1.0.2(test)'",
        "'--body' 'Test PR body\n\nWith ticket: TICKET-200\nstage: test\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.2...v1.0.1\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.2...v1.0.1'",
        "'--assignee' '@me'",
        "'--base' 'test-base'",
        "'--head' 'test-head'",
        "'--repo' 'example/example'",
        "'--reviewer' 'r1' '--reviewer' 'r2'",
        "'--label' 'label-1' '--label' 'label-2'",
      ].join(' '),
    ]);
    stdout.restore();
    setupEnv();
    reset();
  });
});
