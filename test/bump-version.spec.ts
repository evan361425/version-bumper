/* eslint-disable mocha/no-hooks-for-single-case */
import { expect } from 'chai';
import { restore, stub, reset } from 'sinon';
import bumpVersion from '../lib/apis/bump-version.js';
import { Config } from '../lib/config.js';
import { startDebug, stopDebug } from '../lib/helper.js';
import { resetEnv, setupEnv } from './warm-up.js';

describe('Bump version', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    restore();
    setupEnv();
    reset();
  });

  it('example', async function () {
    const config = new Config({
      repoLink: 'https://github.com/example/example',
      latestVersion: 'v1.0.2',
      latestTicket: 'TICKET-200',
      latestContent:
        'This is my new release\n\nWith version: {version}\nstage: {stage}\nticket: {ticket}',
      changelog: {
        header: 'test default header',
        ticketPrefix: 'ticket prefix:',
      },
      files: { latestVersion: 'non-exit-file' },
      autoLinks: {
        'ticket-': 'replace-<num>',
        'sub-ticket-': 'replace-sub-<num>',
      },
      pr: {
        branches: {
          test: {
            pattern: '^v1.0.\\d+$',
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

    stub(Config, 'instance').get(() => config);
    stub(Config.instance, 'prTemplate').get(
      () =>
        'Test PR body\n\nWith ticket: {ticket}\nstage: {stage}\nversion: {version}\ndiff: {diff}'
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
[v1.0.0]: https://github.com/example/example/commits/v1.0.0`
    );

    const stdout = stub(console, 'log');
    startDebug();
    await bumpVersion();
    stopDebug();

    const calls = stdout.getCalls().map((call) => call.args[0]);
    const call1 = calls.shift();
    expect(JSON.parse(call1)).to.eql({
      repoLink: 'https://github.com/example/example',
      prOnly: false,
      commitInfo: { noPush: false, message: 'chore: bump to {version}' },
      prInfo: {
        repo: 'example/example',
        branches: {
          test: {
            name: 'test',
            pattern: '^v1.0.\\d+$',
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
      },
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
        body: 'This is my new release\n\nWith version: {version}\nstage: {stage}\nticket: {ticket}',
      },
      autoLinks: {
        'ticket-': 'replace-<num>',
        'sub-ticket-': 'replace-sub-<num>',
      },
      stage: 'test',
    });
    expect(calls).to.eql([
      '[changelog] Start parsing',
      '[bump] Requirements checked',
      "[cmd]: git 'update-index' '--refresh'",
      "[cmd]: git 'tag' 'v1.0.2' '-m' 'ticket prefix:TICKET-200\n\nThis is my new release\n\nWith version: v1.0.2\nstage: test\nticket: TICKET-200'",
      "[cmd]: git 'push' '--no-verify'",
      "[cmd]: git 'push' '--tag' '--no-verify'",
      '[pr] body: Test PR body\n\nWith ticket: TICKET-200\nstage: test\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.2...v1.0.1\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.2...v1.0.1',
      '[pr] Creating branch test in example/example (test-base -> test-head)',
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
      '[pr] body: Test PR body\n\nWith ticket: TICKET-200\nstage: dr\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.2...v1.0.1\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.2...v1.0.1',
      '[pr] Creating branch dr in example/example (test-base -> deploy/dr)',
      [
        "[cmd]: gh 'pr' 'create'",
        "'--title' 'TICKET-200 - v1.0.2(dr)'",
        "'--body' 'Test PR body\n\nWith ticket: TICKET-200\nstage: dr\nversion: v1.0.2\ndiff: https://github.com/example/example/compare/v1.0.2...v1.0.1\n\n[v1.0.2]: https://github.com/example/example/compare/v1.0.2...v1.0.1'",
        "'--assignee' '@me'",
        "'--base' 'test-base'",
        "'--head' 'deploy/dr'",
        "'--repo' 'example/example'",
        "'--reviewer' 'r1' '--reviewer' 'r2'",
        "'--label' 'label-1' '--label' 'label-2'",
      ].join(' '),
    ]);
  });
});
