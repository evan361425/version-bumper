import { expect } from 'chai';
import Sinon from 'sinon';
import { Config } from '../lib/config.js';
import { mockCommand, mockFile } from '../lib/helper.js';
import { resetEnv, setEnv, setupEnv } from './warm-up.js';

describe('Config', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    setupEnv();
    Sinon.restore();
  });

  it('env must overwrite config', function () {
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
      tag_package_json: 'tag_package_json',
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
          packageJson: false,
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

    expect(JSON.parse(JSON.stringify(config))).to.eql({
      repoLink: 'repo_link',
      prOnly: true,
      releaseOnly: true,
      noPush: true,
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
          packageJson: true,
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

  it('should response file in PR template', function () {
    setEnv('pr_template', 'some pr message');

    mockFile('pr template from file');

    const config = new Config({
      pr: {
        templateFile: 'my-file',
      },
    } as unknown as Record<string, never>);

    expect(config.prInfo.template).to.be.eq('some pr message');
  });

  it('setup latest content by diff commits', async function () {
    Sinon.stub(console, 'log');
    setEnv('latest_version', 'latest');
    setEnv('latest_diff_enable', 'true');
    setEnv('latest_content', 'shouldNotShow');
    mockCommand(Promise.resolve('tag'));
    mockCommand(
      Promise.resolve(
        [
          'hash1__! "Author 1" this is msg',
          'hash2 "Author 1" ',
          'hash3 ',
          'hash4 author',
          'hash5__! "Author 2" this is other msg',
          'hash6 "Author 2" ignored msg',
        ].join('\n'),
      ),
    );

    const config = new Config({
      repoLink: 'some-link',
      latestInfo: { content: 'shouldNotShow', diff: { ignored: ['ign'] } },
    } as unknown as Record<string, never>);

    await config.init('version');

    expect(config.latestInfo.content).to.eql(
      [
        '-   ([hash1__](some-link/commit/hash1__!)) this is msg - Author 1',
        '-   ([hash5__](some-link/commit/hash5__!)) this is other msg - Author 2',
      ].join('\n'),
    );
  });

  it('use allowed diff commits', async function () {
    Sinon.stub(console, 'log');
    setEnv('latest_version', 'latest');
    setEnv('latest_diff_enable', 'true');
    setEnv('latest_diff_allowed', 'abc, def');
    mockCommand(Promise.resolve('tag'));
    mockCommand(
      Promise.resolve(
        [
          'hash1 "Author 1" this is msg',
          'hash2__! "Author 1" abc this is msg',
          'hash3 "Author 2" this is other msg',
          'hash4__! "Author 2" def msg',
        ].join('\n'),
      ),
    );

    const config = new Config({
      repoLink: 'some-link',
    } as unknown as Record<string, never>);

    await config.init('version');

    expect(config.latestInfo.content).to.eql(
      [
        '-   ([hash2__](some-link/commit/hash2__!)) abc this is msg - Author 1',
        '-   ([hash4__](some-link/commit/hash4__!)) def msg - Author 2',
      ].join('\n'),
    );
  });
});
