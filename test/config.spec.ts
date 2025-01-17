import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Config } from '../lib/config.js';
import { mockCommand, mockFile } from '../lib/util.js';
import { resetEnv, setEnv, setupEnv } from './warm-up.js';

void describe('Config', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    setupEnv();
    mock.restoreAll();
  });

  void it('env must overwrite config', function () {
    Object.entries({
      config: 'config',
      debug: 'debug',
      ignored: 'ignored',
      output_file: 'output_file',
      append_only: 'append_only',
      use_exact: 'use_exact',
      latest_deps: 'latest_deps',
      pre_commands: 'pre_commands',
      post_commands: 'post_commands',
      one_by_one: 'one_by_one',
      dev_pre_commands: 'dev_pre_commands',
      dev_post_commands: 'dev_post_commands',
      stage: 'stage',
      repo_link: 'repo_link',
      pr_only: 'pr_only',
      release_only: 'release_only',
      no_push: 'no_push',
      changelog_disable: 'changelog_disable',
      changelog_template: 'changelog_template',
      changelog_file: 'changelog_file',
      changelog_header: 'changelog_header',
      changelog_commit_message: 'changelog_commit_message',
      auto_link_keys: 'auto_link_keys',
      auto_link_values: 'auto_link_values',
      tag_names: 'tag_names',
      tag_patterns: 'tag_patterns',
      tag_changelog: 'tag_changelog',
      pr_repo: 'pr_repo',
      pr_title: 'pr_title',
      pr_template: 'pr_template',
      pr_template_file: 'pr_template_file',
      branch_names: 'branch_names',
      branch_bases: 'branch_bases',
      branch_heads: 'branch_heads',
      branch_reviewers: 'branch_reviewers',
      branch_labels: 'branch_labels',
      latest_file: 'latest_file',
      latest_version: 'latest_version',
      latest_ticket: 'latest_ticket',
      latest_content: 'latest_content',
      latest_diff_enable: 'latest_diff_enable',
      latest_diff_allowed: 'latest_diff_allowed',
      latest_diff_ignored: 'latest_diff_ignored',
      release_enable: 'release_enable',
      release_title: 'release_title',
      release_pre: 'release_pre',
      release_draft: 'release_draft',
    }).forEach(([k, v]) => setEnv(k, v));

    const config = new Config({
      repoLink: 'shouldNotShow',
      prOnly: false,
      releaseOnly: false,
      noPush: false,
      beforeScripts: ['no-env-to-override'],
      afterScripts: ['no-env-to-override'],
      beforeCommit: ['no-env-to-override'],
      changelog: {
        disable: false,
        template: 'shouldNotShow',
        header: 'shouldNotShow',
        commitMessage: 'shouldNotShow',
      },
      tags: {
        shouldNotShow: {
          pattern: 'shouldNotShow',
          changelog: false,
          release: {
            enable: false,
            title: 'shouldNotShow',
            preRelease: false,
            draft: false,
          },
        },
      },
      pr: {
        repo: 'shouldNotShow',
        title: 'shouldNotShow',
        template: 'shouldNotShow',
        branches: {
          shouldNotShow: {
            head: 'shouldNotShow',
            base: 'shouldNotShow',
          },
        },
      },
      latestInfo: {
        version: 'shouldNotShow',
        ticket: 'shouldNotShow',
        content: 'shouldNotShow',
        file: 'shouldNotShow',
        diff: {
          enable: false,
          allowed: ['shouldNotShow'],
          ignored: ['shouldNotShow'],
        },
      },
      autoLinks: {
        autoLinkKeys: 'shouldNotShow',
      },
      deps: {
        ignored: ['shouldNotShow'],
        outputFile: 'shouldNotShow',
        appendOnly: false,
        saveExact: false,
        latestDeps: ['shouldNotShow'],
        allLatest: false,
        preCommands: ['shouldNotShow'],
        postCommands: ['shouldNotShow'],
        devInfo: {
          oneByOne: false,
          preCommands: ['shouldNotShow'],
          postCommands: ['shouldNotShow'],
        },
      },
    } as unknown as Record<string, never>);

    assert.deepStrictEqual(JSON.parse(JSON.stringify(config)), {
      repoLink: 'repo_link',
      prOnly: true,
      releaseOnly: true,
      noPush: true,
      beforeScripts: ['no-env-to-override'],
      afterScripts: ['no-env-to-override'],
      beforeCommit: ['no-env-to-override'],
      changelogInfo: {
        disable: true,
        template: 'changelog_template',
        file: 'changelog_file',
        header: 'changelog_header',
        commitMessage: 'changelog_commit_message',
      },
      tagsInfo: {
        tag_names: {
          pattern: 'tag_patterns',
          changelog: true,
          release: {
            enable: true,
            title: 'release_title',
            draft: true,
            preRelease: true,
          },
        },
      },
      prInfo: {
        repo: 'pr_repo',
        template: 'pr_template',
        title: 'pr_title',
        branches: {
          branch_names: {
            head: 'branch_heads',
            base: 'branch_bases',
            reviewers: ['branch_reviewers'],
            labels: ['branch_labels'],
            name: 'branch_names',
            siblings: {},
          },
        },
      },
      latestInfo: {
        file: 'latest_file',
        version: 'latest_version',
        ticket: 'latest_ticket',
        content: 'latest_content',
        diff: {
          enable: true,
          allowed: ['latest_diff_allowed'],
          ignored: ['latest_diff_ignored'],
        },
      },
      autoLinks: {
        auto_link_keys: 'auto_link_values',
      },
      deps: {
        ignored: ['ignored'],
        outputFile: 'output_file',
        appendOnly: true,
        saveExact: true,
        latestDeps: ['latest_deps'],
        allLatest: false,
        preCommands: ['pre_commands'],
        postCommands: ['post_commands'],
        devInfo: {
          oneByOne: true,
          preCommands: ['pre_commands'],
          postCommands: ['post_commands'],
        },
      },
    });
  });

  void it('should response file in PR template', function () {
    setEnv('pr_template', 'some pr message');

    mockFile('pr template from file');

    const config = new Config({
      pr: {
        templateFile: 'my-file',
      },
    } as unknown as Record<string, never>);

    assert.deepStrictEqual(config.prInfo.template, 'some pr message');
  });

  void it('setup latest content by diff commits', async function () {
    mock.method(console, 'log');
    setEnv('latest_version', 'latest');
    setEnv('latest_diff_enable', 'true');
    setEnv('latest_content', 'shouldNotShow');
    mockCommand(Promise.resolve('tag'));
    mockCommand(
      Promise.resolve(
        [
          'hash1__! author-1 this is msg',
          'hash2 author-1 ',
          'hash3 ',
          'hash4 author',
          'hash5__! author-2 this is other msg(#31)',
          'hash6 author-2 ignored msg',
        ].join('\n'),
      ),
    );

    const config = new Config({
      repoLink: 'some-link',
      latestInfo: { content: 'shouldNotShow', diff: { ignored: ['ign'] } },
    } as unknown as Record<string, never>);

    await config.init('version');

    assert.deepStrictEqual(
      config.latestInfo.content,
      [
        '- ([hash1__](some-link/commit/hash1__!)) this is msg - author-1',
        '- ([#31](some-link/pull/31)) this is other msg - author-2',
      ].join('\n'),
    );
  });

  void it('use allowed diff commits', async function () {
    mock.method(console, 'log');
    setEnv('latest_version', 'latest');
    setEnv('latest_diff_enable', 'true');
    setEnv('latest_diff_allowed', 'abc, def');
    mockCommand(Promise.resolve('tag'));
    mockCommand(
      Promise.resolve(
        [
          'hash1 author-1 this is msg',
          'hash2__! author-1 abc this is msg',
          'hash3 author-2 this is other msg',
          'hash4__! author-2 def msg',
        ].join('\n'),
      ),
    );

    const config = new Config({
      repoLink: 'some-link',
    } as unknown as Record<string, never>);

    await config.init('version');

    assert.deepStrictEqual(
      config.latestInfo.content,
      [
        '- ([hash2__](some-link/commit/hash2__!)) abc this is msg - author-1',
        '- ([hash4__](some-link/commit/hash4__!)) def msg - author-2',
      ].join('\n'),
    );
  });
});
